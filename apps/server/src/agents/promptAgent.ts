/**
 * Prompt design sub-Agent:
 * Based on product profile + platform style requirements, design generation prompts for the five image types
 * (white-background image / scene image / model image / comparison image / dimension diagram).
 * Model: qwen/qwen3.7-max
 */
import { MODELS } from '../services/models.js';
import { modelRouter, type ChatMessage } from '../services/modelRouter.js';
import { IMAGE_TYPES, type ImageType } from '../services/platformSpecs.js';

/** Extract JSON object from model output (tolerant of markdown code block wrapping) */
function extractJson(raw: string): string {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('输出中未找到 JSON');
  }
  return raw.slice(start, end + 1);
}

/** Default fallback prompt for each image type (used when model output parsing fails) */
function fallbackPrompts(productName: string): Record<ImageType, string> {
  return {
    白底图: `E-commerce product photo of "${productName}", pure white background, studio lighting, product centered and occupying 85% of frame, high detail, commercial quality`,
    场景图: `Lifestyle scene photo of "${productName}" in a realistic usage scenario, natural lighting, cozy atmosphere, commercial quality`,
    模特图: `A model using or wearing "${productName}", fashion e-commerce photography, natural pose, studio lighting`,
    对比图: `Side-by-side comparison photo showing "${productName}" benefits, before and after layout, clean infographic style`,
    尺寸图: `Product dimension diagram of "${productName}" with clean measurement annotations on white background, technical illustration style`,
  };
}

export async function designImagePrompts(params: {
  profile: string;
  platform: string;
  styleHint: string;
  productName: string;
}): Promise<Record<ImageType, string>> {
  const fallback = fallbackPrompts(params.productName);
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: [
        `你是电商商品图生成提示词工程师。请根据商品画像与平台要求，为五种图片类型（${IMAGE_TYPES.join('、')}）各写一条英文生成提示词，供图片生成模型使用。`,
        '要求：',
        '- 白底图：必须包含 pure white background，商品占画面 85% 以上，无水印无文字',
        '- 场景图：指定具体使用场景与光线氛围',
        '- 模特图：指定模特形象与使用动作',
        '- 对比图：说明对比方式（使用前后 / 尺寸参照 / 卖点突出）',
        '- 尺寸图：说明尺寸标注线与数值的排版方式',
        '- 所有提示词都要融入商品外观特征与平台风格要求',
        '只输出 JSON，格式：{"白底图":"...","场景图":"...","模特图":"...","对比图":"...","尺寸图":"..."}',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        '商品画像：',
        params.profile,
        '',
        `目标平台：${params.platform}`,
        `平台风格要求：${params.styleHint}`,
      ].join('\n'),
    },
  ];

  try {
    const raw = await modelRouter.chat({
      model: MODELS.text.flagship,
      messages,
      temperature: 0.7,
    });
    const parsed = JSON.parse(extractJson(raw)) as Partial<
      Record<ImageType, string>
    >;
    const result = { ...fallback };
    for (const type of IMAGE_TYPES) {
      const value = parsed[type];
      if (typeof value === 'string' && value.trim()) {
        result[type] = value.trim();
      }
    }
    return result;
  } catch {
    return fallback;
  }
}
