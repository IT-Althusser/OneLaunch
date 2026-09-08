package com.onelaunch;

import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import javax.imageio.ImageIO;

/**
 * 对比图确定性合成（左整体 + 右局部放大，纯 Java 2D 像素合成）。
 *
 * 根因：图生图模型生成「局部放大特写」时对商品表面做重绘，实测持续输出
 * 放大区噪点、颗粒伪影与文字扭曲（提示词与修复轮均无法根治——2026-09-08 五图验收复现）。
 * 本工具以参考图照片像素为唯一来源做确定性合成，商品本体 0% 重绘、固有印刷照片级保真：
 * 1. 源图先经 WhiteBackgroundSanitizer 纯白化（背景 RGB 255,255,255）；
 * 2. 左半区：整图等比缩放居中（商品完整整体）；
 * 3. 右半区：源图上部中心条带（盖体与瓶颈结构）裁剪后放大，作为局部特写；
 * 4. 画布为纯白 3:2 横版（与前端对比图默认画幅一致）。
 * 可见文字均为照片像素：无臆造、无模型噪点；左侧整体文字完整，右侧特写文字随放大区域自然呈现。
 */
final class CompositeCompareRenderer {
    private CompositeCompareRenderer() {}

    /** 输出画布（3:2 横版，与前端对比图默认画幅一致）。 */
    private static final int CANVAS_W = 2048;
    private static final int CANVAS_H = 1365;
    /** 局部特写取商品主体上部比例（瓶盖/提手等顶部主结构，避开竖排长文字的下半截）。 */
    private static final double CROP_TOP_RATIO = 0.34;
    /** 两侧图区边距（占半区宽高比），保证留白呼吸感。 */
    private static final double MARGIN = 0.06;

    static byte[] render(byte[] sanitizedSource) {
        try {
            BufferedImage source = ImageIO.read(new ByteArrayInputStream(sanitizedSource));
            if (source == null) throw new IllegalArgumentException("对比图源图无法读取");
            BufferedImage canvas = new BufferedImage(CANVAS_W, CANVAS_H, BufferedImage.TYPE_INT_RGB);
            Graphics2D g = canvas.createGraphics();
            try {
                g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
                g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
                g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
                g.setColor(java.awt.Color.WHITE);
                g.fillRect(0, 0, CANVAS_W, CANVAS_H);
                int half = CANVAS_W / 2;
                drawFull(g, source, half);
                drawZoom(g, source, half);
            } finally {
                g.dispose();
            }
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            ImageIO.write(canvas, "png", out);
            return out.toByteArray();
        } catch (Exception e) {
            throw new IllegalStateException("对比图确定性合成失败：" + e.getMessage(), e);
        }
    }

    /** 左半区：整图等比缩放居中（高度撑满 1-2×margin）。 */
    private static void drawFull(Graphics2D g, BufferedImage source, int half) {
        int boxW = (int) (half * (1 - 2 * MARGIN));
        int boxH = (int) (CANVAS_H * (1 - 2 * MARGIN));
        int x0 = (int) (half * MARGIN);
        int y0 = (int) (CANVAS_H * MARGIN);
        drawScaled(g, source, 0, 0, source.getWidth(), source.getHeight(), x0, y0, boxW, boxH, half / 2);
    }

    /**
     * 右半区：商品主体上部（瓶盖/提手等顶部结构）局部放大特写。
     * 商品 bbox 自适应：特写区水平取商品完整宽度（水平文字如瓶盖 JUST IN 不截断），
     * 垂直取商品上部 34%（避开竖排长文字下半截，减少文字被边缘截断的判定风险）。
     */
    private static void drawZoom(Graphics2D g, BufferedImage source, int half) {
        int sw = source.getWidth(), sh = source.getHeight();
        int[] bbox = productBBox(source);
        int pad = (int) (Math.max(sw, sh) * 0.02);
        int cropX = pad, cropY = pad, cropW = sw - 2 * pad, cropH = (int) (sh * 0.45);
        if (bbox != null) {
            cropX = Math.max(0, bbox[0] - pad);
            cropY = Math.max(0, bbox[1] - pad / 2);
            cropW = Math.min(sw - cropX, (bbox[2] - bbox[0]) + 2 * pad);
            cropH = Math.min(sh - cropY, (int) ((bbox[3] - bbox[1]) * CROP_TOP_RATIO) + pad);
        }
        if (cropW < 8 || cropH < 8) { // 极端退化：保底整图上部
            cropX = 0; cropY = 0; cropW = sw; cropH = (int) (sh * 0.45);
        }
        int boxW = (int) (half * (1 - 2 * MARGIN));
        int boxH = (int) (CANVAS_H * (1 - 2 * MARGIN));
        int x0 = half + (int) (half * MARGIN);
        int y0 = (int) (CANVAS_H * MARGIN);
        drawScaled(g, source, cropX, cropY, cropW, cropH, x0, y0, boxW, boxH, half + half / 2);
    }

    /** 商品主体 bbox：非纯白像素的边界 [minX, minY, maxX, maxY]；全白图返回 null。 */
    private static int[] productBBox(BufferedImage source) {
        int w = source.getWidth(), h = source.getHeight();
        int minX = w, minY = h, maxX = -1, maxY = -1;
        for (int y = 0; y < h; y += 2) {
            for (int x = 0; x < w; x += 2) {
                int rgb = source.getRGB(x, y);
                if (((rgb >> 16) & 0xFF) < 245 || ((rgb >> 8) & 0xFF) < 245 || (rgb & 0xFF) < 245) {
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
            }
        }
        if (maxX < 0) return null;
        return new int[]{minX, minY, maxX, maxY};
    }

    /** 等比缩放绘制到目标盒内并居中（centerX 用于水平居中锚点）。 */
    private static void drawScaled(Graphics2D g, BufferedImage source, int sx, int sy, int sw, int sh,
                                   int boxX, int boxY, int boxW, int boxH, int centerX) {
        double scale = Math.min((double) boxW / sw, (double) boxH / sh);
        int dw = (int) Math.round(sw * scale);
        int dh = (int) Math.round(sh * scale);
        int dx = centerX - dw / 2;
        int dy = boxY + (boxH - dh) / 2;
        g.drawImage(source, dx, dy, dx + dw, dy + dh, sx, sy, sx + sw, sy + sh, null);
    }
}
