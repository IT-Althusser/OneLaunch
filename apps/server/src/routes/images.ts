import { Router } from 'express';
import {
  runImagePipeline,
  type ImagePipelineInput,
} from '../agents/orchestrator.js';
import { generateTypedImage, localizeImage } from '../agents/imageAgent.js';
import { IMAGE_TYPES, type ImageType } from '../services/platformSpecs.js';

export const imagesRouter = Router();

/** POST /api/images/set — full image generation pipeline (five-image set + multi-platform adaptation + quality inspection) */
imagesRouter.post('/set', async (req, res) => {
  try {
    const { productName, sellingPoints, platforms, referenceImageUrl } = (req.body ??
      {}) as Partial<ImagePipelineInput>;
    if (!productName || !sellingPoints) {
      res
        .status(400)
        .json({ error: 'productName and sellingPoints are required' });
      return;
    }
    const result = await runImagePipeline({
      productName,
      sellingPoints,
      platforms: Array.isArray(platforms) ? platforms : [],
      referenceImageUrl,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** POST /api/images/single — single-image regeneration (used for manual regeneration after quality inspection failure) */
imagesRouter.post('/single', async (req, res) => {
  try {
    const { type, prompt, size, platform } = (req.body ?? {}) as {
      type?: string;
      prompt?: string;
      size?: string;
      platform?: string;
    };
    if (!type || !prompt) {
      res.status(400).json({ error: 'type and prompt are required' });
      return;
    }
    if (!IMAGE_TYPES.includes(type as ImageType)) {
      res.status(400).json({
        error: `type must be one of: ${IMAGE_TYPES.join(', ')}`,
      });
      return;
    }
    const image = await generateTypedImage({
      type: type as ImageType,
      prompt,
      size: size ?? '1024*1024',
      platform: platform ?? 'Amazon',
    });
    res.json({ image });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** POST /api/images/localize — image localization (background / text / model replacement, async task returns taskId) */
imagesRouter.post('/localize', async (req, res) => {
  try {
    const { sourceUrl, targetMarket, instruction } = (req.body ?? {}) as {
      sourceUrl?: string;
      targetMarket?: string;
      instruction?: string;
    };
    if (!sourceUrl) {
      res.status(400).json({ error: 'sourceUrl is required' });
      return;
    }
    const taskId = await localizeImage({
      sourceUrl,
      targetMarket: targetMarket ?? 'US',
      instruction:
        instruction ?? '替换背景场景与文字语言，符合当地市场审美',
    });
    res.json({ taskId });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
