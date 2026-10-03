package com.onelaunch;

import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.util.ArrayList;
import java.util.List;
import javax.imageio.ImageIO;

/**
 * 图像本地预检（Java 2D 纯本地启发式，零模型成本）：在视觉质检前做快速失败闸门——
 * 全图类清晰度（拉普拉斯方差）与全画幅噪点（3x3 中值残差）、场景图背景均匀度（边缘帧亮度标准差）、
 * 模特图人物存在性（中心区肤色占比）。
 * 定位是快速失败而非最终判定：阈值宁松勿紧防误杀（application.yml quality-policy 可调）；
 * 预检不通过直接进修复循环并跳过视觉质检调用（省下的调用抵消参考图视觉画像的 +1），
 * 视觉质检仍在修复后对最终候选图执行一次。加载或解码失败由调用方降级为跳过预检，不阻断流水线。
 */
final class ImagePrecheck {
    /** 预检结果：passed=false 时 issues 为可直接拼入修复指令的中文问题列表。 */
    record Result(boolean passed, List<String> issues) {
        public boolean hasNoiseIssue() { return issues.stream().anyMatch(i -> i.contains("噪点")); }
    }

    private ImagePrecheck() {}

    static Result check(String type, byte[] imageBytes, double blurVariance, double sceneBorderStd, double skinRatio, double noiseMad) {
        List<String> issues = new ArrayList<>();
        BufferedImage img = decode(imageBytes);
        if (img == null) return new Result(true, issues); // 解码失败不拦截，交视觉质检判定
        BufferedImage small = downscale(img, 512);
        double lap = laplacianVariance(small);
        double residual = medianResidual(small);
        if (lap < blurVariance) issues.add(String.format("画面模糊（清晰度方差 %.1f 低于阈值 %.1f）", lap, blurVariance));
        if (residual > noiseMad) issues.add(String.format("全画幅重度噪点（噪点残差 %.1f 高于阈值 %.1f）", residual, noiseMad));
        if ("场景图".equals(type)) {
            double borderStd = borderLuminanceStd(small, Math.max(2, Math.min(small.getWidth(), small.getHeight()) / 10));
            if (borderStd < sceneBorderStd) {
                issues.add(String.format("背景为纯色/摄影棚无缝背景，无可辨认环境（边缘亮度标准差 %.1f）", borderStd));
            }
        }
        if ("模特图".equals(type)) {
            double skin = centralSkinRatio(small);
            if (skin < skinRatio) {
                issues.add(String.format("未检测到人物（中心区肤色占比 %.1f%%）", skin * 100));
            }
        }
        return new Result(issues.isEmpty(), issues);
    }

    private static BufferedImage decode(byte[] bytes) {
        try {
            return ImageIO.read(new java.io.ByteArrayInputStream(bytes));
        } catch (Exception e) {
            return null;
        }
    }

    /** 缩到 max 边长以内再算指标：速度稳定，且削弱分辨率差异对阈值的影响。 */
    private static BufferedImage downscale(BufferedImage src, int maxSide) {
        int w = src.getWidth(), h = src.getHeight();
        int side = Math.max(w, h);
        if (side <= maxSide) return toRgb(src);
        double scale = (double) maxSide / side;
        int nw = Math.max(1, (int) Math.round(w * scale)), nh = Math.max(1, (int) Math.round(h * scale));
        BufferedImage out = new BufferedImage(nw, nh, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = out.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
        g.drawImage(src, 0, 0, nw, nh, null);
        g.dispose();
        return out;
    }

    private static BufferedImage toRgb(BufferedImage src) {
        if (src.getType() == BufferedImage.TYPE_INT_RGB) return src;
        BufferedImage out = new BufferedImage(src.getWidth(), src.getHeight(), BufferedImage.TYPE_INT_RGB);
        Graphics2D g = out.createGraphics();
        g.drawImage(src, 0, 0, null);
        g.dispose();
        return out;
    }

    private static int[][] gray(BufferedImage img) {
        int w = img.getWidth(), h = img.getHeight();
        int[][] g = new int[w][h];
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) {
                int rgb = img.getRGB(x, y);
                int r = (rgb >> 16) & 0xFF, gr = (rgb >> 8) & 0xFF, b = rgb & 0xFF;
                g[x][y] = (int) (0.299 * r + 0.587 * gr + 0.114 * b);
            }
        }
        return g;
    }

    /** 拉普拉斯响应方差：清晰图像边缘丰富方差高，模糊/马赛克图像方差极低。 */
    static double laplacianVariance(BufferedImage img) {
        int[][] g = gray(img);
        int w = g.length, h = g[0].length;
        double sum = 0, sumSq = 0;
        long n = 0;
        for (int y = 1; y < h - 1; y++) {
            for (int x = 1; x < w - 1; x++) {
                double lap = 4.0 * g[x][y] - g[x - 1][y] - g[x + 1][y] - g[x][y - 1] - g[x][y + 1];
                sum += lap;
                sumSq += lap * lap;
                n++;
            }
        }
        if (n == 0) return 0;
        double mean = sum / n;
        return sumSq / n - mean * mean;
    }

    /** 3x3 中值残差均值：椒盐/散斑类全画幅噪点残差高，平滑或仅含少量边缘的正常图像残差低。 */
    static double medianResidual(BufferedImage img) {
        int[][] g = gray(img);
        int w = g.length, h = g[0].length;
        double total = 0;
        long n = 0;
        int[] window = new int[9];
        for (int y = 1; y < h - 1; y++) {
            for (int x = 1; x < w - 1; x++) {
                int k = 0;
                for (int dy = -1; dy <= 1; dy++) {
                    for (int dx = -1; dx <= 1; dx++) {
                        window[k++] = g[x + dx][y + dy];
                    }
                }
                java.util.Arrays.sort(window);
                total += Math.abs(g[x][y] - window[4]);
                n++;
            }
        }
        return n == 0 ? 0 : total / n;
    }

    /** 边缘帧亮度标准差：真实场景背景有纹理与光影层次，纯色/摄影棚无缝背景标准差趋近 0。 */
    static double borderLuminanceStd(BufferedImage img, int band) {
        int[][] g = gray(img);
        int w = g.length, h = g[0].length;
        double sum = 0, sumSq = 0;
        long n = 0;
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) {
                if (x < band || x >= w - band || y < band || y >= h - band) {
                    sum += g[x][y];
                    sumSq += (double) g[x][y] * g[x][y];
                    n++;
                }
            }
        }
        if (n == 0) return 0;
        double mean = sum / n;
        return Math.sqrt(Math.max(0, sumSq / n - mean * mean));
    }

    /** 中心区肤色像素占比（Kovac 规则）：模特图必须有人，无人/仅商品的图肤色占比趋近 0。 */
    static double centralSkinRatio(BufferedImage img) {
        int w = img.getWidth(), h = img.getHeight();
        int x0 = w / 4, x1 = w * 3 / 4, y0 = h / 4, y1 = h * 3 / 4;
        long total = 0, skin = 0;
        for (int y = y0; y < y1; y++) {
            for (int x = x0; x < x1; x++) {
                int rgb = img.getRGB(x, y);
                int r = (rgb >> 16) & 0xFF, g = (rgb >> 8) & 0xFF, b = rgb & 0xFF;
                total++;
                int max = Math.max(r, Math.max(g, b)), min = Math.min(r, Math.min(g, b));
                if (r > 95 && g > 40 && b > 20 && max - min > 15 && Math.abs(r - g) > 15 && r > g && r > b) {
                    skin++;
                }
            }
        }
        return total == 0 ? 0 : (double) skin / total;
    }
}
