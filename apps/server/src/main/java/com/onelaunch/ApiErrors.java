package com.onelaunch;

import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientResponseException;
import tools.jackson.databind.json.JsonMapper;

final class ApiErrors {
    private ApiErrors() {}

    static String message(Exception error) {
        if (error instanceof RestClientResponseException response) {
            String detail = response.getResponseBodyAsString();
            try {
                var root = JsonMapper.builder().build().readTree(detail);
                detail = root.path("error").path("message").asText(root.path("message").asText(detail));
            } catch (RuntimeException ignored) { /* 非 JSON 响应保留原文供排障。 */ }
            String hint = switch (response.getStatusCode().value()) {
                case 401, 403 -> "网关鉴权或额度受限，请检查 API Key 与套餐";
                case 429 -> "网关请求过多，请稍后重试";
                default -> "网关调用失败";
            };
            if (detail.contains("Download multimodal file")) hint = "网关无法读取图片，请上传本地图或使用网关生成的图片";
            return hint + "（" + response.getStatusCode().value() + "）：" + detail;
        }
        if (error instanceof ResourceAccessException) return "网络连接或响应超时，请检查网络与网关连接后重试";
        return error.getMessage() == null ? "服务暂时不可用，请稍后重试" : error.getMessage();
    }

    static void requireImage(String value) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException("请提供图片 URL 或上传本地图片");
        if (value.matches("(?s)^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=\\r\\n]+$")) return;
        try {
            var uri = java.net.URI.create(value);
            if (("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme())) && uri.getHost() != null) return;
        } catch (IllegalArgumentException ignored) { }
        throw new IllegalArgumentException("图片地址无效，请使用完整 http(s) 图片 URL 或上传 JPEG/PNG/WebP 图片");
    }
}
