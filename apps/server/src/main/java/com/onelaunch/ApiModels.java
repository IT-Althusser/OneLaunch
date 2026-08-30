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
            String visionModel) {}

    public record StepRecord(String step, String status, String detail) {}

    public record GeneratedImage(String type, String platform, String size, String url) {}

    /**
     * 白底图质检记录：视觉质检时 model 为执行审核的视觉模型、issues 为未通过项、
     * suggestedPrompt 为未通过时的修复提示词样例；降级人工复检时 model/issues/suggestedPrompt 为 null。
     */
    public record QaRecord(String type, String url, boolean passed, String comment, List<String> issues, String model, String suggestedPrompt) {}

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
            String model) {}

    public record LocalizeRequest(String sourceUrl, String targetMarket, String instruction, String model) {}

    /** 独立 AI 详情页请求：名称与卖点至少其一；generatedTypes 为已有生成图类型集合（供 AI 引用配图），可空。 */
    public record DetailPageRequest(
            String productName,
            String sellingPoints,
            List<String> platforms,
            String detailTone,
            List<String> generatedTypes,
            String textModel) {}

    public record ImageResponse(GeneratedImage image) {}

    /** 流式端点的单条事件：event 为 SSE 事件名，data 为随事件发送的负载。 */
    public record PipelineEvent(String event, Object data) {}
}
