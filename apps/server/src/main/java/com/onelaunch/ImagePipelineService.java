package com.onelaunch;

import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.prompt.ChatOptions;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

@Service
public class ImagePipelineService {
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(ImagePipelineService.class);
    private static final List<String> IMAGE_TYPES = List.of("白底图", "场景图", "模特图", "对比图", "尺寸图");
    private final ChatClient chatClient;
    private final ModelRouterImageClient imageClient;
    private final ModelRouterVisionClient visionClient;

    public ImagePipelineService(ChatClient chatClient, ModelRouterImageClient imageClient, ModelRouterVisionClient visionClient) {
        this.chatClient = chatClient;
        this.imageClient = imageClient;
        this.visionClient = visionClient;
    }

    /** 同步执行（兼容旧端点）：过程事件静默丢弃。 */
    public ApiModels.ImagePipelineResponse run(ApiModels.ImagePipelineRequest request) {
        return run(request, event -> { });
    }

    /**
     * 核心流水线：每一步通过 emit 实时推送事件（log=思考过程文字 / profile=画像 /
     * image_start、image_done、image_fail=单图进度 / done=完整结果）。
     */
    public ApiModels.ImagePipelineResponse run(ApiModels.ImagePipelineRequest request, Consumer<ApiModels.PipelineEvent> emit) {
        List<String> refs = sanitizeRefs(request.referenceImages());
        String productName = blankToDefault(request.productName(), "");
        String sellingPoints = blankToDefault(request.sellingPoints(), "");
        List<ApiModels.StepRecord> steps = new ArrayList<>();
        List<ApiModels.GeneratedImage> images = new ArrayList<>();
        List<ApiModels.QaRecord> qa = new ArrayList<>();
        List<String> platforms = request.platforms() == null || request.platforms().isEmpty()
                ? List.of("Amazon") : request.platforms();

        emit.accept(event("log", Map.of("text", "收到任务：" + (productName.isBlank() ? "（未填名称，按参考图生成）" : "《" + productName + "》")
                + "，参考图 " + refs.size() + " 张，目标平台：" + String.join(" / ", platforms))));

        // 商品画像：文本模型按文字信息构建；参考图不参与画像（图生图阶段直传参考图保持商品一致）
        String profile;
        if (!productName.isBlank() || !sellingPoints.isBlank()) {
            try {
                emit.accept(event("log", Map.of("text", "正在构建商品画像（文本模型：" + blankToDefault(request.textModel(), "默认 qwen3.7-max") + "）…")));
                profile = chat(profilePrompt(productName, sellingPoints, refs.size()), request.textModel());
                if (profile == null || profile.isBlank()) throw new IllegalStateException("商品画像为空");
                // 画像会拼进图片提示词：剥掉 markdown 加粗，避免 ** 符号污染生成提示词
                profile = profile.replace("**", "");
                steps.add(new ApiModels.StepRecord("商品图理解", "done", null));
                emit.accept(event("log", Map.of("text", "商品画像完成")));
                emit.accept(event("profile", Map.of("text", profile)));
            } catch (Exception e) {
                profile = "商品：" + productName + "；卖点：" + sellingPoints;
                steps.add(new ApiModels.StepRecord("商品图理解", "failed", "已降级为纯文本画像：" + safeMessage(e)));
                emit.accept(event("log", Map.of("text", "商品画像失败，已降级为纯文本画像：" + safeMessage(e))));
            }
        } else {
            profile = "商品以参考图为准（未提供文字信息），生成时严格保持参考图商品外观一致";
            steps.add(new ApiModels.StepRecord("商品图理解", "skipped", "无文字信息，按参考图生成"));
            emit.accept(event("log", Map.of("text", "未提供文字信息，跳过画像步骤，直接按参考图生成")));
        }

        for (String platform : platforms) {
            List<String> types = IMAGE_TYPES;
            int ok = 0;
            for (String type : types) {
                String prompt = buildPrompt(type, productName, profile, platform, refs);
                String route = refs.isEmpty() ? "文生图模型：" + blankToDefault(request.imageModel(), "默认 wan2.7-image-pro")
                        : "图生图模型：" + blankToDefault(request.editModel(), "默认 qwen-image-2.0") + "（参考 " + refs.size() + " 张图）";
                emit.accept(event("log", Map.of("text", "正在设计" + platform + "·" + type + "提示词，调用" + route + "…")));
                emit.accept(event("image_start", Map.of("type", type, "platform", platform, "prompt", prompt)));
                try {
                    ModelRouterImageClient.ImageResult result = refs.isEmpty()
                            ? imageClient.generateImage(prompt, request.imageModel())
                            : imageClient.editImage(prompt, refs, request.editModel());
                    if (!result.isEmpty()) {
                        ApiModels.GeneratedImage image = new ApiModels.GeneratedImage(type, platform, result.size(), result.urls().get(0));
                        images.add(image);
                        ok++;
                        emit.accept(event("log", Map.of("text", "✓ " + type + "（" + platform + "）已生成 · " + result.size())));
                        emit.accept(event("image_done", Map.of("type", type, "platform", platform,
                                "size", result.size(), "url", result.urls().get(0), "prompt", prompt)));
                    }
                } catch (Exception e) {
                    steps.add(new ApiModels.StepRecord(platform + " " + type + "生成", "failed", safeMessage(e)));
                    emit.accept(event("log", Map.of("text", "✗ " + type + "（" + platform + "）生成失败：" + safeMessage(e))));
                    emit.accept(event("image_fail", Map.of("type", type, "platform", platform, "error", safeMessage(e))));
                }
            }
            steps.add(new ApiModels.StepRecord(platform + " 图片生成（" + types.size() + " 类）", ok > 0 ? "done" : "failed", "成功 " + ok + "/" + types.size()));
        }

        // 白底图质检：视觉模型自动审核；未通过时给出修复提示词样例并自动重试一次；调用或解析失败降级为人工复检提醒
        String visionModel = blankToDefault(request.visionModel(), visionClient.defaultModel());
        for (int idx = 0; idx < images.size(); idx++) {
            ApiModels.GeneratedImage image = images.get(idx);
            if (!"白底图".equals(image.type())) continue;
            emit.accept(event("log", Map.of("text", "视觉质检白底图（" + visionModel + "）：" + image.platform() + " …")));
            try {
                ModelRouterVisionClient.QcResult qc = visionClient.qcWhiteBackground(visionModel, image.url(), image.platform());
                ApiModels.QaRecord record = new ApiModels.QaRecord(image.type(), image.url(), qc.passed(), qc.summary(), qc.issues(), visionModel, qc.suggestedPrompt());
                emit.accept(event("log", Map.of("text", qc.passed()
                        ? "✓ 白底图质检通过（" + image.platform() + "）：" + qc.summary()
                        : "△ 白底图质检未通过（" + image.platform() + "）：" + String.join("；", qc.issues()))));

                // 未通过且有修复提示词样例：自动按样例重试一次，二次质检结果为准
                if (!qc.passed() && qc.suggestedPrompt() != null && !qc.suggestedPrompt().isBlank()) {
                    emit.accept(event("log", Map.of("text", "质检未通过，已生成符合规范的修复提示词，自动重试一次…")));
                    try {
                        ModelRouterImageClient.ImageResult retry = imageClient.generateImage(qc.suggestedPrompt(), request.imageModel());
                        if (!retry.isEmpty()) {
                            ApiModels.GeneratedImage fixed = new ApiModels.GeneratedImage(image.type(), image.platform(), retry.size(), retry.urls().get(0));
                            images.set(idx, fixed);
                            emit.accept(event("image_done", Map.of("type", fixed.type(), "platform", fixed.platform(),
                                    "size", fixed.size(), "url", fixed.url(), "prompt", qc.suggestedPrompt())));
                            emit.accept(event("log", Map.of("text", "修复重试已生成（" + fixed.size() + "），二次质检中…")));
                            ModelRouterVisionClient.QcResult qc2 = visionClient.qcWhiteBackground(visionModel, fixed.url(), image.platform());
                            record = new ApiModels.QaRecord(fixed.type(), fixed.url(), qc2.passed(), qc2.summary(), qc2.issues(), visionModel, qc2.suggestedPrompt());
                            emit.accept(event("log", Map.of("text", qc2.passed()
                                    ? "✓ 修复重试质检通过（" + image.platform() + "）：" + qc2.summary()
                                    : "△ 修复重试仍未完全通过（" + image.platform() + "）：" + String.join("；", qc2.issues()) + "，可到单图工作台继续调整")));
                        }
                    } catch (Exception re) {
                        emit.accept(event("log", Map.of("text", "✗ 修复重试失败，保留原结果：" + safeMessage(re))));
                    }
                }
                qa.add(record);
            } catch (Exception e) {
                qa.add(new ApiModels.QaRecord(image.type(), image.url(), true,
                        image.platform() + " · 视觉质检不可用（" + safeMessage(e) + "），建议上线前人工复检", null, null, null));
                emit.accept(event("log", Map.of("text", "✗ 白底图视觉质检失败，已降级为人工复检提醒：" + safeMessage(e))));
            }
        }
        steps.add(new ApiModels.StepRecord("白底图质检", qa.isEmpty() ? "skipped" : "done",
                qa.isEmpty() ? null : "视觉质检 " + qa.size() + " 张，通过 " + qa.stream().filter(ApiModels.QaRecord::passed).count() + " 张"));
        emit.accept(event("log", Map.of("text", qa.isEmpty() ? "无白底图，质检跳过" : "白底图质检完成")));

        // AI 详情页自动化：文本模型按平台规范组合图片引用与文案；失败降级为模板
        List<String> generatedTypes = images.stream().map(ApiModels.GeneratedImage::type).distinct().toList();
        List<ApiModels.DetailPage> detailPages = new ArrayList<>();
        for (String p : platforms) {
            final String pageName = productName.isBlank() ? "参考图商品" : productName;
            ApiModels.DetailPage page;
            try {
                emit.accept(event("log", Map.of("text", "正在为 " + p + " 生成 AI 详情页（自动组合配图与文案）…")));
                page = aiDetailPage(p, pageName, sellingPoints, profile, generatedTypes, request.detailTone(), request.textModel());
                steps.add(new ApiModels.StepRecord("详情页编排 · " + p, "done", "AI 组合 " + page.sections().size() + " 个模块"));
                emit.accept(event("log", Map.of("text", "✓ " + p + " AI 详情页完成（" + page.sections().size() + " 个模块，含配图引用）")));
            } catch (Exception e) {
                page = fallbackPage(pageName, sellingPoints, p, request.detailTone());
                steps.add(new ApiModels.StepRecord("详情页编排 · " + p, "failed", "AI 编排失败，已降级模板：" + safeMessage(e)));
                emit.accept(event("log", Map.of("text", "✗ " + p + " AI 详情页失败，已降级为模板：" + safeMessage(e))));
            }
            detailPages.add(page);
        }
        emit.accept(event("log", Map.of("text", "详情页编排完成，任务结束")));

        ApiModels.ImagePipelineResponse response = new ApiModels.ImagePipelineResponse(
                steps, profile.isBlank() ? null : profile, images, qa, detailPages);
        emit.accept(event("done", response));
        return response;
    }

    /** SSE 流式执行：虚拟线程中跑流水线，过程事件实时推给前端，结束推 done / fatal。 */
    public SseEmitter runStream(ApiModels.ImagePipelineRequest request) {
        SseEmitter emitter = new SseEmitter(0L);
        Thread.ofVirtual().name("pipeline-sse").start(() -> {
            try {
                run(request, event -> {
                    try {
                        emitter.send(SseEmitter.event().name(event.event()).data(event.data()));
                    } catch (IOException e) {
                        throw new IllegalStateException("SSE 推送失败（客户端可能已断开）", e);
                    }
                });
                emitter.complete();
            } catch (Exception e) {
                try {
                    emitter.send(SseEmitter.event().name("fatal").data(Map.of("error", safeMessage(e))));
                    emitter.complete();
                } catch (Exception ignored) {
                    // 客户端已断开，无法收尾
                }
            }
        });
        return emitter;
    }

    public ApiModels.GeneratedImage single(ApiModels.SingleImageRequest request) {
        String type = request.type() == null ? "白底图" : request.type();
        if (!IMAGE_TYPES.contains(type)) throw new IllegalArgumentException("type 必须是：" + String.join("、", IMAGE_TYPES));
        List<String> refs = sanitizeRefs(request.referenceImages());
        ModelRouterImageClient.ImageResult result;
        if (request.sourceUrl() != null && !request.sourceUrl().isBlank()) {
            // 基于已生成图的修改（图生图）
            result = imageClient.editImage(request.prompt(), request.sourceUrl(), request.model());
        } else if (!refs.isEmpty()) {
            result = imageClient.editImage(request.prompt(), refs, request.model());
        } else {
            result = imageClient.generateImage(request.prompt(), request.model());
        }
        if (result.isEmpty()) return null;
        return new ApiModels.GeneratedImage(type, request.platform() == null ? "Amazon" : request.platform(), result.size(), result.urls().get(0));
    }

    /** 图片本地化：Token Plan 不支持异步任务，同步走图生图编辑并直接返回结果。 */
    public ApiModels.GeneratedImage localize(ApiModels.LocalizeRequest request) {
        ModelRouterImageClient.ImageResult result = imageClient.editImage(
                "将这张商品图适配 %s 市场：%s".formatted(
                        request.targetMarket() == null ? "US" : request.targetMarket(),
                        request.instruction() == null || request.instruction().isBlank()
                                ? "替换背景场景与文字语言以匹配当地市场审美，保持商品外观不变"
                                : request.instruction()),
                request.sourceUrl(),
                request.model());
        if (result.isEmpty()) return null;
        return new ApiModels.GeneratedImage("本地化图", request.targetMarket() == null ? "US" : request.targetMarket(), result.size(), result.urls().get(0));
    }

    /**
     * 独立 AI 详情页（POST /api/detail-page）：商品名称/卖点 → 画像 → 按平台 AI 编排详情页（失败降级模板）。
     * 与五图流水线解耦；generatedTypes 为已有生成图的类型集合，供 AI 引用配图。
     */
    public List<ApiModels.DetailPage> generateDetailPages(ApiModels.DetailPageRequest request) {
        String productName = blankToDefault(request.productName(), "");
        String sellingPoints = blankToDefault(request.sellingPoints(), "");
        if (productName.isBlank() && sellingPoints.isBlank()) {
            throw new IllegalArgumentException("productName 与 sellingPoints 至少提供一个");
        }
        List<String> platforms = request.platforms() == null || request.platforms().isEmpty()
                ? List.of("Amazon") : request.platforms();
        String profile;
        try {
            profile = chat(profilePrompt(productName, sellingPoints, 0), request.textModel());
            if (profile == null || profile.isBlank()) throw new IllegalStateException("商品画像为空");
            profile = profile.replace("**", "");
        } catch (Exception e) {
            log.warn("独立详情页画像失败，已降级纯文本拼接：{}", safeMessage(e));
            profile = "商品：" + productName + "；卖点：" + sellingPoints;
        }
        List<String> generatedTypes = request.generatedTypes() == null ? List.of()
                : request.generatedTypes().stream().filter(IMAGE_TYPES::contains).distinct().toList();
        String pageName = productName.isBlank() ? "未命名商品" : productName;
        List<ApiModels.DetailPage> pages = new ArrayList<>();
        for (String platform : platforms) {
            ApiModels.DetailPage page;
            try {
                page = aiDetailPage(platform, pageName, sellingPoints, profile, generatedTypes, request.detailTone(), request.textModel());
            } catch (Exception e) {
                log.warn("独立详情页 AI 编排失败（{}），已降级模板：{}", platform, safeMessage(e));
                page = fallbackPage(pageName, sellingPoints, platform, request.detailTone());
            }
            pages.add(page);
        }
        return pages;
    }

    /** 商品画像提示词（五图流水线与独立详情页共用）；refCount>0 时提示图片阶段走图生图保持商品一致。 */
    private String profilePrompt(String productName, String sellingPoints, int refCount) {
        return "你是电商商品视觉分析专家。请用中文简洁输出商品画像，包含品类、外观、受众和使用场景。商品：%s；卖点：%s%s"
                .formatted(productName, sellingPoints, refCount > 0 ? "（另有 " + refCount + " 张参考图，图片阶段将走图生图保持商品一致）" : "");
    }

    /** 网关模型清单按能力分组，供前端「模型与调用」面板选择。 */
    public Map<String, Object> modelCatalog() {
        List<String> ids;
        try {
            ids = imageClient.listModels();
        } catch (Exception e) {
            ids = List.of("qwen3.7-max", "wan2.7-image-pro", "qwen-image-2.0");
        }
        List<Map<String, Object>> textToImage = new ArrayList<>();
        List<Map<String, Object>> imageToImage = new ArrayList<>();
        List<Map<String, Object>> text = new ArrayList<>();
        List<Map<String, Object>> other = new ArrayList<>();
        List<Map<String, Object>> vision = new ArrayList<>();
        for (String id : ids.stream().sorted(String.CASE_INSENSITIVE_ORDER).toList()) {
            if (id.startsWith("wan") && id.contains("image")) {
                textToImage.add(model(id, "wan2.7-image-pro".equals(id)));
            } else if (id.startsWith("qwen-image")) {
                imageToImage.add(model(id, "qwen-image-2.0".equals(id)));
            } else if (id.contains("audio")) {
                other.add(model(id, false));
            } else {
                text.add(model(id, "qwen3.7-max".equals(id)));
            }
            // 视觉能力独立于文本分组：同一模型可同时供文案与质检选用（如 qwen3.6-plus）
            if (ModelRouterVisionClient.isVisionCapable(id)) {
                vision.add(model(id, ModelRouterVisionClient.DEFAULT_VISION_MODEL.equals(id)));
            }
        }
        return Map.of(
                "textToImage", textToImage,
                "imageToImage", imageToImage,
                "text", text,
                "other", other,
                "vision", vision,
                "visionAvailable", !vision.isEmpty());
    }

    private static final JsonMapper JSON_MAPPER = JsonMapper.builder().build();

    /** AI 详情页自动化：文本模型按平台规范组合配图引用与文案，输出结构化 JSON；解析失败抛异常由调用方降级模板。 */
    private ApiModels.DetailPage aiDetailPage(String platform, String productName, String sellingPoints, String profile,
                                              List<String> generatedTypes, String detailTone, String textModel) {
        String spec = switch (platform) {
            case "TikTok Shop" -> "竖版内容流优先，场景种草，短句直给，前 3 屏必须抓住注意力";
            case "Temu" -> "卖点直给，价格敏感型买家，参数与优惠信息清晰醒目";
            case "Shopee" -> "移动端小屏优先，促销氛围，信息简洁分块";
            default -> "模块化图文（A+ 页面风格），白底主图合规，禁止绝对化用语与未验证宣称，参数表清晰";
        };
        String toneHint = "种草转化".equals(detailTone) ? "种草转化语气，真实体验感" : "简洁高端".equals(detailTone) ? "克制高级，留白表达" : "专业可信，参数清晰";
        String prompt = """
                你是跨境电商详情页策划专家。基于商品画像与卖点，为 %s 设计完整详情页。
                平台规范：%s。文案语气：%s。
                本次已生成的配图类型：%s。每个模块必须引用最合适的 imageType（只能取：白底图/场景图/模特图/对比图/尺寸图），无合适配图的模块 imageType 填 null。
                只输出 JSON，不要 markdown 代码块，结构：
                {"title":"...","subtitle":"...","sellingPoints":["..."],"sections":[{"type":"hero|benefits|scene|comparison|specs|faq|cta","title":"...","body":"...","imageType":"白底图","bullets":["..."]}],"compliance":["..."]}
                要求：6-8 个模块，按 hero→benefits→scene→comparison→specs→faq→cta 顺序，卖点转译为购买理由，每条正文不超过 60 字，faq 恰好 3 条。
                商品：%s；卖点：%s；商品画像：%s
                """.formatted(platform, spec, toneHint,
                generatedTypes.isEmpty() ? "暂无（imageType 填 null）" : String.join("、", generatedTypes),
                productName, sellingPoints.isBlank() ? "（未提供，从画像提炼）" : sellingPoints, profile);
        String raw = chat(prompt, textModel);
        String json = raw == null ? "" : raw.replaceAll("(?s)```(?:json)?", "").trim();
        int start = json.indexOf('{');
        int end = json.lastIndexOf('}');
        if (start < 0 || end <= start) throw new IllegalStateException("AI 未返回 JSON");
        JsonNode root = JSON_MAPPER.readTree(json.substring(start, end + 1));

        List<ApiModels.DetailPageSection> sections = new ArrayList<>();
        for (JsonNode node : root.path("sections")) {
            String imageType = node.path("imageType").asText("");
            List<String> bullets = new ArrayList<>();
            node.path("bullets").forEach(b -> {
                String t = b.asText("");
                if (!t.isBlank()) bullets.add(t);
            });
            sections.add(new ApiModels.DetailPageSection(
                    node.path("type").asText("benefits"),
                    node.path("title").asText("模块"),
                    node.path("body").asText(""),
                    imageType.isBlank() || !IMAGE_TYPES.contains(imageType) ? null : imageType,
                    bullets));
        }
        if (sections.isEmpty()) throw new IllegalStateException("AI 详情页缺少 sections");
        List<String> points = new ArrayList<>();
        root.path("sellingPoints").forEach(p -> {
            String t = p.asText("");
            if (!t.isBlank() && points.size() < 6) points.add(t);
        });
        List<String> compliance = new ArrayList<>();
        root.path("compliance").forEach(c -> {
            String t = c.asText("");
            if (!t.isBlank()) compliance.add(t);
        });
        if (compliance.isEmpty()) compliance.addAll(List.of("主图与卖点遵循平台规范", "避免水印与绝对化宣称"));
        return new ApiModels.DetailPage(
                platform,
                root.path("title").asText(productName),
                root.path("subtitle").asText(""),
                points.isEmpty() ? List.of("为日常使用打造") : points,
                sections,
                compliance);
    }

    private ApiModels.PipelineEvent event(String name, Object data) {
        return new ApiModels.PipelineEvent(name, data);
    }

    private Map<String, Object> model(String id, boolean verified) {
        return Map.of("id", id, "verified", verified);
    }

    private String chat(String prompt, String textModelOverride) {
        var spec = chatClient.prompt().user(prompt);
        if (textModelOverride != null && !textModelOverride.isBlank()) {
            // Spring AI 2.0.1：options(...) 接收 ChatOptions.Builder
            spec = spec.options(ChatOptions.builder().model(textModelOverride.trim()));
        }
        return spec.call().content();
    }

    private String buildPrompt(String type, String productName, String profile, String platform, List<String> refs) {
        String base = fallbackPrompt(type, productName.isBlank() ? "参考图中的商品" : productName, profile, platform)
                + " " + platformRule(platform, type);
        return refs.isEmpty() ? base : base
                + " 请将附件参考图中的商品视为同一商品：严格保持其外观、颜色、材质、比例与细节一致。";
    }

    /**
     * 平台差异化规则注入（中文，随提示词发给图片模型）：按「平台 × 图类」给出该平台独有的风格基调与合规要求，
     * 让多平台各出完整五图时图片组互不雷同、贴合各平台自身特色，而不是同一套图换平台名。
     */
    private String platformRule(String platform, String type) {
        return switch (platform) {
            case "TikTok Shop" -> switch (type) {
                case "白底图" -> "平台合规（TikTok Shop 主图）：优先纯净白底，商品突出且完整，无文字、无水印、无道具；构图留出竖版裁切空间，主体居中偏上。";
                case "场景图" -> "平台特色（TikTok Shop 场景图）：竖版信息流生活方式抓拍，年轻活力的使用氛围，原生气手机摄影质感，色彩明快、第一眼抓人，主体居中偏上适配 3:4 竖版裁切。";
                case "模特图" -> "平台特色（TikTok Shop 模特图）：年轻活力模特的街拍感展示，动作自然随性像随手记录，原生光线，竖版构图主体居中偏上。";
                case "对比图" -> "平台特色（TikTok Shop 对比图）：使用前后或两场景的强对比构图，视觉冲击力强、色彩对比明快，画面简洁适合快节奏滑动浏览。";
                default -> "平台特色（TikTok Shop 尺寸图）：极简大字标注，竖版纵向排列关键尺寸，小屏快滑也能一眼看清。";
            };
            case "Temu" -> switch (type) {
                case "白底图" -> "平台合规（Temu 主图）：干净白底，商品突出且完整可见，尽量不放文字，无水印。";
                case "场景图" -> "平台特色（Temu 场景图）：直白实用的日常使用场景，布光明亮饱满，商品在画面中占比大、细节信息量足，突出性价比实用感。";
                case "模特图" -> "平台特色（Temu 模特图）：邻家亲和力的真实模特，日常使用姿态自然放松，画面信息饱满、商品细节清晰。";
                case "对比图" -> "平台特色（Temu 对比图）：卖点直给的对比构图，突出容量、自重等硬参数差异，画面充实直观、信息量足。";
                default -> "平台特色（Temu 尺寸图）：参数标注详尽密集，测量线与数字清晰易读，突出参数信息量。";
            };
            case "Shopee" -> switch (type) {
                case "白底图" -> "平台合规（Shopee 主图）：白底干净清晰，商品突出且完整，保证移动端小屏可读，无文字、无水印。";
                case "场景图" -> "平台特色（Shopee 场景图）：明亮饱和的轻松氛围场景，构图简洁分块，色彩友好，移动端小屏浏览也一目了然。";
                case "模特图" -> "平台特色（Shopee 模特图）：亲切活力的模特展示，色彩明快愉悦，构图简洁、商品突出。";
                case "对比图" -> "平台特色（Shopee 对比图）：简洁分块的对比版式，用明快色块区分差异，移动端小屏易读。";
                default -> "平台特色（Shopee 尺寸图）：简明尺寸标注，大号数字与粗线条，移动端小屏清晰可读。";
            };
            default -> switch (type) {
                case "白底图" -> "平台合规（Amazon 主图）：严格纯白无缝背景（RGB 255,255,255），无阴影、无文字、无水印、无道具、无 logo 或品牌标识，商品居中且占画面至少 85%。";
                case "场景图" -> "平台特色（Amazon 场景图）：专业商业摄影的场景化生活方式图，自然高级的布光与配色，干净可信的构图，契合品牌调性。";
                case "模特图" -> "平台特色（Amazon 模特图）：自然真实的模特使用展示，气质职业与日常兼顾，商业摄影质感，商品细节清晰。";
                case "对比图" -> "平台特色（Amazon 对比图）：克制专业的对比呈现，重点突出核心差异，画面干净严谨，不做夸张表达。";
                default -> "平台特色（Amazon 尺寸图）：专业规范的参数标注图，测量线精准清晰，排版严谨易读，信息可信。";
            };
        };
    }

    /** 五类图的中文生成提示词模板：图类要求 + 商品 + 画像 + 平台。 */
    private String fallbackPrompt(String type, String productName, String profile, String platform) {
        return switch (type) {
            case "白底图" -> "%s 的电商商品图，纯白背景，棚拍布光，商品居中占画面 85%%，无水印无文字。目标平台：%s。商品画像：%s".formatted(productName, platform, profile);
            case "场景图" -> "把 %s 放进真实日常使用场景的生活方式电商照片，自然光线，构图干净，商业质感。目标平台：%s。商品画像：%s".formatted(productName, platform, profile);
            case "模特图" -> "模特自然使用 %s 的真实感电商摄影，商品细节清晰，商业质感。目标平台：%s。商品画像：%s".formatted(productName, platform, profile);
            case "对比图" -> "干净的商品对比信息图，展示 %s 的优势与细节差异，不做无依据宣称，电商风格。目标平台：%s。商品画像：%s".formatted(productName, platform, profile);
            default -> "%s 的技术尺寸图，干净白底，测量标注线清晰，排版易读，电商风格。目标平台：%s。商品画像：%s".formatted(productName, platform, profile);
        };
    }

    private ApiModels.DetailPage fallbackPage(String productName, String sellingPoints, String platform, String detailTone) {
        List<String> points = Arrays.stream(sellingPoints.split("[,，、;；\\n]"))
                .map(String::trim).filter(s -> !s.isBlank()).limit(6).toList();
        List<String> safePoints = points.isEmpty() ? List.of("为日常使用打造", "细节清晰可见", "适配多平台上架") : points;
        // 详情页语气（detailTone）：专业可信 / 种草转化 / 简洁高端
        boolean seeding = "种草转化".equals(detailTone);
        boolean minimal = "简洁高端".equals(detailTone);
        String title = productName + (seeding ? "｜好物值得被看见" : minimal ? "｜少即是多" : "｜把核心卖点讲清楚");
        String subtitle = safePoints.stream().limit(2).reduce((a, b) -> a + " · " + b)
                .orElse(seeding ? "真实体验，自然种草" : minimal ? "克制设计，专注本质" : "为真实使用场景而设计");
        List<ApiModels.DetailPageSection> sections = List.of(
                new ApiModels.DetailPageSection("hero", productName, safePoints.get(0), "白底图", List.of()),
                new ApiModels.DetailPageSection("benefits", seeding ? "用过就回不去了" : minimal ? "为什么是它" : "为什么值得选", seeding ? "把真实卖点变成忍不住分享的理由。" : minimal ? "每一个保留的细节都有存在的理由。" : "用真实卖点快速建立购买理由。", "对比图", safePoints.stream().limit(4).toList()),
                new ApiModels.DetailPageSection("scene", seeding ? "博主同款生活场景" : "放进你的日常", seeding ? "让读者一眼代入拥有它的样子。" : "围绕高频使用场景呈现自然、可信的使用画面。", "场景图", List.of()),
                new ApiModels.DetailPageSection("comparison", seeding ? "和普通款比一比" : "细节与差异", safePoints.size() > 2 ? safePoints.get(2) : "把关键结构、材质和体验差异放大展示。", "模特图", List.of()),
                new ApiModels.DetailPageSection("specs", "参数一目了然", "尺寸、重量与材质信息按平台阅读习惯排布。", "尺寸图", safePoints.stream().limit(3).toList()),
                new ApiModels.DetailPageSection("faq", "购买前常见问题", "适用于" + platform + "详情页的简洁问答模块。", null, List.of("适合哪些使用场景？", "核心材质和尺寸是什么？", "如何清洁与保养？")),
                new ApiModels.DetailPageSection("cta", seeding ? "现在入手，早买早享受" : minimal ? "把它带回家" : "现在就把它带回家", seeding ? "看到这里的都是真心喜欢。" : "看清卖点，再做决定。", null, List.of("真实信息优先", "平台规范已适配")));
        return new ApiModels.DetailPage(platform, title, subtitle, safePoints, sections, List.of("主图与卖点遵循平台规范", "避免水印、拼图与无法验证的绝对化承诺"));
    }

    /** 参考图清洗：仅接受 http(s) URL 或 data:image base64，最多 6 张。 */
    private List<String> sanitizeRefs(List<String> refs) {
        if (refs == null) return List.of();
        return refs.stream()
                .map(r -> r == null ? "" : r.trim())
                .filter(r -> !r.isBlank())
                .filter(r -> r.startsWith("http://") || r.startsWith("https://") || r.startsWith("data:image/"))
                .limit(ModelRouterImageClient.MAX_REFERENCE_IMAGES)
                .toList();
    }

    private String blankToDefault(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private String safeMessage(Exception e) {
        return e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
    }
}
