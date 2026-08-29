package com.onelaunch;

import java.util.List;
import java.util.Map;

public final class ApiModels {
    private ApiModels() {}

    public record ImagePipelineRequest(
            String productName,
            String sellingPoints,
            List<String> platforms,
            String detailTone) {}

    public record StepRecord(String step, String status, String detail) {}

    public record GeneratedImage(String type, String platform, String size, String url) {}

    public record QaRecord(String type, String url, boolean passed, String comment) {}

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

    public record SingleImageRequest(String type, String prompt, String platform) {}

    public record LocalizeRequest(String sourceUrl, String targetMarket, String instruction) {}

    public record ImageResponse(GeneratedImage image) {}
}
