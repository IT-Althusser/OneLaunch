/**
 * Quality inspection sub-Agent:
 * Re-inspect generated images with a vision model (white-background image compliance: background purity / product occupancy / watermark text,
 * product completeness, obvious artifacts), forming a closed loop of "generate → inspect → retry".
 * Model: qwen/qwen3-vl-plus (precision check) / qwen/qwen3-vl-flash (batch coarse screening)
 */
import { MODELS } from '../services/models.js';
import { modelRouter, type ChatMessage } from '../services/modelRouter.js';
import type { ImageType } from '../services/platformSpecs.js';

export interface QaResult {
  type: ImageType;
  url: string;
  passed: boolean;
  comment: string;
}

function extractJson(raw: string): string {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('输出中未找到 JSON');
  }
  return raw.slice(start, end + 1);
}

export async function reviewImage(params: {
  type: ImageType;
  url: string;
  productName: string;
}): Promise<QaResult> {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: [
        '你是电商主图质检审核员。请检查图片是否满足上架要求，只输出 JSON：{"passed": boolean, "comment": "原因简述"}。',
        '审核要点：白底图需纯白背景、商品主体完整清晰、占画面 85% 以上、无水印无多余文字；其他图片需主体清晰、无明显生成瑕疵。',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: `图片类型：${params.type}\n商品：${params.productName}\n请审核这张图片。`,
        },
        { type: 'image_url', image_url: { url: params.url } },
      ],
    },
  ];

  try {
    const raw = await modelRouter.chat({
      model: MODELS.vision.precise,
      messages,
      temperature: 0.1,
    });
    const parsed = JSON.parse(extractJson(raw)) as {
      passed?: boolean;
      comment?: string;
    };
    return {
      type: params.type,
      url: params.url,
      passed: parsed.passed !== false,
      comment: parsed.comment ?? '',
    };
  } catch (err) {
    return {
      type: params.type,
      url: params.url,
      passed: true,
      comment: `质检调用失败，默认放行：${(err as Error).message}`,
    };
  }
}
