package com.onelaunch;

import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.ArrayList;
import java.util.List;

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
        verify(vision, never()).complianceCheck(anyString(), anyString(), anyString(), anyString(), anyString());
    }

    @Test void allRetriesWhiteWithFullComplianceAndEmitsPlatform() {
        var service = service("all");
        when(vision.complianceCheck(anyString(), anyString(), anyString(), anyString(), anyString())).thenReturn(failed(), passed());
        List<ApiModels.PipelineEvent> events = new ArrayList<>();
        var result = service.run(request(), events::add);
        assertEquals(5, result.qa().size());
        assertTrue(result.qa().stream().allMatch(q -> q.passed() && "Amazon".equals(q.platform())));
        assertEquals(6, events.stream().filter(e -> "qa".equals(e.event())).count());
        verify(images, times(6)).generateImage(anyString(), nullable(String.class));
        verify(vision, times(6)).complianceCheck(anyString(), anyString(), anyString(), anyString(), anyString());
        verify(vision, never()).qcWhiteBackground(anyString(), anyString(), anyString());
    }

    @Test void unavailableVisionDoesNotStopPipeline() {
        var service = service("all");
        when(vision.complianceCheck(anyString(), anyString(), anyString(), anyString(), anyString())).thenThrow(new IllegalStateException("无可用视觉模型"));
        var result = service.run(request());
        assertEquals(5, result.qa().size());
        assertTrue(result.qa().stream().allMatch(q -> q.model() == null && q.comment().contains("人工复检")));
        assertEquals(1, result.detailPages().size());
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
