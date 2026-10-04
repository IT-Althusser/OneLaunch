package com.onelaunch;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.web.client.RestClient;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/** 图生图独立网关覆盖：地址校验（公网 http(s)）+ 双客户端装配路由。 */
class ModelRouterEditEndpointTest {

    @Test void acceptsPublicHttpUrls() {
        ModelRouterImageClient.validatePublicHttpUrl("https://8.8.8.8/v1");
        ModelRouterImageClient.validatePublicHttpUrl("http://[2606:4700::1]/compatible-mode/v1");
        ModelRouterImageClient.validatePublicHttpUrl("  https://8.8.8.8/v1  "); // 首尾空白容忍
    }

    @Test void rejectsNonHttpSchemesAndLocalPrivateReservedHosts() {
        for (String bad : List.of(
                "ftp://8.8.8.8/v1",
                "https://localhost/v1",
                "https://api.localhost/v1",
                "https://gw.local/v1",
                "https://127.0.0.1/v1",
                "http://10.1.2.3/v1",
                "https://192.168.1.5/v1",
                "https://172.16.0.9/v1",
                "https://169.254.169.254/latest/meta-data",
                "https://0.0.0.0/v1",
                "https://[::1]/v1",
                "https://[fe80::1]/v1",
                "https://[fd00::1]/v1", // IPv6 唯一本地地址（ULA fc00::/7）
                "https://[::ffff:127.0.0.1]/v1", // IPv4 映射环回
                "not a url",
                "https:///no-host/v1")) {
            assertThrows(IllegalArgumentException.class, () -> ModelRouterImageClient.validatePublicHttpUrl(bad), bad);
        }
    }

    @Test void blankOverrideKeepsSingleSharedClient() {
        RestClient.Builder builder = mock(RestClient.Builder.class, RETURNS_SELF);
        when(builder.build()).thenReturn(mock(RestClient.class));
        new ModelRouterImageClient(builder, "https://main.example/v1", "sk-main", "wan", "qwen-image", "", "", "chat");
        verify(builder, times(1)).build(); // 未配置覆盖时只装配主客户端
    }

    @Test void overrideBuildsDedicatedEditClientWithSameBuilder() {
        RestClient.Builder builder = mock(RestClient.Builder.class, RETURNS_SELF);
        when(builder.build()).thenReturn(mock(RestClient.class));
        new ModelRouterImageClient(builder, "https://main.example/v1", "sk-main", "wan", "qwen-image",
                "https://8.8.8.8/v1", "sk-edit", "chat");
        ArgumentCaptor<String> urls = ArgumentCaptor.forClass(String.class);
        verify(builder, times(2)).baseUrl(urls.capture());
        assertEquals(List.of("https://main.example/v1", "https://8.8.8.8/v1"), urls.getAllValues());
    }

    @Test void invalidOverrideUrlFailsFastAtStartup() {
        RestClient.Builder builder = mock(RestClient.Builder.class, RETURNS_SELF);
        when(builder.build()).thenReturn(mock(RestClient.class));
        assertThrows(IllegalArgumentException.class, () -> new ModelRouterImageClient(
                builder, "https://main.example/v1", "sk-main", "wan", "qwen-image", "http://localhost/v1", "sk-edit", "chat"));
        verify(builder, times(1)).build(); // 主客户端已建，覆盖客户端未建（启动即失败）
    }

    @Test void openaiImagesStylePostsMultipartEditsAndParsesB64() {
        RestClient.Builder realBuilder = RestClient.builder();
        org.springframework.test.web.client.MockRestServiceServer server =
                org.springframework.test.web.client.MockRestServiceServer.bindTo(realBuilder).build();
        var client = new ModelRouterImageClient(realBuilder, "https://main.example/v1", "sk-main", "wan", "qwen-image",
                "https://8.8.8.8/v1", "sk-edit", "chat");
        org.springframework.test.util.ReflectionTestUtils.setField(client, "editApiStyle", "openai-images");
        server.expect(org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo("https://8.8.8.8/v1/images/edits"))
                .andExpect(org.springframework.test.web.client.match.MockRestRequestMatchers.method(org.springframework.http.HttpMethod.POST))
                .andRespond(org.springframework.test.web.client.response.MockRestResponseCreators
                        .withSuccess("{\"data\":[{\"b64_json\":\"QUJDRA==\"}]}", org.springframework.http.MediaType.APPLICATION_JSON));
        var result = client.editImage("把背景换成厨房", List.of("data:image/jpeg;base64,AAAA"), null, true);
        assertEquals(List.of("data:image/png;base64,QUJDRA=="), result.urls());
        assertEquals("1024x1024", result.size());
        server.verify();
    }

    @Test void openaiImagesStyleAlsoAcceptsUrlResponsesAndMultiRefs() {
        RestClient.Builder realBuilder = RestClient.builder();
        org.springframework.test.web.client.MockRestServiceServer server =
                org.springframework.test.web.client.MockRestServiceServer.bindTo(realBuilder).build();
        var client = new ModelRouterImageClient(realBuilder, "https://main.example/v1", "sk-main", "wan", "qwen-image",
                "https://8.8.8.8/v1", "sk-edit", "chat");
        org.springframework.test.util.ReflectionTestUtils.setField(client, "editApiStyle", "openai-images");
        server.expect(org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo("https://8.8.8.8/v1/images/edits"))
                .andRespond(org.springframework.test.web.client.response.MockRestResponseCreators
                        .withSuccess("{\"data\":[{\"url\":\"https://cdn.example/out.png\",\"size\":\"1536x1024\"}]}", org.springframework.http.MediaType.APPLICATION_JSON));
        var result = client.editImage("保留商品，加厨房场景",
                List.of("data:image/png;base64,AAAA", "data:image/png;base64,BBBB"), "gpt-image-2", true);
        assertEquals(List.of("https://cdn.example/out.png"), result.urls());
        assertEquals("1536x1024", result.size());
        server.verify();
    }

    @Test void editGatewayFlagAndCatalogExposesEditModels() {
        RestClient.Builder builder = mock(RestClient.Builder.class, RETURNS_SELF);
        when(builder.build()).thenReturn(mock(RestClient.class));
        ModelRouterImageClient withOverride = new ModelRouterImageClient(
                builder, "https://main.example/v1", "sk-main", "wan", "qwen-image", "https://8.8.8.8/v1", "sk-edit", "chat");
        ModelRouterImageClient withoutOverride = new ModelRouterImageClient(
                builder, "https://main.example/v1", "sk-main", "wan", "qwen-image");
        assertTrue(withOverride.editGatewayConfigured());
        assertFalse(withoutOverride.editGatewayConfigured());

        var chat = mock(org.springframework.ai.chat.client.ChatClient.class);
        when(chat.prompt()).thenThrow(new IllegalStateException("文本服务不可用"));
        var vision = mock(ModelRouterVisionClient.class);
        when(vision.defaultModel()).thenReturn("vision-test");
        ModelRouterImageClient client = spy(withOverride); // 真实装配 + 打桩网关清单调用（不发起真实 HTTP）
        org.mockito.Mockito.doReturn(List.of("gpt-image2", "gpt-image2", "dall-e-3")).when(client).listEditModels();
        org.mockito.Mockito.doReturn(List.of("wan", "qwen-image-2.0")).when(client).listModels();
        var service = new ImagePipelineService(chat, client, vision, new ComplianceRuleLibrary()); // service 持有 spy，打桩才生效
        org.springframework.test.util.ReflectionTestUtils.setField(service, "qaScope", "all");
        org.springframework.test.util.ReflectionTestUtils.setField(service, "defaultImageModel", "wan");
        org.springframework.test.util.ReflectionTestUtils.setField(service, "defaultEditModel", "qwen-image-2.0");
        org.springframework.test.util.ReflectionTestUtils.setField(service, "defaultTextModel", "qwen3.7-max");

        var catalog = service.modelCatalog();
        @SuppressWarnings("unchecked")
        List<java.util.Map<String, Object>> editToImage = (List<java.util.Map<String, Object>>) catalog.get("editToImage");
        assertTrue(Boolean.TRUE.equals(catalog.get("editGateway")));
        assertEquals(2, editToImage.size()); // distinct 去重
        assertTrue(editToImage.stream().anyMatch(m -> "gpt-image2".equals(m.get("id"))));
        assertTrue(editToImage.stream().noneMatch(m -> Boolean.TRUE.equals(m.get("verified")))); // 默认 qwen-image-2.0 不在独立网关清单
    }

    @Test void catalogFallsBackToMainImageToImageWhenNoOverride() {
        var chat = mock(org.springframework.ai.chat.client.ChatClient.class);
        when(chat.prompt()).thenThrow(new IllegalStateException("文本服务不可用"));
        var images = mock(ModelRouterImageClient.class);
        when(images.editGatewayConfigured()).thenReturn(false);
        when(images.listModels()).thenReturn(List.of("wan2.7-image-pro", "qwen-image-2.0"));
        var vision = mock(ModelRouterVisionClient.class);
        when(vision.defaultModel()).thenReturn("vision-test");
        var service = new ImagePipelineService(chat, images, vision, new ComplianceRuleLibrary());
        org.springframework.test.util.ReflectionTestUtils.setField(service, "qaScope", "all");
        org.springframework.test.util.ReflectionTestUtils.setField(service, "defaultImageModel", "wan2.7-image-pro");
        org.springframework.test.util.ReflectionTestUtils.setField(service, "defaultEditModel", "qwen-image-2.0");
        org.springframework.test.util.ReflectionTestUtils.setField(service, "defaultTextModel", "qwen3.7-max");
        var catalog = service.modelCatalog();
        assertTrue(Boolean.FALSE.equals(catalog.get("editGateway")));
        @SuppressWarnings("unchecked")
        List<java.util.Map<String, Object>> editToImage = (List<java.util.Map<String, Object>>) catalog.get("editToImage");
        assertEquals(1, editToImage.size());
        assertEquals("qwen-image-2.0", editToImage.getFirst().get("id"));
    }
}
