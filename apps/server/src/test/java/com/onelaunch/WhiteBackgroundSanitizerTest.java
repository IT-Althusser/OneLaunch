package com.onelaunch;

import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;

import static org.junit.jupiter.api.Assertions.assertTrue;

/** 白底图背景纯白化：用真实噪点背景模型输出验证四角/边缘区域必然纯白。 */
class WhiteBackgroundSanitizerTest {

    @Test
    void sanitizesNoisyBackgroundToPureWhite() throws Exception {
        byte[] source = getClass().getResourceAsStream("/noise-white.png").readAllBytes();
        byte[] cleaned = WhiteBackgroundSanitizer.sanitize(source);
        BufferedImage image = ImageIO.read(new ByteArrayInputStream(cleaned));
        int w = image.getWidth(), h = image.getHeight();
        // 四角 + 四边中点 + 边缘采样必须纯白（各通道 ≥ 250）
        int[][] samples = {{2, 2}, {w - 3, 2}, {2, h - 3}, {w - 3, h - 3}, {w / 2, 2}, {w / 2, h - 3}, {2, h / 2}, {w - 3, h / 2}};
        for (int[] s : samples) {
            int rgb = image.getRGB(s[0], s[1]);
            assertTrue(((rgb >> 16) & 0xFF) >= 250 && ((rgb >> 8) & 0xFF) >= 250 && (rgb & 0xFF) >= 250,
                    "边缘采样 (" + s[0] + "," + s[1] + ") 应为纯白，实际 rgb=" + Integer.toHexString(rgb));
        }
        // 商品主体应保留：图像中心区域应存在非纯白像素（商品本体未被误清）
        boolean hasProduct = false;
        for (int y = h / 4; y < h * 3 / 4 && !hasProduct; y += 8) {
            for (int x = w / 4; x < w * 3 / 4; x += 8) {
                int rgb = image.getRGB(x, y);
                if (((rgb >> 16) & 0xFF) < 240 || ((rgb >> 8) & 0xFF) < 240 || (rgb & 0xFF) < 240) { hasProduct = true; break; }
            }
        }
        assertTrue(hasProduct, "商品主体应保留在画面中");
        // 输出比对文件供人工视觉审查
        java.nio.file.Path out = java.nio.file.Path.of("target", "sanitized-noise-white.png");
        java.nio.file.Files.write(out, cleaned);
        assertTrue(out.toFile().length() > 0);
    }
}
