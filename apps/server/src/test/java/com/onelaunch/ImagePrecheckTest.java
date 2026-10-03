package com.onelaunch;

import org.junit.jupiter.api.Test;

import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.util.Random;

import static org.junit.jupiter.api.Assertions.*;

/** 本地预检检测器像素级验证：合成图像构造清晰/模糊/噪点/纯色背景/无人等边界样本。 */
class ImagePrecheckTest {
    private static final double BLUR = 50.0, NOISE = 20.0, SCENE_STD = 8.0, SKIN = 0.02;

    private BufferedImage sharpCleanImage() {
        BufferedImage img = new BufferedImage(256, 256, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        for (int y = 0; y < 256; y++) { // 平滑渐变背景（低频，不触发噪点/模糊）
            g.setColor(new Color(y, y, 255 - y));
            g.drawLine(0, y, 255, y);
        }
        g.setColor(Color.WHITE);
        g.fillRect(108, 108, 40, 40);
        g.setColor(Color.BLACK);
        g.setStroke(new BasicStroke(3));
        g.drawRect(106, 106, 44, 44); // 少量硬边缘提供清晰度
        g.dispose();
        return img;
    }

    private BufferedImage blur(BufferedImage src, int radius, int times) {
        BufferedImage cur = src;
        for (int t = 0; t < times; t++) {
            int w = cur.getWidth(), h = cur.getHeight();
            BufferedImage out = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
            for (int y = 0; y < h; y++) {
                for (int x = 0; x < w; x++) {
                    int r = 0, g = 0, b = 0, n = 0;
                    for (int dy = -radius; dy <= radius; dy += 2) {
                        for (int dx = -radius; dx <= radius; dx += 2) {
                            int sx = Math.min(w - 1, Math.max(0, x + dx)), sy = Math.min(h - 1, Math.max(0, y + dy));
                            int rgb = cur.getRGB(sx, sy);
                            r += (rgb >> 16) & 0xFF; g += (rgb >> 8) & 0xFF; b += rgb & 0xFF; n++;
                        }
                    }
                    out.setRGB(x, y, ((r / n) << 16) | ((g / n) << 8) | (b / n));
                }
            }
            cur = out;
        }
        return cur;
    }

    private BufferedImage speckle(BufferedImage src, int amplitude, long seed) {
        BufferedImage out = new BufferedImage(src.getWidth(), src.getHeight(), BufferedImage.TYPE_INT_RGB);
        Random random = new Random(seed);
        for (int y = 0; y < src.getHeight(); y++) {
            for (int x = 0; x < src.getWidth(); x++) {
                int rgb = src.getRGB(x, y);
                int d = random.nextInt(amplitude * 2 + 1) - amplitude;
                int r = clamp(((rgb >> 16) & 0xFF) + d), g = clamp(((rgb >> 8) & 0xFF) + d), b = clamp((rgb & 0xFF) + d);
                out.setRGB(x, y, (r << 16) | (g << 8) | b);
            }
        }
        return out;
    }

    private int clamp(int v) { return Math.max(0, Math.min(255, v)); }

    private ImagePrecheck.Result check(String type, BufferedImage img) {
        byte[] bytes = toPng(img);
        return ImagePrecheck.check(type, bytes, BLUR, SCENE_STD, SKIN, NOISE);
    }

    private byte[] toPng(BufferedImage img) {
        try {
            java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
            javax.imageio.ImageIO.write(img, "png", out);
            return out.toByteArray();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    @Test void sharpCleanImagePassesBlurAndNoiseChecks() {
        ImagePrecheck.Result result = check("白底图", sharpCleanImage());
        assertTrue(result.passed(), () -> "意外问题：" + result.issues());
    }

    @Test void blurredImageFailsSharpness() {
        ImagePrecheck.Result result = check("白底图", blur(sharpCleanImage(), 5, 3));
        assertFalse(result.passed());
        assertTrue(result.issues().stream().anyMatch(i -> i.contains("模糊")), () -> result.issues().toString());
    }

    @Test void speckleNoiseFailsNoiseCheck() {
        ImagePrecheck.Result result = check("白底图", speckle(sharpCleanImage(), 60, 42L));
        assertFalse(result.passed());
        assertTrue(result.hasNoiseIssue(), () -> result.issues().toString());
    }

    @Test void sceneImageRejectsUniformStudioBorderAndAcceptsTexturedBorder() {
        BufferedImage studio = new BufferedImage(256, 256, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = studio.createGraphics();
        g.setColor(Color.WHITE);
        g.fillRect(0, 0, 256, 256); // 纯白边缘帧 + 中心商品（摄影棚无缝背景）
        g.setColor(new Color(120, 90, 60));
        g.fillRect(108, 108, 40, 40);
        g.dispose();
        ImagePrecheck.Result studioResult = check("场景图", studio);
        assertFalse(studioResult.passed());
        assertTrue(studioResult.issues().stream().anyMatch(i -> i.contains("背景")), () -> studioResult.issues().toString());

        BufferedImage textured = new BufferedImage(256, 256, BufferedImage.TYPE_INT_RGB);
        Graphics2D g2 = textured.createGraphics();
        for (int y = 0; y < 256; y++) { // 全画幅渐变：边缘帧亮度标准差大，中心有硬边缘商品
            g2.setColor(new Color(60 + y / 2, 80, 160 - y / 3));
            g2.drawLine(0, y, 255, y);
        }
        g2.setColor(Color.WHITE);
        g2.fillRect(108, 108, 40, 40);
        g2.dispose();
        ImagePrecheck.Result texturedResult = check("场景图", textured);
        assertTrue(texturedResult.issues().stream().noneMatch(i -> i.contains("背景")), () -> texturedResult.issues().toString());
    }

    @Test void modelImageRequiresDetectablePerson() {
        BufferedImage noPerson = new BufferedImage(256, 256, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = noPerson.createGraphics();
        g.setColor(new Color(200, 200, 200));
        g.fillRect(0, 0, 256, 256); // 灰背景 + 深灰商品：无肤色
        g.setColor(new Color(90, 90, 90));
        g.fillRect(108, 108, 40, 40);
        g.dispose();
        ImagePrecheck.Result noPersonResult = check("模特图", noPerson);
        assertFalse(noPersonResult.passed());
        assertTrue(noPersonResult.issues().stream().anyMatch(i -> i.contains("人物")), () -> noPersonResult.issues().toString());

        BufferedImage withPerson = new BufferedImage(256, 256, BufferedImage.TYPE_INT_RGB);
        Graphics2D g2 = withPerson.createGraphics();
        g2.setColor(new Color(200, 200, 200));
        g2.fillRect(0, 0, 256, 256);
        g2.setColor(new Color(224, 172, 138)); // 肤色椭圆（面部/手部）
        g2.fillOval(78, 78, 100, 100);
        g2.dispose();
        ImagePrecheck.Result withPersonResult = check("模特图", withPerson);
        assertTrue(withPersonResult.issues().stream().noneMatch(i -> i.contains("人物")), () -> withPersonResult.issues().toString());
    }

    @Test void undecodableBytesAreLenientPass() {
        assertTrue(ImagePrecheck.check("白底图", new byte[]{1, 2, 3, 4}, BLUR, SCENE_STD, SKIN, NOISE).passed());
    }
}
