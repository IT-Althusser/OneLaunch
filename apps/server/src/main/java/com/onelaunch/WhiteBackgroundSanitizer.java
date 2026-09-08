package com.onelaunch;

import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.ArrayDeque;
import java.util.Deque;
import javax.imageio.ImageIO;

/**
 * 白底图背景纯白化（确定性后处理）。
 *
 * 根因：图生图模型对低质量参考图（JPEG 噪点/瓷砖纹理）存在噪点传导，提示词无法根治——
 * 实测 qwen-image-2.0 在噪点参考图上持续输出"灰白底+黑白斑点"背景，修复重试也不收敛。
 * 本工具用 Java 2D 做确定性处理，保证 Amazon 主图规范「背景纯白 RGB(255,255,255)」必然达成：
 * 1. flood-fill 从四条边扩散，仅通过"亮且低饱和"像素（白/灰白背景），深色或彩色商品自动成为边界；
 * 2. 连通分量结构判定：深色分量若完全被背景包围（不接触任何商品像素）即噪点/独立阴影，并入背景；
 *    与商品相连的部件（提带、贴瓶底阴影）保留；商品内部亮色区域（白字、反光）被商品包围天然保留；
 * 3. 背景区域整块填 RGB(255,255,255)。
 * 兜底：flood 覆盖率异常（<5% 或 >90%，商品满幅或图片异常）时原样返回。
 */
final class WhiteBackgroundSanitizer {
    private WhiteBackgroundSanitizer() {}

    /** 背景像素：亮度不低于该值。 */
    private static final int BG_LUMA = 190;
    /** 背景像素：RGB 通道极差不超过该值（低饱和，排除琥珀色等彩色商品）。 */
    private static final int BG_SATURATION = 45;

    /** 判断图片背景是否已纯白：四角与四边中点采样均 ≥250（供直出路径区分「已纯白无需处理」与「sanitize 无效」）。 */
    static boolean isWhiteBackgroundImage(byte[] imageBytes) {
        try {
            BufferedImage img = ImageIO.read(new ByteArrayInputStream(imageBytes));
            if (img == null) return false;
            int w = img.getWidth(), h = img.getHeight();
            int[][] samples = {{2, 2}, {w - 3, 2}, {2, h - 3}, {w - 3, h - 3}, {w / 2, 2}, {w / 2, h - 3}, {2, h / 2}, {w - 3, h / 2}};
            for (int[] s : samples) {
                int rgb = img.getRGB(s[0], s[1]);
                if (((rgb >> 16) & 0xFF) < 250 || ((rgb >> 8) & 0xFF) < 250 || (rgb & 0xFF) < 250) return false;
            }
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    static byte[] sanitize(byte[] source) {
        try {
            BufferedImage image = ImageIO.read(new ByteArrayInputStream(source));
            if (image == null) throw new IllegalArgumentException("白底图无法读取");
            int w = image.getWidth(), h = image.getHeight();
            int total = w * h;
            int[] pixels = image.getRGB(0, 0, w, h, null, 0, w);

            boolean[] background = new boolean[total];
            Deque<Integer> queue = new ArrayDeque<>();
            for (int x = 0; x < w; x++) {
                offer(queue, background, pixels, x);
                offer(queue, background, pixels, (h - 1) * w + x);
            }
            for (int y = 0; y < h; y++) {
                offer(queue, background, pixels, y * w);
                offer(queue, background, pixels, y * w + w - 1);
            }
            while (!queue.isEmpty()) {
                int i = queue.poll();
                int x = i % w, y = i / w;
                if (x > 0) offer(queue, background, pixels, i - 1);
                if (x < w - 1) offer(queue, background, pixels, i + 1);
                if (y > 0) offer(queue, background, pixels, i - w);
                if (y < h - 1) offer(queue, background, pixels, i + w);
            }

            int covered = 0;
            for (boolean b : background) if (b) covered++;
            if (covered < total * 0.05 || covered > total * 0.90) return source; // 商品满幅或异常：不处理

            // 背景膨胀 1px：仅吃掉紧贴商品的最外圈光晕；膨胀带直接填纯白。
            // 实测：膨胀 5px 砍出锯齿、2px 灰度羽化带会被质检判"灰白斑点/黑边伪影"，1px 纯白最稳。
            for (int round = 0; round < 1; round++) {
                boolean[] grown = new boolean[total];
                for (int i = 0; i < total; i++) {
                    if (background[i]) { grown[i] = true; continue; }
                    int x = i % w, y = i / w;
                    if ((x > 0 && background[i - 1]) || (x < w - 1 && background[i + 1])
                            || (y > 0 && background[i - w]) || (y < h - 1 && background[i + w])) grown[i] = true;
                }
                background = grown;
            }

            // 连通分量结构判定：非背景分量若与商品主体（最大分量）不相连，即为噪点/离群碎块，并入背景；
            // 深色、彩色亮斑一并清除；商品内部白字/反光与主体相连天然保留。
            boolean[] visited = new boolean[total];
            java.util.List<Integer> members = new java.util.ArrayList<>();
            int largestSize = 0;
            boolean[] largestMark = new boolean[0];
            for (int start = 0; start < total; start++) {
                if (visited[start] || background[start]) continue;
                Deque<Integer> stack = new ArrayDeque<>();
                stack.push(start);
                visited[start] = true;
                members.clear();
                while (!stack.isEmpty()) {
                    int i = stack.pop();
                    members.add(i);
                    int x = i % w, y = i / w;
                    if (x > 0) expand(stack, visited, background, i - 1);
                    if (x < w - 1) expand(stack, visited, background, i + 1);
                    if (y > 0) expand(stack, visited, background, i - w);
                    if (y < h - 1) expand(stack, visited, background, i + w);
                }
                if (members.size() > largestSize) {
                    largestSize = members.size();
                    largestMark = new boolean[total];
                    for (int i : members) largestMark[i] = true;
                }
            }
            // 商品主体 bbox：用于底部阴影定向判定
            int minX = w, maxX = 0, minY = h, maxY = 0;
            for (int i = 0; i < total; i++) {
                if (!largestMark[i]) continue;
                int x = i % w, y = i / w;
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
            // 非最大分量且（面积 ≤ 商品主体 10%，或位于商品底部区域的低饱和深色阴影）→ 并入背景；
            // 面积上限保护商品部件（瓶盖等即便被细缝切开也不会误清）
            java.util.Arrays.fill(visited, false);
            java.util.List<Integer> fragment = new java.util.ArrayList<>();
            for (int start = 0; start < total; start++) {
                if (visited[start] || background[start] || largestMark[start]) continue;
                Deque<Integer> stack = new ArrayDeque<>();
                stack.push(start);
                visited[start] = true;
                fragment.clear();
                int fragMinY = h;
                boolean unsaturated = true;
                while (!stack.isEmpty()) {
                    int i = stack.pop();
                    fragment.add(i);
                    int y = i / w;
                    if (y < fragMinY) fragMinY = y;
                    int r = (pixels[i] >> 16) & 0xFF, g = (pixels[i] >> 8) & 0xFF, b = pixels[i] & 0xFF;
                    if (Math.max(r, Math.max(g, b)) - Math.min(r, Math.min(g, b)) > 40) unsaturated = false;
                    int x = i % w;
                    if (x > 0) collect(stack, visited, background, i - 1);
                    if (x < w - 1) collect(stack, visited, background, i + 1);
                    if (y > 0) collect(stack, visited, background, i - w);
                    if (y < h - 1) collect(stack, visited, background, i + w);
                }
                boolean bottomShadow = unsaturated && fragMinY >= maxY - 8; // 完全位于商品底部及以下的低饱和块（阴影）
                if (fragment.size() <= largestSize * 0.1 || bottomShadow) {
                    for (int i : fragment) background[i] = true;
                }
            }

            // 贴底阴影清除：商品 bbox 底边以下的所有非商品像素（阴影/杂色）清空；
            // 贴底带（底边上方 15px）内的低饱和深灰（软阴影核心）清除——彩色商品部件不受影响
            for (int i = 0; i < total; i++) {
                if (background[i] || largestMark[i]) continue;
                int y = i / w;
                if (y >= maxY + 1) {
                    background[i] = true;
                } else if (y >= maxY - 15) {
                    int rgb = pixels[i];
                    int r = (rgb >> 16) & 0xFF, g = (rgb >> 8) & 0xFF, b = rgb & 0xFF;
                    if (Math.max(r, Math.max(g, b)) - Math.min(r, Math.min(g, b)) <= 40
                            && (r * 299 + g * 587 + b * 114) / 1000 < 120) background[i] = true;
                }
            }

            for (int i = 0; i < total; i++) {
                if (background[i]) pixels[i] = 0xFFFFFFFF;
            }
            image.setRGB(0, 0, w, h, pixels, 0, w);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            ImageIO.write(image, "png", out);
            return out.toByteArray();
        } catch (Exception e) {
            org.slf4j.LoggerFactory.getLogger(WhiteBackgroundSanitizer.class)
                    .warn("白底图背景纯白化失败，保留原图：{}", e.getMessage());
            return source;
        }
    }

    /** 分量扩散：邻接的非背景未访问像素并入当前分量。 */
    private static void expand(Deque<Integer> stack, boolean[] visited, boolean[] background, int n) {
        if (background[n] || visited[n]) return;
        visited[n] = true;
        stack.push(n);
    }

    /** 碎块收集：邻接的非背景未访问且不属于商品主体的像素并入待清除碎块。 */
    private static void collect(Deque<Integer> stack, boolean[] visited, boolean[] background, int n) {
        if (background[n] || visited[n]) return;
        visited[n] = true;
        stack.push(n);
    }

    private static void offer(Deque<Integer> queue, boolean[] background, int[] pixels, int i) {
        if (background[i] || !isBackgroundPixel(pixels[i])) return;
        background[i] = true;
        queue.offer(i);
    }

    /** 背景候选：亮且低饱和（白/灰白）。琥珀色等彩色商品即使亮度高也不会通过。 */
    private static boolean isBackgroundPixel(int rgb) {
        int r = (rgb >> 16) & 0xFF, g = (rgb >> 8) & 0xFF, b = rgb & 0xFF;
        int max = Math.max(r, Math.max(g, b)), min = Math.min(r, Math.min(g, b));
        return (r * 299 + g * 587 + b * 114) / 1000 >= BG_LUMA && max - min <= BG_SATURATION;
    }
}
