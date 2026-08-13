/**
 * Orchestration Agent: full product image generation pipeline (core of this solution's direction "AI Product Image Generation").
 *
 * Product image understanding → prompt design → five-image set generation → multi-platform size adaptation → quality inspection
 *
 * Five image types: white-background image / scene image / model image / comparison image / dimension diagram
 * Multi-platform: Amazon / TikTok Shop / Temu / Shopee (size and style matrix, see services/platformSpecs.ts)
 */
import { buildProductProfile } from './profileAgent.js';
import { designImagePrompts } from './promptAgent.js';
import { generateTypedImage, type GeneratedImage } from './imageAgent.js';
import { reviewImage, type QaResult } from './qaAgent.js';
import {
  DEFAULT_PLATFORM,
  IMAGE_TYPES,
  PLATFORM_IMAGE_SPECS,
  type ImageType,
} from '../services/platformSpecs.js';

export interface ImagePipelineInput {
  productName: string;
  sellingPoints: string;
  /** Target platforms (multi-select); the first platform generates all five image types, others generate white-background main image adaptation versions */
  platforms: string[];
  referenceImageUrl?: string;
}

export interface StepRecord {
  step: string;
  status: 'done' | 'failed' | 'skipped';
  detail?: string;
}

export interface ImagePipelineResult {
  steps: StepRecord[];
  profile?: string;
  images: GeneratedImage[];
  qa: QaResult[];
}

export async function runImagePipeline(
  input: ImagePipelineInput,
): Promise<ImagePipelineResult> {
  const steps: StepRecord[] = [];
  const images: GeneratedImage[] = [];
  const qa: QaResult[] = [];
  const result: ImagePipelineResult = { steps, images, qa };
  const platforms = input.platforms.length
    ? input.platforms
    : [DEFAULT_PLATFORM];

  // 1. Product image understanding → product profile
  let profile = '';
  try {
    profile = await buildProductProfile({
      productName: input.productName,
      sellingPoints: input.sellingPoints,
      referenceImageUrl: input.referenceImageUrl,
    });
    steps.push({ step: '商品图理解', status: 'done' });
  } catch (err) {
    profile = `商品：${input.productName}；卖点：${input.sellingPoints}`;
    steps.push({
      step: '商品图理解',
      status: 'failed',
      detail: `已降级为纯文本画像：${(err as Error).message}`,
    });
  }
  result.profile = profile;

  // 2. Prompt design + 3. Five-image set generation (per platform)
  for (let i = 0; i < platforms.length; i++) {
    const platform = platforms[i];
    const spec = PLATFORM_IMAGE_SPECS[platform] ?? {
      mainSize: '1024*1024',
      extraSizes: [],
      styleHint: '',
    };
    // The first platform generates all five image types; other platforms only generate white-background main image adaptation versions (demo cost control)
    const types: readonly ImageType[] =
      i === 0 ? IMAGE_TYPES : (['白底图'] as const);
    try {
      const prompts = await designImagePrompts({
        profile,
        platform,
        styleHint: spec.styleHint,
        productName: input.productName,
      });
      let okCount = 0;
      for (const type of types) {
        try {
          const img = await generateTypedImage({
            type,
            prompt: prompts[type],
            size: spec.mainSize,
            platform,
          });
          if (img) {
            images.push(img);
            okCount++;
          }
        } catch (err) {
          steps.push({
            step: `${platform} ${type}生成`,
            status: 'failed',
            detail: (err as Error).message,
          });
        }
      }
      steps.push({
        step: `${platform} 图片生成（${types.length} 类）`,
        status: okCount > 0 ? 'done' : 'failed',
        detail: `成功 ${okCount}/${types.length}`,
      });
    } catch (err) {
      steps.push({
        step: `${platform} 提示词设计`,
        status: 'failed',
        detail: (err as Error).message,
      });
    }
  }

  // 4. Quality inspection (white-background images are strictly inspected; if they fail, they can be regenerated via the frontend's manual trigger)
  const whiteBgImages = images.filter((img) => img.type === '白底图');
  if (whiteBgImages.length > 0) {
    for (const img of whiteBgImages) {
      try {
        qa.push(
          await reviewImage({
            type: img.type,
            url: img.url,
            productName: input.productName,
          }),
        );
      } catch {
        // reviewImage already has an internal fallback, so in theory this won't be reached
      }
    }
    steps.push({ step: '白底图质检', status: 'done' });
  } else {
    steps.push({ step: '白底图质检', status: 'skipped' });
  }

  return result;
}
