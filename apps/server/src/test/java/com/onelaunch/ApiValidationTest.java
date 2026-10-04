package com.onelaunch;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.http.HttpStatus;
import java.nio.charset.StandardCharsets;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class ApiValidationTest {
    @Test void complianceAcceptsOptionalFactsAndPreservesLegacyRequests() throws Exception {
        var vision = mock(ModelRouterVisionClient.class);
        var mvc = MockMvcBuilders.standaloneSetup(new ApiController(mock(ImagePipelineService.class), mock(ModelRouterImageClient.class), vision, mock(ComplianceRuleLibrary.class))).build();
        String request = "{\"imageUrl\":\"https://example.test/a.png\",\"imageType\":\"尺寸图\",\"platform\":\"Amazon\",\"market\":\"US\"%s}";
        mvc.perform(post("/api/compliance-check").contentType(MediaType.APPLICATION_JSON).content(request.formatted(""))).andExpect(status().isOk());
        verify(vision).complianceCheck(null, "https://example.test/a.png", "尺寸图", "Amazon", "US", null, null);
        mvc.perform(post("/api/compliance-check").contentType(MediaType.APPLICATION_JSON).content(request.formatted(",\"productFacts\":\"宽38cm\""))).andExpect(status().isOk());
        verify(vision).complianceCheck(null, "https://example.test/a.png", "尺寸图", "Amazon", "US", "宽38cm", null);
        // P3 本体检验：referenceImageUrl 透传给视觉客户端（参考图在前、待检图在后）
        mvc.perform(post("/api/compliance-check").contentType(MediaType.APPLICATION_JSON)
                .content(request.formatted(",\"productFacts\":\"宽38cm\",\"referenceImageUrl\":\"https://example.test/p3.png\""))).andExpect(status().isOk());
        verify(vision).complianceCheck(null, "https://example.test/a.png", "尺寸图", "Amazon", "US", "宽38cm", "https://example.test/p3.png");
    }

    @Test void invalidStreamAndMissingComplianceInputsReturnReadable400() throws Exception {
        var controller = new ApiController(mock(ImagePipelineService.class), mock(ModelRouterImageClient.class), mock(ModelRouterVisionClient.class), mock(ComplianceRuleLibrary.class));
        var mvc = MockMvcBuilders.standaloneSetup(controller).build();
        mvc.perform(post("/api/images/set/stream").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/compliance-check").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").isString());
    }

    @Test void keyFailureAndImageDownloadErrorKeepReadableGatewayReason() {
        var key = HttpClientErrorException.create(HttpStatus.UNAUTHORIZED, "Unauthorized", null,
                "{\"error\":{\"message\":\"Invalid API key\"}}".getBytes(StandardCharsets.UTF_8), StandardCharsets.UTF_8);
        assertTrue(ApiErrors.message(key).contains("检查 API Key"));
        assertTrue(ApiErrors.message(key).contains("Invalid API key"));
        var image = HttpClientErrorException.create(HttpStatus.BAD_REQUEST, "Bad Request", null,
                "{\"error\":{\"message\":\"Download multimodal file timed out\"}}".getBytes(StandardCharsets.UTF_8), StandardCharsets.UTF_8);
        assertTrue(ApiErrors.message(image).contains("上传本地图"));
        assertTrue(ApiErrors.message(image).contains("Download multimodal file timed out"));
        assertThrows(IllegalArgumentException.class, () -> ApiErrors.requireImage("not-an-image"));
    }
}
