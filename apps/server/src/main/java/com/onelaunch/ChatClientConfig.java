package com.onelaunch;

import org.springframework.ai.chat.client.ChatClient;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ChatClientConfig {
    @Bean
    ChatClient chatClient(TokenPlanChatModel model) {
        return ChatClient.create(model);
    }
}
