package com.onelaunch;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.HashMap;
import java.util.Locale;

@Component
public class ComplianceRuleLibrary {
    private static final Logger log = LoggerFactory.getLogger(ComplianceRuleLibrary.class);
    private static final Map<String, String> MARKET_ALIASES = Map.of("欧盟", "eu", "欧洲", "eu", "日本", "japan", "东南亚", "sea");
    private final Map<String, String> platforms;
    private final Map<String, String> markets;

    public ComplianceRuleLibrary() {
        platforms = load("platform");
        markets = load("market");
        for (String key : new String[]{"amazon", "tiktok-shop", "temu", "shopee"}) warnMissing(platforms, "platform", key);
        for (String key : new String[]{"us", "uk", "eu", "japan", "sea"}) warnMissing(markets, "market", key);
        log.info("合规规则知识库已加载：平台 {} 份，市场 {} 份", platforms.size(), markets.size());
    }

    public String platformRule(String platform) {
        return get(platforms, "platform", slug(platform), "平台规范：保持商品清晰完整，避免水印、误导性文字和无法核实的声明。");
    }

    public String marketRule(String market) {
        return get(markets, "market", marketKey(market), "市场广告规则：广告与商品展示应真实，功效、比较、价格和认证声明需有依据。");
    }

    public String source(String platform, String market) {
        return "平台规则 " + source(platforms, "platform", slug(platform))
                + " + 市场广告法 " + source(markets, "market", marketKey(market));
    }

    private String source(Map<String, String> rules, String group, String key) {
        return rules.containsKey(key) ? "compliance-rules/" + group + "/" + key + ".md" : group + " 内置兜底（规则文件缺失）";
    }

    private String get(Map<String, String> rules, String group, String key, String fallback) {
        warnMissing(rules, group, key);
        return rules.getOrDefault(key, fallback);
    }

    private void warnMissing(Map<String, String> rules, String group, String key) {
        if (!rules.containsKey(key)) log.warn("合规规则文件缺失或为空：{}/{}.md，使用内置兜底，需人工核实规则", group, key);
    }

    private String marketKey(String market) { return MARKET_ALIASES.getOrDefault(market == null ? "" : market.trim(), slug(market)); }
    private String slug(String value) { return value == null ? "" : value.trim().toLowerCase(Locale.ROOT).replace(' ', '-'); }

    private Map<String, String> load(String group) {
        Map<String, String> rules = new HashMap<>();
        try {
            Resource[] resources = new PathMatchingResourcePatternResolver().getResources("classpath*:compliance-rules/" + group + "/*.md");
            for (Resource resource : resources) {
                try {
                    String filename = resource.getFilename();
                    if (filename == null) continue;
                    String content = resource.getContentAsString(StandardCharsets.UTF_8).replaceAll("(?s)<!--.*?-->", "").trim();
                    if (!content.isBlank()) rules.put(filename.substring(0, filename.length() - 3), content);
                } catch (IOException | RuntimeException e) {
                    log.warn("合规规则读取失败：{}，使用内置兜底", resource.getFilename());
                }
            }
        } catch (IOException | RuntimeException e) {
            log.warn("合规规则目录读取失败：{}，使用内置兜底", group);
        }
        return Map.copyOf(rules);
    }
}
