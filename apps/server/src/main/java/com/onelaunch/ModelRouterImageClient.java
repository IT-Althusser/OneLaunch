package com.onelaunch;

import tools.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Model Router 图片客户端（Token Plan 实测验证的调用方式）。
 *
 * Token Plan 网关与官方文档的差异（实测结论）：
 * - /images/generations 直接返回 400 "url error"，不可用；
 * - 异步请求头 X-DashScope-Async 被 403 拒绝（"does not support asynchronous calls"）；
 * - 图片生成/编辑统一走 POST /chat/completions 的多模态 content 数组：
 *   文生图：[{type:"text", text:prompt}]，模型 wan2.7-image-pro；
 *   图生图：[{type:"image", image:url}, {type:"text", text:prompt}]，模型 qwen-image-2.0
 *   （注意图片 part 是 type=image + image=url 扁平字段，不是 OpenAI 的 image_url 嵌套格式）。
 * - 图片模型响应包在 output.choices 下，content 为数组，元素含 {image: url}。
 */
@Component
public class ModelRouterImageClient {
    private final RestClient restClient;
    private final String apiKey;
    private final String imageModel;
    private final String editModel;

    public ModelRouterImageClient(
            RestClient.Builder builder,
            @Value("${model-router.base-url}") String baseUrl,
            @Value("${model-router.api-key:}") String apiKey,
            @Value("${model-router.image-model:wan2.7-image-pro}") String imageModel,
            @Value("${model-router.edit-model:qwen-image-2.0}") String editModel) {
        this.restClient = builder.baseUrl(baseUrl).build();
        this.apiKey = apiKey;
        this.imageModel = imageModel;
        this.editModel = editModel;
    }

    /** 一次图片调用的结果：URL 列表 + 网关报告的实际尺寸。 */
    public record ImageResult(List<String> urls, String size) {
        public boolean isEmpty() { return urls == null || urls.isEmpty(); }
    }

    /** 文生图。 */
    public ImageResult generateImage(String prompt) {
        return postImageChat(imageModel, List.of(Map.of("type", "text", "text", prompt)));
    }

    /** 图生图编辑（本地化替换）：源图 + 文本指令。 */
    public ImageResult editImage(String prompt, String sourceUrl) {
        List<Map<String, Object>> parts = new ArrayList<>();
        parts.add(Map.of("type", "image", "image", sourceUrl));
        parts.add(Map.of("type", "text", "text", prompt));
        return postImageChat(editModel, parts);
    }

    private ImageResult postImageChat(String model, List<Map<String, Object>> contentParts) {
        requireKey();
        Map<String, Object> body = Map.of(
                "model", model,
                "messages", List.of(Map.of("role", "user", "content", contentParts)));
        JsonNode response = restClient.post()
                .uri("/chat/completions")
                .contentType(MediaType.APPLICATION_JSON)
                .header("Authorization", "Bearer " + apiKey)
                .body(body)
                .retrieve()
                .body(JsonNode.class);
        JsonNode choices = response == null ? null : response.path("choices");
        if (choices == null || choices.isMissingNode() || !choices.isArray() || choices.isEmpty()) {
            choices = response == null ? null : response.path("output").path("choices");
        }
        if (choices == null || choices.isMissingNode() || !choices.isArray() || choices.isEmpty()) {
            throw new IllegalStateException("Model Router 未返回 choices，响应可能是错误或网关变更：" + response);
        }
        JsonNode content = choices.path(0).path("message").path("content");
        List<String> urls = extractImageUrls(content);
        if (urls.isEmpty()) {
            throw new IllegalStateException("Model Router 未返回图片 URL，content=" + content);
        }
        return new ImageResult(urls, extractSize(response));
    }

    /** content 为数组，元素形如 {type:"image", image:url}。 */
    private List<String> extractImageUrls(JsonNode content) {
        List<String> urls = new ArrayList<>();
        if (content == null || content.isMissingNode() || !content.isArray()) return urls;
        for (JsonNode part : content) {
            String url = part.path("image").asText("");
            if (url.isBlank()) url = part.path("image_url").path("url").asText("");
            if (!url.isBlank()) urls.add(url);
        }
        return urls;
    }

    /** usage.size 为 "2048*2048" 形态；i2i 为 width/height 整数。 */
    private String extractSize(JsonNode response) {
        JsonNode usage = response.path("usage");
        String size = usage.path("size").asText("");
        if (!size.isBlank()) return size;
        int width = usage.path("width").asInt(0);
        int height = usage.path("height").asInt(0);
        return width > 0 && height > 0 ? width + "x" + height : "1024x1024";
    }

    private void requireKey() {
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException("MODEL_ROUTER_API_KEY 未配置");
        }
    }
}
