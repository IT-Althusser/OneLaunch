package com.onelaunch;

import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;

import static org.junit.jupiter.api.Assertions.assertTrue;

/** 对比图确定性合成：验证 3:2 画布、左右双分区均含商品像素、背景纯白、输出可渲染。 */
class CompositeCompareRendererTest {
    @Test
    void rendersDualPanelWithProductPixelsAndWhiteBackground() throws Exception {
        // 构造带深色“商品”的纯白源图（sanitize 幂等：已是白底）
        int sw = 400, sh = 600;
        BufferedImage source = new BufferedImage(sw, sh, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = source.createGraphics();
        g.setColor(Color.WHITE);
        g.fillRect(0, 0, sw, sh);
        g.setColor(new Color(60, 40, 30));
        g.fillRect(sw / 2 - 40, sh / 5, 80, sh * 3 / 5); // 模拟瓶身
        g.dispose();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(source, "png", out);

        byte[] rendered = CompositeCompareRenderer.render(out.toByteArray());
        BufferedImage canvas = ImageIO.read(new ByteArrayInputStream(rendered));
        int w = canvas.getWidth(), h = canvas.getHeight();
        // 3:2 横版画布
        assertTrue(Math.abs(w * 2 - h * 3) <= 4, "画布应为 3:2，实际 " + w + "x" + h);
        // 左半与右半均应存在商品像素（双分区布局）
        assertTrue(hasDarkPixel(canvas, 0, w / 2, h), "左半区应包含商品整体");
        assertTrue(hasDarkPixel(canvas, w / 2, w, h), "右半区应包含局部放大");
        // 四角背景纯白
        int[][] corners = {{3, 3}, {w - 4, 3}, {3, h - 4}, {w - 4, h - 4}};
        for (int[] c : corners) {
            int rgb = canvas.getRGB(c[0], c[1]);
            assertTrue(((rgb >> 16) & 0xFF) >= 250 && ((rgb >> 8) & 0xFF) >= 250 && (rgb & 0xFF) >= 250,
                    "角部 (" + c[0] + "," + c[1] + ") 应为纯白，实际 rgb=" + Integer.toHexString(rgb));
        }
        // 输出比对文件供人工视觉审查
        java.nio.file.Path outFile = java.nio.file.Path.of("target", "composite-compare.png");
        java.nio.file.Files.write(outFile, rendered);
        assertTrue(outFile.toFile().length() > 0);
    }

    private static boolean hasDarkPixel(BufferedImage image, int x0, int x1, int h) {
        for (int y = 0; y < h; y += 4) {
            for (int x = x0; x < x1; x += 4) {
                int rgb = image.getRGB(x, y);
                if (((rgb >> 16) & 0xFF) < 120 && ((rgb >> 8) & 0xFF) < 120 && (rgb & 0xFF) < 120) return true;
            }
        }
        return false;
    }
}
