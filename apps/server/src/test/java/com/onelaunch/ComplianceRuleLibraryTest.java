package com.onelaunch;

import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import static org.junit.jupiter.api.Assertions.*;

class ComplianceRuleLibraryTest {
    @Test void loadsKnownRulesAndIgnoresSourceComments() {
        var library = new ComplianceRuleLibrary();
        assertTrue(library.platformRule("Amazon").contains("纯白背景"));
        assertTrue(library.marketRule("日本").contains("景品表示法"));
        assertFalse(library.marketRule("日本").contains("<!--"));
        assertTrue(library.marketRule("missing-market").contains("真实"));
        assertTrue(library.source("missing-platform", "missing-market").contains("内置兜底"));
    }

    @Test void addingAndRemovingRuleFileChangesPromptAfterReload() throws Exception {
        // 检测范围收窄后仅平台规则注入 prompt（市场广告规则退出判定），热加载验证改用 platform 文件
        Path rule = Path.of("target/classes/compliance-rules/platform/reload-test.md");
        assertFalse(Files.exists(rule));
        try {
            Files.writeString(rule, "<!-- test source -->\n- 测试规则第一版", StandardCharsets.UTF_8);
            assertTrue(client(new ComplianceRuleLibrary()).compliancePrompt("场景图", "reload-test", false).contains("测试规则第一版"));
            Files.writeString(rule, "<!-- test source -->\n- 测试规则第二版", StandardCharsets.UTF_8);
            assertTrue(client(new ComplianceRuleLibrary()).compliancePrompt("场景图", "reload-test", false).contains("测试规则第二版"));
            Files.delete(rule);
            assertTrue(client(new ComplianceRuleLibrary()).compliancePrompt("场景图", "reload-test", false).contains("平台规范：保持商品清晰完整"));
        } finally { Files.deleteIfExists(rule); }
    }

    private ModelRouterVisionClient client(ComplianceRuleLibrary library) { return new ModelRouterVisionClient(RestClient.builder().requestFactory(new org.springframework.http.client.SimpleClientHttpRequestFactory()), "https://example.test", "", "vision-test", library); }
}
