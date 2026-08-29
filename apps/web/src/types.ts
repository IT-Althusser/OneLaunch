/** Types shared between frontend and backend (corresponds to apps/server/src/main/java/com/onelaunch/ApiModels.java) */

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
  /** Optional presentation direction for the generated detail page. */
  detailTone?: '专业可信' | '种草转化' | '简洁高端';
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

export interface DetailPageSection {
  type: 'hero' | 'benefits' | 'scene' | 'comparison' | 'specs' | 'faq' | 'cta';
  title: string;
  body: string;
  imageType?: ImageType;
  bullets?: string[];
}

export interface DetailPage {
  platform: string;
  title: string;
  subtitle: string;
  sellingPoints: string[];
  sections: DetailPageSection[];
  compliance: string[];
}

export interface ImagePipelineResult {
  steps: StepRecord[];
  profile?: string;
  images: GeneratedImage[];
  qa: QaRecord[];
  detailPages?: DetailPage[];
}
