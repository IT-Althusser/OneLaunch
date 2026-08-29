package com.onelaunch;

import tools.jackson.databind.JsonNode;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Model Router /chat/completions 的 Spring AI ChatModel 实现（OpenAI 兼容协议）。
 * 文本对话（商品画像、提示词设计等）统一走此模型。
 */
@Component
public class TokenPlanChatModel implements ChatModel {
    private final RestClient client;
    private final String apiKey;
    private final String model;

    public TokenPlanChatModel(RestClient.Builder builder,
                              @Value("${model-router.base-url}") String baseUrl,
                              @Value("${model-router.api-key:}") String apiKey,
                              @Value("${model-router.text-model:qwen3.7-max}") String model) {
        this.client = builder.baseUrl(baseUrl).build();
        this.apiKey = apiKey;
        this.model = model;
    }

    @Override
    public ChatResponse call(Prompt prompt) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException("MODEL_ROUTER_API_KEY 未配置");
        }
        List<Map<String, Object>> messages = new ArrayList<>();
        for (Message message : prompt.getInstructions()) {
            messages.add(Map.of("role", role(message), "content", message.getText()));
        }
        Map<String, Object> body = new HashMap<>();
        body.put("model", model);
        body.put("messages", messages);
        body.put("stream", false);
        JsonNode response = client.post().uri("/chat/completions")
                .contentType(MediaType.APPLICATION_JSON)
                .header("Authorization", "Bearer " + apiKey)
                .body(body)
                .retrieve()
                .body(JsonNode.class);
        String text = response == null ? "" : response.path("choices").path(0).path("message").path("content").asText("");
        return new ChatResponse(List.of(new Generation(new AssistantMessage(text))));
    }

    private String role(Message message) {
        return switch (message.getMessageType().name()) {
            case "SYSTEM" -> "system";
            case "ASSISTANT" -> "assistant";
            default -> "user";
        };
    }
}
