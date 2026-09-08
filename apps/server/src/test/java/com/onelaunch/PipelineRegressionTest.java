package com.onelaunch;

import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.mockito.ArgumentCaptor;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class PipelineRegressionTest {
    private final ChatClient chat = mock(ChatClient.class);
    private final ModelRouterImageClient images = mock(ModelRouterImageClient.class);
    private final ModelRouterVisionClient vision = mock(ModelRouterVisionClient.class);

    private ImagePipelineService service(String scope) {
        when(chat.prompt()).thenThrow(new IllegalStateException("文本服务不可用"));
        when(images.generateImage(anyString(), nullable(String.class))).thenReturn(new ModelRouterImageClient.ImageResult(List.of("https://example.test/image.png"), "2048x2048"));
        when(images.editImage(anyString(), anyList(), nullable(String.class))).thenAnswer(call ->
                new ModelRouterImageClient.ImageResult(List.of("https://example.test/edited-" + java.util.UUID.randomUUID() + ".png"), "1024x1024"));
        when(images.dimensionGuide(any(), anyString())).thenReturn(new ModelRouterImageClient.ImageResult(List.of("data:image/png;base64,dGVzdA=="), "1600x1200"));
        when(vision.defaultModel()).thenReturn("vision-test");
        when(vision.ruleSource(anyString(), anyString())).thenReturn("test rules");
        var service = new ImagePipelineService(chat, images, vision);
        ReflectionTestUtils.setField(service, "qaScope", scope);
        ReflectionTestUtils.setField(service, "defaultImageModel", "image-test");
        ReflectionTestUtils.setField(service, "defaultEditModel", "edit-test");
        ReflectionTestUtils.setField(service, "defaultTextModel", "text-test");
        return service;
    }

    private ApiModels.ImagePipelineRequest request() {
        return new ApiModels.ImagePipelineRequest("托特包", "轻量", List.of("Amazon"), null, null, null, null, null, null, "US");
    }

    @Test void whiteRetriesWithWhiteReview() {
        var service = service("white");
        when(vision.qcWhiteBackground(anyString(), anyString(), anyString())).thenReturn(failed(), passed());
        var result = service.run(request());
        assertEquals(5, result.images().size());
        assertEquals(1, result.qa().size());
        assertTrue(result.qa().getFirst().passed());
        verify(vision, times(2)).qcWhiteBackground(anyString(), anyString(), anyString());
        verify(vision, never()).complianceCheck(anyString(), anyString(), anyString(), anyString(), anyString(), anyString(), nullable(String.class));
    }

    @Test void allRetriesWhiteWithFullComplianceAndEmitsOnlyFinalQa() {
        var service = service("all");
        when(vision.complianceCheck(anyString(), anyString(), anyString(), anyString(), anyString(), anyString(), nullable(String.class))).thenReturn(failed(), passed());
        List<ApiModels.PipelineEvent> events = new ArrayList<>();
        var result = service.run(request(), events::add);
        assertEquals(5, result.qa().size());
        assertTrue(result.qa().stream().allMatch(q -> q.passed() && "Amazon".equals(q.platform())));
        assertEquals(5, events.stream().filter(e -> "qa".equals(e.event())).count());
        assertEquals(0, events.stream().filter(e -> "qa_first".equals(e.event())).count());
        verify(images, times(1)).generateImage(anyString(), nullable(String.class));
        verify(images, times(4)).editImage(anyString(), anyList(), nullable(String.class));
        verify(vision, times(6)).complianceCheck(anyString(), anyString(), anyString(), anyString(), anyString(), anyString(), nullable(String.class));
        verify(vision, never()).qcWhiteBackground(anyString(), anyString(), anyString());
    }

    @Test void unavailableVisionDoesNotStopPipeline() {
        var service = service("all");
        when(vision.complianceCheck(anyString(), anyString(), anyString(), anyString(), anyString(), anyString(), nullable(String.class))).thenThrow(new IllegalStateException("无可用视觉模型"));
        var result = service.run(request());
        assertEquals(5, result.qa().size());
        assertTrue(result.qa().stream().allMatch(q -> !q.passed() && "manual_review".equals(q.status()) && q.model() == null && q.comment().contains("人工复检")));
        assertEquals(1, result.detailPages().size());
    }

    @Test void textOnlyGenerationUsesOneProductAnchorForRemainingImages() {
        var service = service("all");
        when(vision.complianceCheck(anyString(), anyString(), anyString(), anyString(), anyString(), anyString(), nullable(String.class))).thenReturn(passed());
        service.run(request());
        verify(images, times(1)).generateImage(anyString(), nullable(String.class));
        verify(images, times(3)).editImage(anyString(), eq(List.of("https://example.test/image.png")), nullable(String.class));
        verify(images).dimensionGuide("https://example.test/image.png", "轻量");
    }

    @Test void allRepairableImageTypesHaveTwoBoundedRepairsAndOnlyFinalQaRemainsVisible() {
        var service = service("all");
        when(vision.complianceCheck(anyString(), anyString(), anyString(), anyString(), anyString(), anyString(), nullable(String.class))).thenReturn(failed());
        List<ApiModels.PipelineEvent> events = new ArrayList<>();
        var result = service.run(request(), events::add);
        assertEquals(5, result.qa().size());
        assertTrue(result.qa().stream().allMatch(q -> !q.passed() && "failed".equals(q.status())));
        assertEquals(0, events.stream().filter(e -> "qa_first".equals(e.event())).count());
        verify(vision, times(14)).complianceCheck(anyString(), anyString(), anyString(), anyString(), anyString(), anyString(), nullable(String.class));
        verify(images, times(5)).generateImage(anyString(), nullable(String.class));
        verify(images, times(8)).editImage(anyString(), anyList(), nullable(String.class));
        verify(images, never()).editImage(contains("尺寸图"), anyList(), nullable(String.class));
        var qualityStep = result.steps().stream()
                .filter(s -> s.step().contains("合规 Agent"))
                .findFirst()
                .orElseThrow();
        assertEquals("done", qualityStep.status());
        assertAll(
                () -> assertTrue(qualityStep.detail().contains("首次通过 0/5")),
                () -> assertTrue(qualityStep.detail().contains("修复尝试 8 张")),
                () -> assertTrue(qualityStep.detail().contains("最终通过 0/5")),
                () -> assertTrue(qualityStep.detail().contains("人工复检 0 张"))
        );
        for (var q : result.qa()) assertTrue(result.images().stream().anyMatch(i -> i.type().equals(q.type()) && i.url().equals(q.url())));
    }

    @Test void failedRepairReviewKeepsPreviouslyReviewedImageAndStatus() {
        var service = service("white");
        when(vision.qcWhiteBackground(anyString(), anyString(), anyString()))
                .thenReturn(failed()).thenThrow(new IllegalStateException("审核超时"));
        var result = service.run(request());
        assertEquals("https://example.test/image.png", result.images().getFirst().url());
        assertEquals(result.images().getFirst().url(), result.qa().getFirst().url());
        assertEquals("failed", result.qa().getFirst().status());
    }

    @Test void referenceRepairKeepsOriginalProductImagesAndUsesEditModel() {
        var service = service("white");
        when(vision.qcWhiteBackground(anyString(), anyString(), anyString())).thenReturn(failed(), passed());
        List<String> refs = List.of("https://example.test/product-front.png", "https://example.test/product-back.png");
        var req = new ApiModels.ImagePipelineRequest("托特包", "宽 38 cm，高 30 cm", List.of("Amazon"), null,
                refs, "image-model", "edit-model", null, null, "US");
        var result = service.run(req);
        verify(images, never()).generateImage(anyString(), nullable(String.class));
        @SuppressWarnings("unchecked") ArgumentCaptor<List<String>> captured = ArgumentCaptor.forClass(List.class);
        verify(images, times(5)).editImage(anyString(), captured.capture(), eq("edit-model"));
        assertEquals(2, captured.getAllValues().get(1).size()); // 修复参考 = 当前图（编辑基准）+ P3 原始参考图（商品身份锚点，防修复偏离本体）
        assertTrue(result.qa().getFirst().passed());
    }

    @Test void generationPromptsDoNotTurnMarketplaceOrProfileGuessesIntoProductFacts() {
        var service = service("all");
        for (String type : List.of("白底图", "场景图", "模特图", "对比图", "尺寸图")) {
            String prompt = service.buildPrompt(type, "托特包", "重量 380g", "Amazon", List.of());
            assertFalse(prompt.contains("Amazon"));
            assertTrue(prompt.contains("原始商品资料"));
            assertFalse(prompt.contains("商品画像"));
        }
        String dimensions = service.buildPrompt("尺寸图", "托特包", "宽 38 cm，高 30 cm", "Amazon", List.of());
        assertTrue(dimensions.contains("宽 38 cm，高 30 cm"));
        assertTrue(dimensions.contains("不换算、不猜测"));
        assertTrue(dimensions.contains("若缺少实测长宽高"));
    }

    @Test void scenePromptRequiresSemanticEnvironmentAndRejectsNoiseBackgrounds() {
        var service = service("all");
        String prompt = service.buildPrompt("场景图", "水杯", "保温", "Amazon", List.of("https://example.test/cup.png"));
        assertTrue(prompt.contains("至少清晰出现三类有语义的环境元素"));
        assertTrue(prompt.contains("前景、中景、背景"));
        assertTrue(prompt.contains("雪花、噪点、散斑"));
        assertTrue(prompt.contains("背景若没有可辨认空间与物体即为不合格"));
        assertTrue(ModelRouterVisionClient.imageTypeRule("场景图").contains("均不能算场景图，必须判为未通过"));
    }

    @Test void complianceCompletionEventPrecedesFinalDoneEvent() {
        var service = service("all");
        when(vision.complianceCheck(anyString(), anyString(), anyString(), anyString(), anyString(), anyString(), nullable(String.class))).thenReturn(passed());
        List<ApiModels.PipelineEvent> events = new ArrayList<>();
        service.run(request(), events::add);
        int complianceComplete = java.util.stream.IntStream.range(0, events.size())
                .filter(i -> "compliance_complete".equals(events.get(i).event())).findFirst().orElse(-1);
        int done = java.util.stream.IntStream.range(0, events.size())
                .filter(i -> "done".equals(events.get(i).event())).findFirst().orElse(-1);
        assertTrue(complianceComplete >= 0 && done > complianceComplete);
        @SuppressWarnings("unchecked") Map<String, Object> data = (Map<String, Object>) events.get(complianceComplete).data();
        assertEquals(5, ((List<?>) data.get("images")).size());
        assertEquals(5, ((List<?>) data.get("qa")).size());
    }

    @Test void modelPromptRequiresVisibleHalfBodyPersonInsteadOfHandOnly() {
        var service = service("all");
        String prompt = service.buildPrompt("模特图", "托特包", "轻量", "Amazon", List.of());
        assertTrue(prompt.contains("腰部以上"));
        assertTrue(prompt.contains("肩膀和躯干"));
        assertTrue(prompt.contains("双眼、鼻子、嘴巴"));
        assertTrue(prompt.contains("人物占画面不低于 35%"));
        assertTrue(prompt.contains("严禁只有一只手"));
        assertTrue(prompt.contains("只露下巴"));
        assertTrue(ModelRouterVisionClient.imageTypeRule("模特图").contains("腰部以上完整入镜"));
        assertTrue(ModelRouterVisionClient.imageTypeRule("模特图").contains("双眼、鼻子、嘴巴"));
    }

    @Test void singleModelImageAlwaysAddsVisiblePersonConstraint() {
        var service = service("all");
        service.single(new ApiModels.SingleImageRequest("模特图", "都市街拍", "Amazon", null, null, null));
        verify(images).generateImage(argThat(prompt -> prompt.contains("都市街拍")
                && prompt.contains("必须有人")
                && prompt.contains("腰部以上完整出镜")
                && prompt.contains("只有手、手臂")
                && prompt.contains("必须重新生成")), nullable(String.class));
    }

    @Test void localizeDefaultAndTextOnlyKeepUnselectedAspects() {
        var service = service("all");
        when(images.editImage(anyString(), anyString(), nullable(String.class))).thenReturn(new ModelRouterImageClient.ImageResult(List.of("https://example.test/local.png"), "1024x1024"));
        var legacy = service.localize(new ApiModels.LocalizeRequest("https://example.test/source.png", "US", null, null, null, null, null));
        assertEquals(List.of("scene"), legacy.appliedAspects());
        var text = service.localize(new ApiModels.LocalizeRequest("https://example.test/source.png", "日本", null, null, List.of("text"), null, null));
        assertTrue(text.prompt().contains("日语"));
        assertFalse(text.prompt().contains("将背景替换"));
        assertTrue(text.prompt().contains("未选本地化维度不变"));
        assertNotNull(text.note());
        assertThrows(IllegalArgumentException.class, () -> service.localize(new ApiModels.LocalizeRequest("https://example.test/source.png", "US", null, null, List.of(), null, null)));
    }

    private ModelRouterVisionClient.QcResult failed() { return new ModelRouterVisionClient.QcResult(false, List.of("促销文字"), "未通过", "保留同一商品，移除促销文字"); }
    private ModelRouterVisionClient.QcResult passed() { return new ModelRouterVisionClient.QcResult(true, List.of(), "通过", ""); }
}
