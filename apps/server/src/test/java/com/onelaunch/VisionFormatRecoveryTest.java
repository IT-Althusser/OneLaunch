package com.onelaunch;

import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class VisionFormatRecoveryTest {
    private static final String URL = "https://example.test/product.png";
    private static final String FAILED = """
            {"passed":false,"summary":"图片有错误尺寸","issues":[{"dimension":"文字准确性","severity":"高","detail":"尺寸单位错误","suggestion":"删除错误标注并按实测值重做"}],"suggestedPrompt":"移除错误标注"}
            """;

    private ModelRouterVisionClient client() {
        return spy(new ModelRouterVisionClient(RestClient.builder()
                .requestFactory(new org.springframework.http.client.SimpleClientHttpRequestFactory()),
                "https://example.test", "", "qwen3.6-plus", new ComplianceRuleLibrary()));
    }

    @Test void malformedResultGetsOneSameImageFormatRecoveryWithoutDroppingIssue() {
        var client = client();
        doReturn("{\"passed\":false,\"summary\":\"尺寸单位错误\",\"issues\":[\"尺寸单位错误\"]}", FAILED)
                .when(client).analyze(any(), eq(URL), anyString());
        var result = client.complianceCheck(null, URL, "尺寸图", "Amazon", "US");
        assertFalse(result.passed());
        assertEquals("尺寸单位错误", result.complianceIssues().getFirst().detail());
        verify(client, times(2)).analyze(any(), eq(URL), anyString());
    }

    @Test void malformedAgainDoesNotTurnIntoPassOrLoop() {
        var client = client();
        doReturn("not json").when(client).analyze(any(), eq(URL), anyString());
        assertThrows(RuntimeException.class, () -> client.complianceCheck(null, URL, "场景图", "Amazon", "US"));
        verify(client, times(2)).analyze(any(), eq(URL), anyString());
    }

    @Test void formatRecoveryCannotErasePreviousFailure() {
        var client = client();
        doReturn("{\"passed\":false,\"summary\":\"错误\",\"issues\":[\"尺寸错误\"]}",
                "{\"passed\":true,\"summary\":\"通过\",\"issues\":[]}")
                .when(client).analyze(any(), eq(URL), anyString());
        assertThrows(IllegalStateException.class, () -> client.complianceCheck(null, URL, "尺寸图", "Amazon", "US"));
    }

    @Test void suppliedFactsReachReview() {
        var client = client();
        doReturn(FAILED).when(client).analyze(any(), eq(URL), anyString());
        client.complianceCheck(null, URL, "尺寸图", "Amazon", "US", "宽38cm");
        verify(client).analyze(any(), eq(URL), argThat(prompt -> prompt.contains("宽38cm")
                && prompt.contains("任何可识别品牌名") && prompt.contains("透明披露本身不是违规")));
    }

    @Test void realViolationIsNotRetriedInSearchOfPassAndInconsistentPassIsRejected() {
        var client = client();
        doReturn(FAILED).when(client).analyze(any(), eq(URL), anyString());
        assertFalse(client.complianceCheck(null, URL, "尺寸图", "Amazon", "US").passed());
        verify(client, times(1)).analyze(any(), eq(URL), anyString());
        assertFalse(client.parseCompliance(FAILED.replace("\"passed\":false", "\"passed\":true"), "test").passed());
    }
}
