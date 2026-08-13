/** Types shared between frontend and backend (corresponds to apps/server/src/agents/orchestrator.ts) */

/** Five types of images (fixed capability scope of this solution) */
export const IMAGE_TYPES = [
  '白底图',
  '场景图',
  '模特图',
  '对比图',
  '尺寸图',
] as const;
export type ImageType = (typeof IMAGE_TYPES)[number];

export const PLATFORMS = ['Amazon', 'TikTok Shop', 'Temu', 'Shopee'] as const;

export interface ImagePipelineInput {
  productName: string;
  sellingPoints: string;
  platforms: string[];
  referenceImageUrl?: string;
}

export interface GeneratedImage {
  type: ImageType;
  platform: string;
  size: string;
  url: string;
}

export interface QaRecord {
  type: ImageType;
  url: string;
  passed: boolean;
  comment: string;
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
  qa: QaRecord[];
}
