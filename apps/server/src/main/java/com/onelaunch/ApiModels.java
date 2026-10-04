package com.onelaunch;

import java.util.List;

public final class ApiModels {
    private ApiModels() {}

    public record ImagePipelineRequest(
            String productName,
            String sellingPoints,
            List<String> platforms,
            String detailTone,
            /** 商品参考图：公网 URL 或 data:image/xxx;base64,xxx（本地上转直传）。最多 6 张，有参考图时走图生图。 */
            List<String> referenceImages,
            /** 文生图模型覆盖（可选，如 wan2.7-image-pro）。 */
            String imageModel,
            /** 图生图（参考图/编辑）模型覆盖（可选，如 qwen-image-2.0）。 */
            String editModel,
            /** 文本模型覆盖（可选，如 qwen3.7-max）。 */
            String textModel,
            /** 白底图视觉质检模型覆盖（可选，如 qwen3.6-plus，须具备视觉理解能力）。 */
            String visionModel,
            String market,
            /** 图生图网关路由：default=Token Plan 主网关（比赛口径，默认）；custom=服务端预配置的自定义网关（诊断用）。可空。 */
            String editGateway) {
        public ImagePipelineRequest(String productName, String sellingPoints, List<String> platforms, String detailTone,
                                    List<String> referenceImages, String imageModel, String editModel, String textModel,
                                    String visionModel, String market) {
            this(productName, sellingPoints, platforms, detailTone, referenceImages, imageModel, editModel, textModel, visionModel, market, null);
        }
    }

    public record StepRecord(String step, String status, String detail) {}

    public record GeneratedImage(String type, String platform, String size, String url) {}

    /**
     * 图片质检记录：status 是审核状态的权威语义；未完成审核时 passed=false。
     * 降级人工复检时 status=manual_review，model/issues/suggestedPrompt 为 null。
     */
    public record QaRecord(String type, String url, boolean passed, String comment, List<String> issues, String model, String suggestedPrompt, String market, List<ModelRouterVisionClient.Issue> complianceIssues, String platform, String status, List<String> passReasons) {
        public QaRecord(String type, String url, boolean passed, String comment, List<String> issues, String model, String suggestedPrompt) { this(type, url, passed, comment, issues, model, suggestedPrompt, null, List.of(), null, statusFor(passed), List.of()); }
        public QaRecord(String type, String url, boolean passed, String comment, List<String> issues, String model, String suggestedPrompt, String market, List<ModelRouterVisionClient.Issue> complianceIssues) { this(type, url, passed, comment, issues, model, suggestedPrompt, market, complianceIssues, null, statusFor(passed), List.of()); }
        public QaRecord(String type, String url, boolean passed, String comment, List<String> issues, String model, String suggestedPrompt, String market, List<ModelRouterVisionClient.Issue> complianceIssues, String platform) { this(type, url, passed, comment, issues, model, suggestedPrompt, market, complianceIssues, platform, statusFor(passed), List.of()); }
        public QaRecord(String type, String url, boolean passed, String comment, List<String> issues, String model, String suggestedPrompt, String market, List<ModelRouterVisionClient.Issue> complianceIssues, String platform, String status) { this(type, url, passed, comment, issues, model, suggestedPrompt, market, complianceIssues, platform, status, List.of()); }

        public static String statusFor(boolean passed) { return passed ? "passed" : "failed"; }
    }
    /** referenceImageUrl：商品原始参考图（P3），传入时合并一次视觉调用做商品本体一致性检验；可空。 */
    public record ComplianceCheckRequest(String imageUrl, String imageType, String platform, String market, String visionModel, String productFacts, String referenceImageUrl) {}

    public record DetailPageSection(
            String type,
            String title,
            String body,
            String imageType,
            List<String> bullets) {}

    public record DetailPage(
            String platform,
            String title,
            String subtitle,
            List<String> sellingPoints,
            List<DetailPageSection> sections,
            List<String> compliance) {}

    public record ImagePipelineResponse(
            List<StepRecord> steps,
            String profile,
            List<GeneratedImage> images,
            List<QaRecord> qa,
            List<DetailPage> detailPages) {}

    /** 单图请求：sourceUrl 存在时走图生图修改；否则有 referenceImages 走参考图生成；否则文生图。 */
    public record SingleImageRequest(
            String type,
            String prompt,
            String platform,
            List<String> referenceImages,
            String sourceUrl,
            String model,
            String editGateway) {
        public SingleImageRequest(String type, String prompt, String platform, List<String> referenceImages, String sourceUrl, String model) {
            this(type, prompt, platform, referenceImages, sourceUrl, model, null);
        }
    }

    public record LocalizeRequest(String sourceUrl, String targetMarket, String instruction, String model, List<String> aspects, String targetLanguage, String modelProfile, String editGateway) {
        public LocalizeRequest(String sourceUrl, String targetMarket, String instruction, String model, List<String> aspects, String targetLanguage, String modelProfile) {
            this(sourceUrl, targetMarket, instruction, model, aspects, targetLanguage, modelProfile, null);
        }
    }

    /** 独立 AI 详情页请求：名称与卖点至少其一；generatedTypes 为已有生成图类型集合（供 AI 引用配图），可空。 */
    public record DetailPageRequest(
            String productName,
            String sellingPoints,
            List<String> platforms,
            String detailTone,
            List<String> generatedTypes,
            String textModel) {}

    public record ImageResponse(GeneratedImage image) {}
    public record LocalizeResponse(GeneratedImage image, List<String> appliedAspects, String note, String prompt) {}

    /** AI 润色请求（创作向导商品资料步）：kind = selling-points（卖点分条）| keywords（名词+关键词一行）。 */
    public record PolishRequest(String text, String kind, String model) {}
    public record PolishResponse(String text) {}

    /** 流式端点的单条事件：event 为 SSE 事件名，data 为随事件发送的负载。 */
    public record PipelineEvent(String event, Object data) {}
}
