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
 * Model Router 视觉理解客户端（内容理解与合规检测）。
 *
 * 2026-08-30 实测结论（与 /v1/models 清单表现不同，勿以清单无 vl 字样误判）：
 * - 网关文本模型中的 qwen3.6-plus / qwen3.6-flash（大赛 126 清单内）实为多模态视觉模型，
 *   messages content 数组用 OpenAI 嵌套格式 {type:"image_url", image_url:{url}} 传图；
 * - qwen3.7-max 为纯文本（任何格式传图均报错），网关其余 qwen3.7-plus / qwen3.8-* 视觉可用但不在 126 清单内，不作选型；
 * - image_url 同时接受公网 URL 与 data:image/...;base64（本地直传），图片宽高必须大于 10px；
 * - enable_thinking:false 可关闭思维链，响应 choices[0].message.content 为纯字符串（thinking 时进 reasoning_content）；
 * - /v1/models 清单不体现视觉能力（无 vl 字样模型），可用性以本客户端实测清单为准。
 */
@Component
public class ModelRouterVisionClient {
    /** 126 清单内、且经网关实测具备视觉理解能力的模型（选型红线：只在此清单内选）。 */
    public static final List<String> VISION_CAPABLE_MODELS = List.of("qwen3.6-plus", "qwen3.6-flash");
    public static final String DEFAULT_VISION_MODEL = "qwen3.6-plus";

    private final RestClient restClient;
    private final String apiKey;
    private final String visionModel;

    public ModelRouterVisionClient(
            RestClient.Builder builder,
            @Value("${model-router.base-url}") String baseUrl,
            @Value("${model-router.api-key:}") String apiKey,
            @Value("${model-router.vision-model:qwen3.6-plus}") String visionModel) {
        this.restClient = builder.baseUrl(baseUrl).build();
        this.apiKey = apiKey;
        this.visionModel = visionModel;
    }

    public String defaultModel() {
        return visionModel;
    }

    /** 网关模型 ID 是否具备视觉理解能力（实测清单）。 */
    public static boolean isVisionCapable(String modelId) {
        return modelId != null && VISION_CAPABLE_MODELS.contains(modelId);
    }

    /** 单次视觉审核结果。suggestedPrompt 为未通过时的修复提示词样例（符合平台规范，可直接重生成）。 */
    public record QcResult(boolean passed, List<String> issues, String summary, String suggestedPrompt) {}

    /**
     * 白底图质检：白底纯净度、商品完整清晰、水印文字与跨境合规元素（敏感内容/侵权标识），
     * 视觉模型输出结构化 JSON（未通过时附带修复提示词样例），解析失败抛异常由调用方降级人工复检。
     */
    public QcResult qcWhiteBackground(String modelOverride, String imageUrl, String platform) {
        String instruction = """
                你是跨境电商平台（%s）的上架图审核专家。请审核这张白底主图，逐项检查：
                1. 白底合规：背景是否为纯白，无阴影色块、无场景元素、无拼图拼接；
                2. 商品完整：商品居中清晰、无截断、无变形伪影；
                3. 违规元素：是否出现水印、二维码、联系电话、敏感或违禁内容、品牌侵权标识；
                4. 文字干扰：主图上是否出现促销文字或与商品无关的字符。
                只输出 JSON，不要 markdown 代码块，结构：
                {"passed":true,"summary":"一句话结论","issues":["未通过项，最多 4 条"],"suggestedPrompt":"中文修正提示词"}
                有任一项未通过则 passed 为 false 且 issues 不为空；此时 suggestedPrompt 必须给出一份可直接重新生成的中文提示词：
                在描述同一商品的前提下，明确修复 issues 中的每个问题（如 纯白无缝背景 RGB 255、无阴影、无文字无水印、无 logo、商品居中占画面 85%%）。
                通过时 suggestedPrompt 填空字符串。
                """.formatted(platform == null || platform.isBlank() ? "Amazon" : platform);
        String raw = analyze(modelOverride, imageUrl, instruction);
        String json = raw == null ? "" : raw.replaceAll("(?s)```(?:json)?", "").trim();
        int start = json.indexOf('{');
        int end = json.lastIndexOf('}');
        if (start < 0 || end <= start) throw new IllegalStateException("视觉质检未返回 JSON：" + truncate(raw));
        JsonNode root = JSON_MAPPER.readTree(json.substring(start, end + 1));
        List<String> issues = new ArrayList<>();
        root.path("issues").forEach(i -> {
            String t = i.asText("");
            if (!t.isBlank()) issues.add(t);
        });
        boolean passed = root.path("passed").asBoolean(true) && issues.isEmpty();
        String summary = root.path("summary").asText("");
        if (summary.isBlank()) summary = passed ? "白底合规、商品完整、无违规元素" : "存在待处理问题项";
        return new QcResult(passed, issues, summary, root.path("suggestedPrompt").asText(""));
    }

    /** 视觉理解调用：图片（公网 URL 或 base64 data URL）+ 指令，返回 content 文本。 */
    public String analyze(String modelOverride, String imageUrl, String instruction) {
        requireKey();
        String model = modelOverride == null || modelOverride.isBlank() ? visionModel : modelOverride.trim();
        Map<String, Object> body = Map.of(
                "model", model,
                "enable_thinking", false,
                "messages", List.of(Map.of("role", "user", "content", List.of(
                        Map.of("type", "image_url", "image_url", Map.of("url", imageUrl)),
                        Map.of("type", "text", "text", instruction)))));
        JsonNode response = restClient.post()
                .uri("/chat/completions")
                .contentType(MediaType.APPLICATION_JSON)
                .header("Authorization", "Bearer " + apiKey)
                .body(body)
                .retrieve()
                .body(JsonNode.class);
        JsonNode message = response == null ? null : response.path("choices").path(0).path("message");
        String text = message.path("content").asText("");
        if (text.isBlank() && message.path("content").isArray()) {
            StringBuilder sb = new StringBuilder();
            message.path("content").forEach(part -> {
                String t = part.path("text").asText("");
                if (!t.isBlank()) sb.append(t);
            });
            text = sb.toString();
        }
        if (text.isBlank()) {
            throw new IllegalStateException("视觉模型未返回内容，响应可能是错误或网关变更：" + truncate(response == null ? "" : response.toString()));
        }
        return text;
    }

    private static final tools.jackson.databind.json.JsonMapper JSON_MAPPER = tools.jackson.databind.json.JsonMapper.builder().build();

    private String truncate(String text) {
        if (text == null) return "";
        return text.length() > 300 ? text.substring(0, 300) + "…" : text;
    }

    private void requireKey() {
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException("MODEL_ROUTER_API_KEY 未配置");
        }
    }
}
