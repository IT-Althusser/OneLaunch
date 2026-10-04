package com.onelaunch;

import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 契约一致性测试：生成端（buildPrompt/fallbackPrompt）与质检端（imageTypeRule）必须携带同一组条款 id。
 * 这是“生成端与检测端口径必须一致”的工程化落点——任何一端绕过契约内联自己的文案，都会在这里被拦截。
 */
class ImageQualityContractTest {
    private static final List<String> TYPES = List.of("白底图", "场景图", "模特图", "对比图", "尺寸图");

    @Test void everyTypeHasNonBlankPairedClauses() {
        for (String type : TYPES) {
            var clauses = ImageQualityContract.clauses(type);
            assertFalse(clauses.isEmpty(), type + " 契约条款不能为空");
            for (var clause : clauses) {
                assertFalse(clause.id().isBlank(), type + " 条款 id 不能为空");
                assertFalse(clause.generation().isBlank(), type + " 生成端措辞不能为空：" + clause.id());
                assertFalse(clause.qa().isBlank(), type + " 质检端判据不能为空：" + clause.id());
            }
        }
    }

    @Test void promptBuildersOnBothEndsCarrySameClauseIds() {
        var chat = mock(ChatClient.class);
        var images = mock(ModelRouterImageClient.class);
        var vision = mock(ModelRouterVisionClient.class);
        var service = new ImagePipelineService(chat, images, vision, new ComplianceRuleLibrary());
        ReflectionTestUtils.setField(service, "qaScope", "all");
        ReflectionTestUtils.setField(service, "defaultImageModel", "image-test");
        ReflectionTestUtils.setField(service, "defaultEditModel", "edit-test");
        ReflectionTestUtils.setField(service, "defaultTextModel", "text-test");
        for (String type : TYPES) {
            Set<String> ids = ImageQualityContract.clauseIds(type);
            String generationPrompt = service.buildPrompt(type, "托特包", "轻量", "Amazon", List.of());
            String qaPrompt = ModelRouterVisionClient.imageTypeRule(type);
            for (String id : ids) {
                assertTrue(generationPrompt.contains("【" + id + "】"), type + " 生成端提示词缺少条款 " + id);
                assertTrue(qaPrompt.contains("【" + id + "】"), type + " 质检端判据缺少条款 " + id);
            }
        }
    }

    @Test void unknownTypeIsRejected() {
        assertThrows(IllegalArgumentException.class, () -> ImageQualityContract.clauses("海报图"));
        assertThrows(IllegalArgumentException.class, () -> ImageQualityContract.generationBlock("海报图"));
        assertThrows(IllegalArgumentException.class, () -> ModelRouterVisionClient.imageTypeRule("海报图"));
    }

    @Test void repairFocusCoversRepairableTypesAndStaysBlankForDimension() {
        for (String type : List.of("白底图", "场景图", "模特图", "对比图")) {
            assertFalse(ImageQualityContract.repairFocus(type).isBlank(), type + " 修复硬约束不能为空");
        }
        assertTrue(ImageQualityContract.repairFocus("尺寸图").isBlank()); // 尺寸图不进入修复循环
    }

    @Test void modelSingleAcceptanceKeepsVerifiedWording() {
        String acceptance = ImageQualityContract.MODEL_SINGLE_ACCEPTANCE;
        assertTrue(acceptance.contains("必须有人"));
        assertTrue(acceptance.contains("腰部以上完整出镜"));
        assertTrue(acceptance.contains("只有手、手臂"));
        assertTrue(acceptance.contains("必须重新生成"));
        // 露脸与形象要求（2026-10-03 用户需求：模特必须露脸，身材颜值要好看）
        assertTrue(acceptance.contains("面部必须完整露出"));
        assertTrue(acceptance.contains("被头发/手部/道具遮挡"));
        assertTrue(acceptance.contains("身材比例匀称自然"));
        assertTrue(acceptance.contains("无肢体或手指畸变"));
    }

    @Test void modelContractCarriesFaceAndAppearanceClausesOnBothEnds() {
        // 生成端：露脸硬约束 + 颜值气质目标（主观项只在生成端）
        String generation = ImageQualityContract.generationBlock("模特图");
        assertTrue(generation.contains("面部不得被头发、手部、商品、道具或阴影遮挡"));
        assertTrue(generation.contains("整体颜值高"));
        assertTrue(generation.contains("手指畸形"));
        // 质检端：露脸为客观判据可判未通过；颜值/妆发为主观偏好不得作为未通过理由（防修复循环不收敛）
        String qa = ModelRouterVisionClient.imageTypeRule("模特图");
        assertTrue(qa.contains("面部被头发/手/商品/道具遮挡"));
        assertTrue(qa.contains("手指畸形/多指/缺指"));
        assertTrue(qa.contains("不构成未通过理由"));
    }

    @Test void referenceProfilePromptForbidsSpeculationAndParseIsLenient() {
        assertTrue(ModelRouterVisionClient.REFERENCE_PROFILE_PROMPT.contains("禁止推测品牌"));
        assertTrue(ModelRouterVisionClient.REFERENCE_PROFILE_PROMPT.contains("严禁猜测拼写"));
        var profile = ModelRouterVisionClient.parseReferenceProfile("""
                {"category":"托特包","shape":"矩形包身，双侧提手","colors":"米白色","material":"帆布",
                 "visibleText":"未可辨认","usage":"未知"}
                """);
        assertEquals("托特包", profile.category());
        assertEquals("矩形包身，双侧提手", profile.shape());
        assertEquals("品类：托特包；形状结构：矩形包身，双侧提手；颜色：米白色；材质：帆布；固有文字：未可辨认；使用方式：未知", profile.toPromptText());
        // markdown 代码块包裹的 JSON 同样可解析
        assertEquals("托特包", ModelRouterVisionClient.parseReferenceProfile("```json\n{\"category\":\"托特包\"}\n```").category());
        // 全空字段与非 JSON 均视为无效
        assertThrows(IllegalStateException.class, () -> ModelRouterVisionClient.parseReferenceProfile("{\"category\":\"\"}"));
        assertThrows(IllegalStateException.class, () -> ModelRouterVisionClient.parseReferenceProfile("不是 JSON"));
    }

    @Test void blankProfileFieldsAreDroppedFromPromptText() {
        var partial = new ModelRouterVisionClient.ReferenceProfile("托特包", "", "米白色", "", "", "");
        assertEquals("品类：托特包；颜色：米白色", partial.toPromptText());
        assertFalse(partial.isEmpty());
        assertTrue(new ModelRouterVisionClient.ReferenceProfile("", "", "", "", "", "").isEmpty());
    }
}
