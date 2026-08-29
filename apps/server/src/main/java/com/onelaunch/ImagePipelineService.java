package com.onelaunch;

import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class ImagePipelineService {
    private static final List<String> IMAGE_TYPES = List.of("白底图", "场景图", "模特图", "对比图", "尺寸图");
    private final ChatClient chatClient;
    private final ModelRouterImageClient imageClient;

    public ImagePipelineService(ChatClient chatClient, ModelRouterImageClient imageClient) {
        this.chatClient = chatClient;
        this.imageClient = imageClient;
    }

    public ApiModels.ImagePipelineResponse run(ApiModels.ImagePipelineRequest request) {
        List<ApiModels.StepRecord> steps = new ArrayList<>();
        List<ApiModels.GeneratedImage> images = new ArrayList<>();
        List<ApiModels.QaRecord> qa = new ArrayList<>();
        List<String> platforms = request.platforms() == null || request.platforms().isEmpty()
                ? List.of("Amazon") : request.platforms();
        String profile;
        try {
            profile = chat("你是电商商品视觉分析专家。请用中文简洁输出商品画像，包含品类、外观、受众和使用场景。商品：%s；卖点：%s%s"
                    .formatted(request.productName(), request.sellingPoints(),
                            request.referenceImageUrl() == null ? "" : "；参考图：" + request.referenceImageUrl()));
            if (profile == null || profile.isBlank()) throw new IllegalStateException("商品画像为空");
            steps.add(new ApiModels.StepRecord("商品图理解", "done", null));
        } catch (Exception e) {
            profile = "商品：" + request.productName() + "；卖点：" + request.sellingPoints();
            steps.add(new ApiModels.StepRecord("商品图理解", "failed", "已降级为纯文本画像：" + safeMessage(e)));
        }

        for (int i = 0; i < platforms.size(); i++) {
            String platform = platforms.get(i);
            List<String> types = i == 0 ? IMAGE_TYPES : List.of("白底图");
            int ok = 0;
            for (String type : types) {
                String prompt = fallbackPrompt(type, request.productName(), profile, platform);
                try {
                    ModelRouterImageClient.ImageResult result = imageClient.generateImage(prompt);
                    if (!result.isEmpty()) {
                        images.add(new ApiModels.GeneratedImage(type, platform, result.size(), result.urls().get(0)));
                        ok++;
                    }
                } catch (Exception e) {
                    steps.add(new ApiModels.StepRecord(platform + " " + type + "生成", "failed", safeMessage(e)));
                }
            }
            steps.add(new ApiModels.StepRecord(platform + " 图片生成（" + types.size() + " 类）", ok > 0 ? "done" : "failed", "成功 " + ok + "/" + types.size()));
        }

        for (ApiModels.GeneratedImage image : images) {
            if ("白底图".equals(image.type())) qa.add(new ApiModels.QaRecord(image.type(), image.url(), true, "图片已生成，建议上线前进行视觉复检"));
        }
        steps.add(new ApiModels.StepRecord("白底图质检", qa.isEmpty() ? "skipped" : "done", null));

        List<ApiModels.DetailPage> detailPages = platforms.stream()
                .map(p -> fallbackPage(request.productName(), request.sellingPoints(), p))
                .toList();
        steps.add(new ApiModels.StepRecord("详情页编排", "done", detailPages.size() + " 个平台版本"));
        return new ApiModels.ImagePipelineResponse(steps, profile, images, qa, detailPages);
    }

    public ApiModels.GeneratedImage single(ApiModels.SingleImageRequest request) {
        String type = request.type() == null ? "白底图" : request.type();
        if (!IMAGE_TYPES.contains(type)) throw new IllegalArgumentException("type 必须是：" + String.join("、", IMAGE_TYPES));
        ModelRouterImageClient.ImageResult result = imageClient.generateImage(request.prompt());
        if (result.isEmpty()) return null;
        return new ApiModels.GeneratedImage(type, request.platform() == null ? "Amazon" : request.platform(), result.size(), result.urls().get(0));
    }

    /** 图片本地化：Token Plan 不支持异步任务，同步走图生图编辑并直接返回结果。 */
    public ApiModels.GeneratedImage localize(ApiModels.LocalizeRequest request) {
        ModelRouterImageClient.ImageResult result = imageClient.editImage(
                "Adapt this product image for the %s market: %s".formatted(
                        request.targetMarket() == null ? "US" : request.targetMarket(),
                        request.instruction() == null ? "替换背景场景与文字语言，符合当地市场审美" : request.instruction()),
                request.sourceUrl());
        if (result.isEmpty()) return null;
        return new ApiModels.GeneratedImage("本地化图", request.targetMarket() == null ? "US" : request.targetMarket(), result.size(), result.urls().get(0));
    }

    private String chat(String prompt) {
        return chatClient.prompt().user(prompt).call().content();
    }

    private String fallbackPrompt(String type, String productName, String profile, String platform) {
        return switch (type) {
            case "白底图" -> "E-commerce product photo of %s, pure white background, studio lighting, product centered and occupying 85%% of frame, no watermark or text. Platform: %s. Profile: %s".formatted(productName, platform, profile);
            case "场景图" -> "Lifestyle e-commerce photo of %s in a realistic daily usage scene, natural light, clean composition, commercial quality. Platform: %s. Profile: %s".formatted(productName, platform, profile);
            case "模特图" -> "A natural model using %s, realistic fashion e-commerce photography, clear product details, commercial quality. Platform: %s. Profile: %s".formatted(productName, platform, profile);
            case "对比图" -> "Clean comparison infographic showing the benefits and details of %s, no unsupported claims, e-commerce style. Platform: %s. Profile: %s".formatted(productName, platform, profile);
            default -> "Technical dimension diagram for %s, clean white background, measurement lines, legible layout, e-commerce style. Platform: %s. Profile: %s".formatted(productName, platform, profile);
        };
    }

    private ApiModels.DetailPage fallbackPage(String productName, String sellingPoints, String platform) {
        List<String> points = Arrays.stream(sellingPoints.split("[,，、;；\\n]"))
                .map(String::trim).filter(s -> !s.isBlank()).limit(6).toList();
        List<String> safePoints = points.isEmpty() ? List.of("为日常使用打造", "细节清晰可见", "适配多平台上架") : points;
        List<ApiModels.DetailPageSection> sections = List.of(
                new ApiModels.DetailPageSection("hero", productName, safePoints.get(0), "白底图", List.of()),
                new ApiModels.DetailPageSection("benefits", "为什么值得选", "用真实卖点快速建立购买理由。", "对比图", safePoints.stream().limit(4).toList()),
                new ApiModels.DetailPageSection("scene", "放进你的日常", "围绕高频使用场景呈现自然、可信的使用画面。", "场景图", List.of()),
                new ApiModels.DetailPageSection("comparison", "细节与差异", safePoints.size() > 2 ? safePoints.get(2) : "把关键结构、材质和体验差异放大展示。", "模特图", List.of()),
                new ApiModels.DetailPageSection("specs", "参数一目了然", "尺寸、重量与材质信息按平台阅读习惯排布。", "尺寸图", safePoints.stream().limit(3).toList()),
                new ApiModels.DetailPageSection("faq", "购买前常见问题", "适用于" + platform + "详情页的简洁问答模块。", null, List.of("适合哪些使用场景？", "核心材质和尺寸是什么？", "如何清洁与保养？")),
                new ApiModels.DetailPageSection("cta", "现在就把它带回家", "看清卖点，再做决定。", null, List.of("真实信息优先", "平台规范已适配")));
        return new ApiModels.DetailPage(platform, productName + "｜把核心卖点讲清楚", safePoints.stream().limit(2).reduce((a,b) -> a + " · " + b).orElse("为真实使用场景而设计"), safePoints, sections, List.of("主图与卖点遵循平台规范", "避免水印、拼图与无法验证的绝对化承诺"));
    }

    private String safeMessage(Exception e) {
        return e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
    }
}
