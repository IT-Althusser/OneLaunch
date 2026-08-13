/**
 * Product image understanding sub-Agent:
 * VL model parses the reference image + selling points → structured product profile, providing input for subsequent image generation.
 * Model: qwen/qwen3-vl-plus (when reference image present) / qwen/qwen3.7-max (pure text)
 */
import { MODELS } from '../services/models.js';
import { modelRouter, type ChatMessage } from '../services/modelRouter.js';

export interface ProfileInput {
  productName: string;
  sellingPoints: string;
  referenceImageUrl?: string;
}

const SYSTEM_PROMPT = `你是电商商品视觉分析专家。请根据商品信息（和参考图）输出用于商品图生成的结构化商品画像 JSON（不要输出任何解释）。字段：
- category: 商品品类
- appearance: 外观特征（颜色/材质/形状/关键细节）
- audience: 目标人群
- scenes: 3 个最适合的使用场景
- style_keywords: 3-5 个视觉风格关键词`;

export async function buildProductProfile(
  input: ProfileInput,
): Promise<string> {
  const userText = `商品：${input.productName}\n卖点：${input.sellingPoints}`;
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: input.referenceImageUrl
        ? [
            {
              type: 'text',
              text: `${userText}\n请结合附带的商品参考图进行分析。`,
            },
            {
              type: 'image_url',
              image_url: { url: input.referenceImageUrl },
            },
          ]
        : userText,
    },
  ];
  return modelRouter.chat({
    model: input.referenceImageUrl
      ? MODELS.vision.precise
      : MODELS.text.flagship,
    messages,
    temperature: 0.3,
  });
}
