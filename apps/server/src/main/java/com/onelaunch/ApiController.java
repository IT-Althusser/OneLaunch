package com.onelaunch;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
@CrossOrigin
public class ApiController {
    private final ImagePipelineService pipeline;
    private final ModelRouterImageClient imageClient;

    public ApiController(ImagePipelineService pipeline, ModelRouterImageClient imageClient) {
        this.pipeline = pipeline;
        this.imageClient = imageClient;
    }

    @GetMapping("/health")
    public Map<String, Object> health() {
        return Map.of("ok", true, "service", "onelaunch-java-server");
    }

    /** 同源图片代理：前端单图工作台的画幅裁切与下载原图需要同源可读。仅 http(s)。 */
    @GetMapping("/image-proxy")
    public ResponseEntity<byte[]> imageProxy(@RequestParam("url") String url,
                                             @RequestParam(name = "download", defaultValue = "false") boolean download) {
        try {
            ModelRouterImageClient.FetchedImage image = imageClient.fetchImage(url);
            var headers = new org.springframework.http.HttpHeaders();
            headers.set(org.springframework.http.HttpHeaders.CONTENT_TYPE, image.contentType());
            if (download) {
                String lower = url.toLowerCase();
                String ext = lower.endsWith(".jpg") || lower.endsWith(".jpeg") ? ".jpg" : ".png";
                headers.set(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"onelaunch-image" + ext + "\"");
            }
            return new ResponseEntity<>(image.bytes(), headers, org.springframework.http.HttpStatus.OK);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(("图片代理失败：" + e.getMessage()).getBytes());
        }
    }

    /** 网关实时模型清单（按能力分组），供右侧「模型与调用」面板。 */
    @GetMapping("/models")
    public Map<String, Object> models() {
        return pipeline.modelCatalog();
    }

    @PostMapping("/images/set")
    public ResponseEntity<?> set(@RequestBody ApiModels.ImagePipelineRequest request) {
        String invalid = validateSetRequest(request);
        if (invalid != null) return ResponseEntity.badRequest().body(Map.of("error", invalid));
        try { return ResponseEntity.ok(pipeline.run(request)); }
        catch (Exception e) { return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage())); }
    }

    /** 流式版五图流水线：SSE 推送 log / profile / image_start / image_done / image_fail / done 事件，前端实时展示思考过程。 */
    @PostMapping("/images/set/stream")
    public ResponseEntity<SseEmitter> setStream(@RequestBody ApiModels.ImagePipelineRequest request) {
        String invalid = validateSetRequest(request);
        if (invalid != null) return ResponseEntity.badRequest().body(null);
        return ResponseEntity.ok(pipeline.runStream(request));
    }

    @PostMapping("/images/single")
    public ResponseEntity<?> single(@RequestBody ApiModels.SingleImageRequest request) {
        if (request.type() == null || request.prompt() == null || request.prompt().isBlank())
            return ResponseEntity.badRequest().body(Map.of("error", "type and prompt are required"));
        try { return ResponseEntity.ok(new ApiModels.ImageResponse(pipeline.single(request))); }
        catch (Exception e) { return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage())); }
    }

    @PostMapping("/images/localize")
    public ResponseEntity<?> localize(@RequestBody ApiModels.LocalizeRequest request) {
        if (request.sourceUrl() == null || request.sourceUrl().isBlank()) return ResponseEntity.badRequest().body(Map.of("error", "sourceUrl is required"));
        try { return ResponseEntity.ok(new ApiModels.ImageResponse(pipeline.localize(request))); }
        catch (Exception e) { return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage())); }
    }

    /** AI 详情页自动化（独立端点，不依赖五图流水线）：名称/卖点 → 画像 → 按平台 AI 组合配图引用与文案；AI 编排失败降级模板。 */
    @PostMapping("/detail-page")
    public ResponseEntity<?> detailPage(@RequestBody ApiModels.DetailPageRequest request) {
        String invalid = validateDetailRequest(request);
        if (invalid != null) return ResponseEntity.badRequest().body(Map.of("error", invalid));
        try { return ResponseEntity.ok(Map.of("detailPages", pipeline.generateDetailPages(request))); }
        catch (Exception e) { return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage())); }
    }

    /** 商品名称与参考图至少其一；卖点可选（有参考图时允许为空）。 */
    private String validateSetRequest(ApiModels.ImagePipelineRequest request) {
        boolean hasName = request.productName() != null && !request.productName().isBlank();
        List<String> refs = request.referenceImages();
        boolean hasRefs = refs != null && refs.stream().anyMatch(r -> r != null && !r.isBlank());
        if (!hasName && !hasRefs) return "productName 与 referenceImages 至少提供一个";
        return null;
    }

    /** 独立详情页：商品名称与卖点至少其一（纯图无文案素材无法编排）。 */
    private String validateDetailRequest(ApiModels.DetailPageRequest request) {
        boolean hasName = request.productName() != null && !request.productName().isBlank();
        boolean hasPoints = request.sellingPoints() != null && !request.sellingPoints().isBlank();
        if (!hasName && !hasPoints) return "productName 与 sellingPoints 至少提供一个";
        return null;
    }
}
