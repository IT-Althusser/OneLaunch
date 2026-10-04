package com.onelaunch;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 合规规则知识库：加载 resources/compliance-rules/{platform|market}/*.md，解析为结构化条目。
 *
 * 文件格式（2026-10 起）：`## 节名`（通用/白底图/场景图/模特图/对比图/尺寸图）分节，
 * 条目 `- 【id】硬性：内容` 或 `- 【id】风格：内容`；无 `##` 的旧扁平格式整文件视为"通用硬性"（兼容回退）。
 * 主客观分离红线：`硬性` 条目进入生成端与质检端；`风格` 条目只进生成端，永不作为质检判罚依据。
 * 市场维度当前仅覆盖"图片可见的客观违规"（绝对化文字/禁用标志等），看不见的宣称/定价不判。
 * 来源注释 `<!-- 来源：... -->` 剥离后不入提示词；缺失文件使用内置兜底并告警。
 */
@Component
public class ComplianceRuleLibrary {
    private static final Logger log = LoggerFactory.getLogger(ComplianceRuleLibrary.class);
    private static final Map<String, String> MARKET_ALIASES = Map.of("欧盟", "eu", "欧洲", "eu", "日本", "japan", "东南亚", "sea");
    private static final Pattern ID_PREFIX = Pattern.compile("^【([^】]+)】\\s*");
    private static final String GENERIC_PLATFORM_FALLBACK = "平台规范：保持商品清晰完整，避免水印、误导性文字和无法核实的声明。";

    /** 单条规则：id（可空）+ hard（硬性=生成与质检两端；风格=仅生成端）+ 内容。 */
    public record Rule(String id, boolean hard, String text) {}

    private final Map<String, Map<String, List<Rule>>> platforms;
    private final Map<String, Map<String, List<Rule>>> markets;
    private final Map<String, String> platformFiles;
    private final Map<String, String> marketFiles;

    public ComplianceRuleLibrary() {
        platformFiles = loadFiles("platform");
        marketFiles = loadFiles("market");
        platforms = loadRules(platformFiles);
        markets = loadRules(marketFiles);
        for (String key : new String[]{"amazon", "tiktok-shop", "temu", "shopee"}) warnMissing(platformFiles, "platform", key);
        for (String key : new String[]{"us", "uk", "eu", "japan", "sea"}) warnMissing(marketFiles, "market", key);
        log.info("合规规则知识库已加载：平台 {} 份，市场 {} 份", platformFiles.size(), marketFiles.size());
    }

    /** 平台硬性规则块（指定图类 + 通用节）：生成端与质检端共用，两端条款 id 必须一致。 */
    public String platformHardBlock(String platform, String type) {
        if (!platformFiles.containsKey(slug(platform))) return GENERIC_PLATFORM_FALLBACK;
        return render(collect(platforms, slug(platform), type, true));
    }

    /** 平台风格规则块（指定图类，仅生成端）：无内容返回空串。 */
    public String platformStyleBlock(String platform, String type) {
        if (!platformFiles.containsKey(slug(platform))) return "";
        return render(collect(platforms, slug(platform), type, false));
    }

    /** 市场硬性规则块（仅图片可见客观违规）：无内容返回空串（内容后置，填 md 即生效）。 */
    public String marketHardBlock(String market) {
        return render(collect(markets, marketKey(market), "通用", true));
    }

    public String source(String platform, String market) {
        return "平台规则 " + source(platformFiles, "platform", slug(platform))
                + " + 市场广告法 " + source(marketFiles, "market", marketKey(market));
    }

    /** 平台规则文件是否已入库（供诊断与测试）。 */
    public boolean hasPlatform(String platform) { return platformFiles.containsKey(slug(platform)); }

    private List<Rule> collect(Map<String, Map<String, List<Rule>>> rules, String key, String type, boolean hard) {
        Map<String, List<Rule>> sections = rules.get(key);
        if (sections == null) return List.of();
        List<Rule> result = new ArrayList<>();
        for (String section : new String[]{"通用", type}) {
            List<Rule> sectionRules = sections.get(section);
            if (sectionRules == null) continue;
            for (Rule rule : sectionRules) {
                if (rule.hard() == hard) result.add(rule);
            }
        }
        return result;
    }

    private String render(List<Rule> rules) {
        if (rules.isEmpty()) return "";
        StringBuilder sb = new StringBuilder();
        for (Rule rule : rules) {
            if (sb.length() > 0) sb.append("\n");
            sb.append(rule.id() == null ? "- " : "【" + rule.id() + "】").append(rule.text());
        }
        return sb.toString();
    }

    /** 解析单文件为 分节 → 规则列表；无 `##` 的旧扁平格式整文件归入"通用"且视为硬性。 */
    private Map<String, List<Rule>> parse(String content) {
        Map<String, List<Rule>> sections = new LinkedHashMap<>();
        String current = "通用";
        for (String rawLine : content.split("\\r?\\n")) {
            String line = rawLine.trim();
            if (line.startsWith("## ")) {
                current = line.substring(3).trim();
                continue;
            }
            if (!line.startsWith("- ")) continue;
            String text = line.substring(2).trim();
            String id = null;
            Matcher matcher = ID_PREFIX.matcher(text);
            if (matcher.find()) {
                id = matcher.group(1);
                text = text.substring(matcher.end()).trim();
            }
            boolean hard = true;
            if (text.startsWith("硬性：")) {
                text = text.substring(3).trim();
            } else if (text.startsWith("风格：")) {
                hard = false;
                text = text.substring(3).trim();
            }
            if (!text.isBlank()) {
                sections.computeIfAbsent(current, k -> new ArrayList<>()).add(new Rule(id, hard, text));
            }
        }
        return sections;
    }

    private String source(Map<String, String> files, String group, String key) {
        return files.containsKey(key) ? "compliance-rules/" + group + "/" + key + ".md" : group + " 内置兜底（规则文件缺失）";
    }

    private void warnMissing(Map<String, String> files, String group, String key) {
        if (!files.containsKey(key)) log.warn("合规规则文件缺失或为空：{}/{}.md，使用内置兜底，需人工核实规则", group, key);
    }

    private String marketKey(String market) { return MARKET_ALIASES.getOrDefault(market == null ? "" : market.trim(), slug(market)); }
    private String slug(String value) { return value == null ? "" : value.trim().toLowerCase(Locale.ROOT).replace(' ', '-'); }

    /** 扫描目录：文件名 → 剥离来源注释后的正文（空文件跳过并告警）。 */
    private Map<String, String> loadFiles(String group) {
        Map<String, String> files = new HashMap<>();
        try {
            Resource[] resources = new PathMatchingResourcePatternResolver().getResources("classpath*:compliance-rules/" + group + "/*.md");
            for (Resource resource : resources) {
                try {
                    String filename = resource.getFilename();
                    if (filename == null) continue;
                    String content = resource.getContentAsString(StandardCharsets.UTF_8).replaceAll("(?s)<!--.*?-->", "").trim();
                    if (!content.isBlank()) files.put(filename.substring(0, filename.length() - 3), content);
                } catch (IOException | RuntimeException e) {
                    log.warn("合规规则读取失败：{}，使用内置兜底", resource.getFilename());
                }
            }
        } catch (IOException | RuntimeException e) {
            log.warn("合规规则目录读取失败：{}，使用内置兜底", group);
        }
        return Map.copyOf(files);
    }

    private Map<String, Map<String, List<Rule>>> loadRules(Map<String, String> files) {
        Map<String, Map<String, List<Rule>>> rules = new HashMap<>();
        files.forEach((key, content) -> rules.put(key, Map.copyOf(parse(content))));
        return Map.copyOf(rules);
    }
}
