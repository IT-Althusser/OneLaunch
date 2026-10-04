package com.onelaunch;

import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;
import java.util.List;
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
                && prompt.contains("资料未提供某字段本身不是违规") && prompt.contains("透明披露本身不是违规")));
    }

    @Test void missingFactsAndUnreadableMarksAreExplicitlyNonBlocking() {
        var client = client();
        String prompt = client.compliancePrompt("白底图", "Amazon", false, "US");
        assertTrue(prompt.contains("资料未提供某属性且图片也未声明时不构成问题"));
        assertTrue(prompt.contains("无法逐字读出的痕迹"));
        assertTrue(prompt.contains("轻微阴影"));
    }

    @Test void referenceImagePromptCarriesFidelityCheckAndExclusions() {
        var client = client();
        String withRef = client.compliancePrompt("白底图", "Amazon", true, "US");
        assertTrue(withRef.contains("第一张是商品原始参考图"));
        assertTrue(withRef.contains("B 商品本体一致性"));
        assertTrue(withRef.contains("水滴、冰块、闪光、亮片"));
        assertTrue(withRef.contains("不得缺失参考图上存在的部件"));
        assertTrue(withRef.contains("看不见的宣称/定价/见证类广告问题（市场法规仅限上述画面可见硬性要求）"));
        String withoutRef = client.compliancePrompt("白底图", "Amazon", false, "US");
        assertTrue(withoutRef.contains("本次未提供参考图，跳过"));
        assertFalse(withoutRef.contains("第一张是商品原始参考图"));
    }

    @Test void passingResultCarriesReasonsAndLegacyModelOutputGetsSafeFallback() {
        var client = client();
        var explicit = client.parseCompliance("""
                {"passed":true,"summary":"符合要求","issues":[],"suggestedPrompt":"","passReasons":["主体完整","未见误导性文字"]}
                """, "test");
        assertEquals(List.of("主体完整", "未见误导性文字"), explicit.passReasons());
        var legacy = client.parseCompliance("""
                {"passed":true,"summary":"符合要求","issues":[],"suggestedPrompt":""}
                """, "test");
        assertFalse(legacy.passReasons().isEmpty());
    }

    @Test void realViolationIsNotRetriedInSearchOfPassAndInconsistentPassIsRejected() {
        var client = client();
        doReturn(FAILED).when(client).analyze(any(), eq(URL), anyString());
        assertFalse(client.complianceCheck(null, URL, "尺寸图", "Amazon", "US").passed());
        verify(client, times(1)).analyze(any(), eq(URL), anyString());
        assertFalse(client.parseCompliance(FAILED.replace("\"passed\":false", "\"passed\":true"), "test").passed());
    }
}
