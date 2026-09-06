package com.onelaunch;

import org.junit.jupiter.api.Test;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import javax.imageio.ImageIO;
import static org.junit.jupiter.api.Assertions.*;

class DimensionGuideRendererTest {
    @Test void suppliedUnitsArePreservedAndUnrelatedNumbersIgnored() {
        var values = DimensionGuideRenderer.dimensions("演示：包体宽38cm、高30厘米、厚12cm，自重380g，可装15寸电脑");
        assertEquals(java.util.Map.of("Width", "38 cm", "Height", "30 cm", "Depth", "12 cm"), values);
        assertEquals("380 mm", DimensionGuideRenderer.dimensions("宽380毫米").get("Width"));
        assertTrue(DimensionGuideRenderer.dimensions("自重380g，可装15寸电脑").isEmpty());
        assertThrows(IllegalArgumentException.class, () -> DimensionGuideRenderer.dimensions("宽38cm，宽48cm"));
    }

    @Test void rendererProducesStableCanvasAndRetainsProductPixels() throws Exception {
        var source = new BufferedImage(100, 100, BufferedImage.TYPE_INT_RGB);
        var g = source.createGraphics(); g.setColor(java.awt.Color.RED); g.fillRect(0, 0, 100, 100); g.dispose();
        var bytes = new ByteArrayOutputStream(); ImageIO.write(source, "png", bytes);
        var output = ImageIO.read(new ByteArrayInputStream(DimensionGuideRenderer.render(bytes.toByteArray(), "宽38cm、高30cm、厚12cm")));
        assertEquals(1600, output.getWidth()); assertEquals(1200, output.getHeight());
        assertEquals(java.awt.Color.RED.getRGB(), output.getRGB(400, 600));
        assertThrows(IllegalArgumentException.class, () -> DimensionGuideRenderer.render(new byte[0], ""));
    }
}
