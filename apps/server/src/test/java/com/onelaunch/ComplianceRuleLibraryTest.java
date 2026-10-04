package com.onelaunch;

import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import static org.junit.jupiter.api.Assertions.*;

class ComplianceRuleLibraryTest {
    @Test void parsesStructuredSectionsHardStyleAndIds() {
        var library = new ComplianceRuleLibrary();
        // 平台硬性块：通用节 + 图类节，条目带 id
        String whiteHard = library.platformHardBlock("Amazon", "白底图");
        assertTrue(whiteHard.contains("【AM-G1】"), () -> whiteHard);
        assertTrue(whiteHard.contains("纯白背景"));
        assertTrue(whiteHard.contains("【AM-W1】"));
        // 风格条目不进硬性块，硬性条目不进风格块
        assertFalse(whiteHard.contains("专业商业摄影的场景化生活方式图"));
        String style = library.platformStyleBlock("Amazon", "场景图");
        assertTrue(style.contains("专业商业摄影的场景化生活方式图"));
        assertFalse(style.contains("【AM-G1】"));
        // 其他图类节的风格条目不串味
        assertFalse(library.platformStyleBlock("Amazon", "白底图").contains("场景化生活方式"));
    }

    @Test void marketHardBlockServesSeedRulesAndFallsBackToEmpty() {
        var library = new ComplianceRuleLibrary();
        assertTrue(library.marketHardBlock("US").contains("【US-G1】"));
        assertTrue(library.marketHardBlock("日本").contains("優良誤認"));
        assertTrue(library.marketHardBlock("欧洲").contains("【EU-G1】")); // 别名表
        assertEquals("", library.marketHardBlock("missing-market")); // 缺失 → 空（不注入）
    }

    @Test void legacyFlatFormatTreatedAsGenericHardRules() throws Exception {
        Path legacy = Path.of("target/classes/compliance-rules/platform/legacy-flat.md");
        try {
            Files.writeString(legacy, "<!-- 来源：测试 -->\n- 旧格式规则甲\n- 旧格式规则乙", StandardCharsets.UTF_8);
            var library = new ComplianceRuleLibrary();
            String block = library.platformHardBlock("legacy-flat", "场景图");
            assertTrue(block.contains("旧格式规则甲") && block.contains("旧格式规则乙"), () -> block);
            assertEquals("", library.platformStyleBlock("legacy-flat", "场景图")); // 旧格式无风格概念
        } finally { Files.deleteIfExists(legacy); }
    }

    @Test void sourceReportingSurvivesNewFormat() {
        var library = new ComplianceRuleLibrary();
        assertTrue(library.source("Amazon", "US").contains("compliance-rules/platform/amazon.md"));
        assertTrue(library.source("missing-platform", "US").contains("内置兜底"));
    }

    @Test void addingAndRemovingRuleFileChangesPromptsAfterReload() throws Exception {
        // 热加载验证：新增/修改/删除平台规则文件后，新建实例的生成端块与质检端提示词同步变化
        Path rule = Path.of("target/classes/compliance-rules/platform/reload-test.md");
        assertFalse(Files.exists(rule));
        try {
            Files.writeString(rule, "## 通用\n- 【RT-G1】硬性：测试规则第一版", StandardCharsets.UTF_8);
            var first = new ComplianceRuleLibrary();
            assertTrue(first.platformHardBlock("reload-test", "白底图").contains("测试规则第一版"));
            assertTrue(client(first).compliancePrompt("场景图", "reload-test", false, "US").contains("测试规则第一版"));
            Files.writeString(rule, "## 通用\n- 【RT-G1】硬性：测试规则第二版", StandardCharsets.UTF_8);
            assertTrue(client(new ComplianceRuleLibrary()).compliancePrompt("场景图", "reload-test", false, "US").contains("测试规则第二版"));
            Files.delete(rule);
            assertTrue(client(new ComplianceRuleLibrary()).compliancePrompt("场景图", "reload-test", false, "US").contains("平台规范：保持商品清晰完整"));
        } finally { Files.deleteIfExists(rule); }
    }

    private ModelRouterVisionClient client(ComplianceRuleLibrary library) { return new ModelRouterVisionClient(RestClient.builder().requestFactory(new org.springframework.http.client.SimpleClientHttpRequestFactory()), "https://example.test", "", "vision-test", library); }
}
