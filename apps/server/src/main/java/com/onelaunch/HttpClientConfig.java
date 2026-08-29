package com.onelaunch;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.time.Duration;

@Configuration
public class HttpClientConfig {

    /**
     * 统一的 RestClient 构建器：读取 model-router.timeout-seconds 作为读写超时，
     * 所有 Model Router 客户端共用，避免慢请求无限挂起。
     */
    @Bean
    RestClient.Builder restClientBuilder(@Value("${model-router.timeout-seconds:120}") int timeoutSeconds) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(10));
        factory.setReadTimeout(Duration.ofSeconds(timeoutSeconds));
        return RestClient.builder().requestFactory(factory);
    }
}
