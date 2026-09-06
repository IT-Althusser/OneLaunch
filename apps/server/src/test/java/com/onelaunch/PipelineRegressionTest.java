package com.onelaunch;

import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.ArrayList;
import java.util.List;
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
        verify(vision, never()).complianceCheck(anyString(), anyString(), anyString(), anyString(), anyString(), anyString());
    }

    @Test void allRetriesWhiteWithFullComplianceAndEmitsPlatform() {
        var service = service("all");
        when(vision.complianceCheck(anyString(), anyString(), anyString(), anyString(), anyString(), anyString())).thenReturn(failed(), passed());
        List<ApiModels.PipelineEvent> events = new ArrayList<>();
        var result = service.run(request(), events::add);
        assertEquals(5, result.qa().size());
        assertTrue(result.qa().stream().allMatch(q -> q.passed() && "Amazon".equals(q.platform())));
        assertEquals(6, events.stream().filter(e -> "qa".equals(e.event())).count());
        verify(images, times(1)).generateImage(anyString(), nullable(String.class));
        verify(images, times(4)).editImage(anyString(), anyList(), nullable(String.class));
        verify(vision, times(6)).complianceCheck(anyString(), anyString(), anyString(), anyString(), anyString(), anyString());
        verify(vision, never()).qcWhiteBackground(anyString(), anyString(), anyString());
    }

    @Test void unavailableVisionDoesNotStopPipeline() {
        var service = service("all");
        when(vision.complianceCheck(anyString(), anyString(), anyString(), anyString(), anyString(), anyString())).thenThrow(new IllegalStateException("无可用视觉模型"));
        var result = service.run(request());
        assertEquals(5, result.qa().size());
        assertTrue(result.qa().stream().allMatch(q -> !q.passed() && "manual_review".equals(q.status()) && q.model() == null && q.comment().contains("人工复检")));
        assertEquals(1, result.detailPages().size());
    }

    @Test void textOnlyGenerationUsesOneProductAnchorForRemainingImages() {
        var service = service("all");
        when(vision.complianceCheck(anyString(), anyString(), anyString(), anyString(), anyString(), anyString())).thenReturn(passed());
        service.run(request());
        verify(images, times(1)).generateImage(anyString(), nullable(String.class));
        verify(images, times(3)).editImage(anyString(), eq(List.of("https://example.test/image.png")), nullable(String.class));
        verify(images).dimensionGuide("https://example.test/image.png", "轻量");
    }

    @Test void allImageTypesHaveOneBoundedRepairAndFirstPassRemainsVisible() {
        var service = service("all");
        when(vision.complianceCheck(anyString(), anyString(), anyString(), anyString(), anyString(), anyString())).thenReturn(failed());
        List<ApiModels.PipelineEvent> events = new ArrayList<>();
        var result = service.run(request(), events::add);
        assertEquals(5, result.qa().size());
        assertTrue(result.qa().stream().allMatch(q -> !q.passed() && "failed".equals(q.status())));
        assertEquals(5, events.stream().filter(e -> "qa_first".equals(e.event())).count());
        verify(vision, times(9)).complianceCheck(anyString(), anyString(), anyString(), anyString(), anyString(), anyString());
        verify(images, times(4)).generateImage(anyString(), nullable(String.class));
        verify(images, times(4)).editImage(anyString(), anyList(), nullable(String.class));
        verify(images, never()).editImage(contains("尺寸图"), anyList(), nullable(String.class));
        assertTrue(result.steps().stream().anyMatch(s -> s.detail() != null && s.detail().contains("首次通过 0/5；修复尝试 4 张；最终通过 0/5")));
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
        assertEquals(refs, captured.getAllValues().get(1).subList(1, 3));
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
