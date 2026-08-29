package com.onelaunch;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api")
@CrossOrigin
public class ApiController {
    private final ImagePipelineService pipeline;

    public ApiController(ImagePipelineService pipeline) {
        this.pipeline = pipeline;
    }

    @GetMapping("/health")
    public Map<String, Object> health() {
        return Map.of("ok", true, "service", "onelaunch-java-server");
    }

    @PostMapping("/images/set")
    public ResponseEntity<?> set(@Valid @RequestBody ApiModels.ImagePipelineRequest request) {
        if (request.productName() == null || request.productName().isBlank() || request.sellingPoints() == null || request.sellingPoints().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "productName and sellingPoints are required"));
        }
        try { return ResponseEntity.ok(pipeline.run(request)); }
        catch (Exception e) { return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage())); }
    }

    @PostMapping("/images/single")
    public ResponseEntity<?> single(@RequestBody ApiModels.SingleImageRequest request) {
        if (request.type() == null || request.prompt() == null || request.prompt().isBlank()) return ResponseEntity.badRequest().body(Map.of("error", "type and prompt are required"));
        try { return ResponseEntity.ok(new ApiModels.ImageResponse(pipeline.single(request))); }
        catch (Exception e) { return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage())); }
    }

    @PostMapping("/images/localize")
    public ResponseEntity<?> localize(@RequestBody ApiModels.LocalizeRequest request) {
        if (request.sourceUrl() == null || request.sourceUrl().isBlank()) return ResponseEntity.badRequest().body(Map.of("error", "sourceUrl is required"));
        try { return ResponseEntity.ok(new ApiModels.ImageResponse(pipeline.localize(request))); }
        catch (Exception e) { return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage())); }
    }
}
