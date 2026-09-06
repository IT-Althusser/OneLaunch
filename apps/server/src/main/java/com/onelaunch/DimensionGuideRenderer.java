package com.onelaunch;

import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Pattern;
import javax.imageio.ImageIO;

/** Render supplied measurements without asking an image model to draw text. */
final class DimensionGuideRenderer {
    private DimensionGuideRenderer() {}

    static Map<String, String> dimensions(String facts) {
        Map<String, String> values = new LinkedHashMap<>();
        String[] names = {"Width", "Height", "Depth", "Length"};
        String[] labels = {"宽(?:度)?|width", "高(?:度)?|height", "厚(?:度)?|深(?:度)?|depth", "长(?:度)?|length"};
        for (int i = 0; i < names.length; i++) {
            var match = Pattern.compile("(?:" + labels[i] + ")\\s*[:：]?\\s*(\\d+(?:\\.\\d+)?)\\s*(cm|mm|in|厘米|毫米|英寸)(?![a-zA-Z])", Pattern.CASE_INSENSITIVE)
                    .matcher(facts == null ? "" : facts);
            while (match.find()) {
                if (Double.parseDouble(match.group(1)) <= 0) throw new IllegalArgumentException("尺寸必须大于零");
                String unit = switch (match.group(2).toLowerCase()) {
                    case "厘米" -> "cm"; case "毫米" -> "mm"; case "英寸" -> "in"; default -> match.group(2).toLowerCase();
                };
                String value = match.group(1) + " " + unit;
                String previous = values.putIfAbsent(names[i], value);
                if (previous != null && !previous.equals(value)) throw new IllegalArgumentException("商品资料存在冲突尺寸：" + names[i]);
            }
        }
        return values;
    }

    static byte[] render(byte[] source, String facts) {
        try {
            BufferedImage product = ImageIO.read(new ByteArrayInputStream(source));
            if (product == null) throw new IllegalArgumentException("尺寸图参考图片无法读取");
            Map<String, String> values = dimensions(facts);
            BufferedImage output = new BufferedImage(1600, 1200, BufferedImage.TYPE_INT_RGB);
            Graphics2D g = output.createGraphics();
            try {
                g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
                g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
                g.setColor(Color.WHITE); g.fillRect(0, 0, 1600, 1200);
                double scale = Math.min(900.0 / product.getWidth(), 930.0 / product.getHeight());
                int width = (int) (product.getWidth() * scale), height = (int) (product.getHeight() * scale);
                g.drawImage(product, 30 + (900 - width) / 2, 160 + (930 - height) / 2, width, height, null);
                g.setColor(new Color(32, 38, 43));
                boolean demo = facts != null && facts.contains("演示");
                g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 48));
                g.drawString(values.isEmpty() ? "Measurement guide" : demo ? "DEMO DIMENSIONS - NOT MEASURED" : "Product dimensions", 60, 100);
                g.setFont(new Font(Font.SANS_SERIF, Font.PLAIN, 27));
                g.drawString(demo ? "DEMO - NOT MEASURED" : "Dimensions", 995, 235);
                int y = 340;
                for (String name : new String[]{"Width", "Height", "Depth", "Length"}) {
                    if (!values.isEmpty() && !values.containsKey(name)) continue;
                    if (values.isEmpty() && name.equals("Length")) continue;
                    g.setFont(new Font(Font.SANS_SERIF, Font.PLAIN, 31));
                    g.setColor(new Color(82, 89, 94)); g.drawString(name, 995, y);
                    g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 42));
                    g.setColor(new Color(32, 38, 43));
                    String value = values.getOrDefault(name, "Not supplied");
                    while (g.getFontMetrics().stringWidth(value) > 520) g.setFont(g.getFont().deriveFont(g.getFont().getSize2D() - 1));
                    g.drawString(value, 995, y + 60); y += 170;
                }
                g.setFont(new Font(Font.SANS_SERIF, Font.PLAIN, 24));
                g.drawString("Product image not to scale", 995, 1090);
            } finally { g.dispose(); }
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            ImageIO.write(output, "png", bytes);
            return bytes.toByteArray();
        } catch (java.io.IOException e) { throw new IllegalStateException("尺寸图排版失败", e); }
    }
}
