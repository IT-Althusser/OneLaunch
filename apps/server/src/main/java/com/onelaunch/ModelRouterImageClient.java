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
 *   图生图：[{type:"image", image:url}...,{type:"text", text:prompt}]，模型 qwen-image-2.0
 *   （图片 part 是 type=image + image=url 扁平字段，不是 OpenAI 的 image_url 嵌套格式）。
 * - 2026-08-30 实测：image 字段同时接受公网 URL 与 data:image/...;base64,xxx（本地上传直传），
 *   且一次调用可传多张参考图。
 * - 图片模型响应包在 output.choices 下，content 为数组，元素含 {image: url}。
 */
@Component
public class ModelRouterImageClient {
    /** 单次调用参考图上限，防止请求体过大。 */
    public static final int MAX_REFERENCE_IMAGES = 6;

    private final RestClient restClient;
    private final RestClient editRestClient; // 图生图独立网关（未配置 edit-base-url 时与 restClient 相同）
    private final boolean editGateway;       // 显式记录覆盖状态（客户端引用比对不可靠）
    private final String apiKey;
    private final String editApiKey;
    private final String imageModel;
    private final String editModel;
    private String editApiStyle;             // 图生图请求格式：chat（Token Plan /chat/completions，默认）| openai-images（OpenAI Images API /images/edits，multipart）；非 final 仅为测试注入

    /**
     * Spring 主构造器。editBaseUrl/editApiKey 非空时，图生图（editImage，含修复轮与本地化）改走独立网关——用于诊断对比；
     * 比赛红线：交付配置不得设置该覆盖，所有调用必须走 Token Plan Model Router（CLAUDE.md 红线 2）。
     * 独立地址在启动时做公网 http(s) 校验（拒绝 localhost/环回/私有/保留地址），不合法直接启动失败。
     * editApiStyle：独立网关的请求格式（chat=Token Plan 风格 /chat/completions；openai-images=OpenAI Images API /images/edits）。
     */
    @org.springframework.beans.factory.annotation.Autowired
    public ModelRouterImageClient(
            RestClient.Builder builder,
            @Value("${model-router.base-url}") String baseUrl,
            @Value("${model-router.api-key:}") String apiKey,
            @Value("${model-router.image-model:wan2.7-image-pro}") String imageModel,
            @Value("${model-router.edit-model:qwen-image-2.0}") String editModel,
            @Value("${model-router.edit-base-url:}") String editBaseUrl,
            @Value("${model-router.edit-api-key:}") String editApiKey,
            @Value("${model-router.edit-api-style:chat}") String editApiStyle) {
        this.restClient = builder.baseUrl(baseUrl).build();
        this.apiKey = apiKey;
        this.imageModel = imageModel;
        this.editModel = editModel;
        this.editApiStyle = editApiStyle == null ? "chat" : editApiStyle.trim().toLowerCase();
        if (editBaseUrl == null || editBaseUrl.isBlank()) {
            this.editRestClient = this.restClient;
            this.editApiKey = apiKey;
            this.editGateway = false;
        } else {
            validatePublicHttpUrl(editBaseUrl.trim());
            this.editRestClient = builder.baseUrl(editBaseUrl.trim()).build();
            this.editApiKey = editApiKey == null || editApiKey.isBlank() ? apiKey : editApiKey.trim();
            this.editGateway = true;
        }
    }

    /** 测试便利构造器：未配置图生图网关覆盖。 */
    public ModelRouterImageClient(
            RestClient.Builder builder,
            String baseUrl,
            String apiKey,
            String imageModel,
            String editModel) {
        this(builder, baseUrl, apiKey, imageModel, editModel, "", "", "chat");
    }

    /** 网关地址校验：仅 http/https，主机必须为可解析的公网地址，拒绝 localhost/环回/私有/链路本地/保留地址。 */
    static void validatePublicHttpUrl(String url) {
        java.net.URI uri;
        try {
            uri = java.net.URI.create(url.trim());
        } catch (RuntimeException e) {
            throw new IllegalArgumentException("网关地址无效：" + url);
        }
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase();
        if (!scheme.equals("http") && !scheme.equals("https")) {
            throw new IllegalArgumentException("网关地址仅允许 http/https：" + url);
        }
        String host = uri.getHost();
        if (host == null || host.isBlank()) throw new IllegalArgumentException("网关地址缺少主机名：" + url);
        String h = host.toLowerCase();
        if (h.equals("localhost") || h.endsWith(".localhost") || h.endsWith(".local") || h.equals("0.0.0.0")) {
            throw new IllegalArgumentException("网关地址不允许本机/保留主机名：" + host);
        }
        if (h.startsWith("[") && h.endsWith("]")) h = h.substring(1, h.length() - 1); // IPv6 字面量
        try {
            java.net.InetAddress addr = java.net.InetAddress.getByName(h);
            byte[] ip = addr.getAddress();
            boolean ipv6Ula = ip.length == 16 && (ip[0] & 0xfe) == 0xfc; // IPv6 唯一本地地址 fc00::/7（标准标记不覆盖）
            if (ipv6Ula || addr.isLoopbackAddress() || addr.isSiteLocalAddress() || addr.isLinkLocalAddress()
                    || addr.isAnyLocalAddress() || addr.isMulticastAddress()) {
                throw new IllegalArgumentException("网关地址不允许环回/私有/保留 IP：" + host);
            }
        } catch (java.net.UnknownHostException e) {
            throw new IllegalArgumentException("网关主机无法解析：" + host);
        }
    }

    /** 一次图片调用的结果：URL 列表 + 网关报告的实际尺寸。 */
    public record ImageResult(List<String> urls, String size) {
        public boolean isEmpty() { return urls == null || urls.isEmpty(); }
    }

    /** 文生图（可用模型覆盖）：始终走主网关（Token Plan）。 */
    public ImageResult generateImage(String prompt, String modelOverride) {
        return postImageChat(restClient, apiKey, model(modelOverride, imageModel), List.of(Map.of("type", "text", "text", prompt)));
    }

    /** 图生图编辑（本地化替换）：源图 + 文本指令，默认路由（主网关）。 */
    public ImageResult editImage(String prompt, String sourceUrl, String modelOverride) {
        return editImage(prompt, List.of(sourceUrl), modelOverride, false);
    }

    /** 图生图编辑（本地化替换）：显式指定网关路由。 */
    public ImageResult editImage(String prompt, String sourceUrl, String modelOverride, boolean customGateway) {
        return editImage(prompt, List.of(sourceUrl), modelOverride, customGateway);
    }

    /**
     * 参考图生成/编辑：多张参考图（URL 或 base64 data URL）+ 文本指令。
     * 路由：customGateway=false 走主网关（Token Plan，比赛口径，chat 格式）；
     * true 走服务端预配置的自定义网关（未配置时抛可读异常），请求格式按 edit-api-style（chat / openai-images）。
     */
    public ImageResult editImage(String prompt, List<String> referenceImages, String modelOverride, boolean customGateway) {
        if (referenceImages == null || referenceImages.isEmpty()) {
            throw new IllegalArgumentException("图生图至少需要一张参考图");
        }
        if (customGateway) {
            if (!editGateway) {
                throw new IllegalArgumentException("自定义图生图网关未配置：请在服务端 .env 设置 MODEL_ROUTER_EDIT_BASE_URL / MODEL_ROUTER_EDIT_API_KEY 后重启");
            }
            if ("openai-images".equals(editApiStyle)) {
                return postImageEditMultipart(model(modelOverride, editModel), referenceImages, prompt);
            }
            List<Map<String, Object>> parts = new ArrayList<>();
            referenceImages.forEach(ApiErrors::requireImage);
            referenceImages.stream().limit(MAX_REFERENCE_IMAGES).forEach(url ->
                    parts.add(Map.of("type", "image", "image", url)));
            parts.add(Map.of("type", "text", "text", prompt));
            return postImageChat(editRestClient, editApiKey, model(modelOverride, editModel), parts);
        }
        List<Map<String, Object>> parts = new ArrayList<>();
        referenceImages.forEach(ApiErrors::requireImage);
        referenceImages.stream().limit(MAX_REFERENCE_IMAGES).forEach(url ->
                parts.add(Map.of("type", "image", "image", url)));
        parts.add(Map.of("type", "text", "text", prompt));
        return postImageChat(restClient, apiKey, model(modelOverride, editModel), parts);
    }

    /**
     * OpenAI Images API 图生图编辑（POST /images/edits，multipart 上传参考图文件）：
     * gpt-image 系列等 OpenAI 风格模型不支持 /chat/completions（网关报 "This model is not supported on the
     * Chat Completions endpoint"），须走 images 端点；响应 data[].url 或 data[].b64_json 统一转为 data URL。
     */
    private ImageResult postImageEditMultipart(String model, List<String> referenceImages, String prompt) {
        if (editApiKey == null || editApiKey.isBlank()) {
            throw new IllegalStateException("MODEL_ROUTER_EDIT_API_KEY 未配置");
        }
        org.springframework.util.MultiValueMap<String, Object> form = new org.springframework.util.LinkedMultiValueMap<>();
        form.add("model", model);
        form.add("prompt", prompt);
        form.add("n", 1);
        List<String> refs = referenceImages.stream().limit(MAX_REFERENCE_IMAGES).toList();
        for (int i = 0; i < refs.size(); i++) {
            RefImage ref = decodeReference(refs.get(i));
            // 单图用字段名 image（兼容 one-api 等聚合网关）；多图用 image[]（OpenAI SDK 多图约定）
            String field = refs.size() == 1 ? "image" : "image[]";
            var headers = new org.springframework.http.HttpHeaders();
            headers.setContentType(ref.contentType().startsWith("image/") ? MediaType.parseMediaType(ref.contentType()) : MediaType.IMAGE_PNG);
            form.add(field, new org.springframework.http.HttpEntity<>(byteResource(ref.bytes(), "reference-" + i), headers));
        }
        JsonNode response = editRestClient.post()
                .uri("/images/edits")
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .header("Authorization", "Bearer " + editApiKey)
                .body(form)
                .retrieve()
                .body(JsonNode.class);
        JsonNode data = response == null ? null : response.path("data");
        List<String> urls = extractOpenAiImageUrls(data);
        if (urls.isEmpty()) {
            throw new IllegalStateException("图生图网关未返回图片，响应=" + response);
        }
        String size = data == null || data.isEmpty() || data.path(0).path("size").asText("").isBlank()
                ? "1024x1024" : data.path(0).path("size").asText();
        return new ImageResult(urls, size);
    }

    private record RefImage(byte[] bytes, String contentType) {}

    /** 参考图解码：data URL 本地解码（保留 MIME 类型），http(s) 走主网关同源拉取。 */
    private RefImage decodeReference(String url) {
        ApiErrors.requireImage(url);
        if (url.startsWith("data:image/")) {
            int comma = url.indexOf(',');
            if (comma <= 0 || comma + 1 >= url.length()) throw new IllegalArgumentException("参考图 data URL 无效");
            String meta = url.substring(5, comma);
            String contentType = meta.contains(";") ? meta.substring(0, meta.indexOf(';')) : meta;
            return new RefImage(java.util.Base64.getDecoder().decode(url.substring(comma + 1)), contentType);
        }
        FetchedImage fetched = fetchImage(url);
        return new RefImage(fetched.bytes(), fetched.contentType());
    }

    private org.springframework.core.io.ByteArrayResource byteResource(byte[] bytes, String name) {
        return new org.springframework.core.io.ByteArrayResource(bytes) {
            @Override
            public String getFilename() {
                return name + ".png";
            }
        };
    }

    /** OpenAI Images 响应解析：data[].url 直用，data[].b64_json 转 data URL。 */
    private List<String> extractOpenAiImageUrls(JsonNode data) {
        List<String> urls = new ArrayList<>();
        if (data == null || !data.isArray()) return urls;
        for (JsonNode part : data) {
            String url = part.path("url").asText("");
            if (url.isBlank()) {
                String b64 = part.path("b64_json").asText("");
                if (!b64.isBlank()) url = "data:image/png;base64," + b64;
            }
            if (!url.isBlank()) urls.add(url);
        }
        return urls;
    }

    /** GET /v1/models：网关实时可用模型 ID 列表（如 qwen3.7-max、wan2.7-image-pro…）。 */
    public List<String> listModels() {
        requireKey();
        JsonNode response = restClient.get()
                .uri("/models")
                .header("Authorization", "Bearer " + apiKey)
                .retrieve()
                .body(JsonNode.class);
        return extractModelIds(response);
    }

    /** 是否配置了图生图独立网关（edit-base-url）。 */
    public boolean editGatewayConfigured() {
        return editGateway;
    }

    /** GET /v1/models（图生图独立网关）：供前端图生图模型下拉；未配置覆盖时与主网关一致。 */
    public List<String> listEditModels() {
        if (!editGatewayConfigured()) return listModels();
        if (editApiKey == null || editApiKey.isBlank()) {
            throw new IllegalStateException("MODEL_ROUTER_EDIT_API_KEY 未配置");
        }
        JsonNode response = editRestClient.get()
                .uri("/models")
                .header("Authorization", "Bearer " + editApiKey)
                .retrieve()
                .body(JsonNode.class);
        return extractModelIds(response);
    }

    private List<String> extractModelIds(JsonNode response) {
        List<String> ids = new ArrayList<>();
        JsonNode data = response == null ? null : response.path("data");
        if (data != null && data.isArray()) {
            for (JsonNode node : data) {
                String id = node.path("id").asText("");
                if (!id.isBlank()) ids.add(id);
            }
        }
        return ids;
    }

    public record FetchedImage(String contentType, byte[] bytes) {}

    public ImageResult dimensionGuide(String sourceUrl, String facts) {
        ApiErrors.requireImage(sourceUrl);
        byte[] source = sourceUrl.startsWith("data:image/")
                ? java.util.Base64.getDecoder().decode(sourceUrl.substring(sourceUrl.indexOf(',') + 1))
                : fetchImage(sourceUrl).bytes();
        byte[] rendered = DimensionGuideRenderer.render(source, facts);
        return new ImageResult(List.of("data:image/png;base64," + java.util.Base64.getEncoder().encodeToString(rendered)), "1600x1200");
    }

    /** 同源代理拉取网关返回的图片（前端 canvas 裁切与下载需要同源）。仅允许 http(s) 地址。 */
    public FetchedImage fetchImage(String absoluteUrl) {
        if (absoluteUrl == null || !(absoluteUrl.startsWith("https://") || absoluteUrl.startsWith("http://"))) {
            throw new IllegalArgumentException("仅支持 http(s) 图片地址");
        }
        var entity = restClient.get()
                .uri(java.net.URI.create(absoluteUrl))
                .retrieve()
                .toEntity(byte[].class);
        String contentType = entity.getHeaders().getContentType() == null
                ? "image/png" : entity.getHeaders().getContentType().toString();
        return new FetchedImage(contentType, entity.getBody() == null ? new byte[0] : entity.getBody());
    }

    private String model(String override, String fallback) {
        return override == null || override.isBlank() ? fallback : override.trim();
    }

    private ImageResult postImageChat(RestClient client, String key, String model, List<Map<String, Object>> contentParts) {
        if (key == null || key.isBlank()) throw new IllegalStateException("网关 API Key 未配置（MODEL_ROUTER_API_KEY 或 MODEL_ROUTER_EDIT_API_KEY）");
        Map<String, Object> body = Map.of(
                "model", model,
                "messages", List.of(Map.of("role", "user", "content", contentParts)));
        JsonNode response = client.post()
                .uri("/chat/completions")
                .contentType(MediaType.APPLICATION_JSON)
                .header("Authorization", "Bearer " + key)
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
