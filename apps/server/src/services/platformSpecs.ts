/**
 * Multi-platform size and style matrix — core configuration for the "AI product image generation" direction.
 * The size parameter format follows the Model Router image interface (see ModelRouter_API.docx, currently documented example is 1024*1024);
 * after the API Key is issued, higher-resolution sizes can be expanded according to the model's capabilities.
 */

/** Five types of images (fixed capability scope of this solution) */
export const IMAGE_TYPES = ['白底图', '场景图', '模特图', '对比图', '尺寸图'] as const;
export type ImageType = (typeof IMAGE_TYPES)[number];

export interface PlatformImageSpec {
  /** Main image size (width*height) */
  mainSize: string;
  /** Additional sizes that need to be output (multi-platform adaptation) */
  extraSizes: string[];
  /** Platform style requirements (injected into the generation prompt) */
  styleHint: string;
}

export const PLATFORM_IMAGE_SPECS: Record<string, PlatformImageSpec> = {
  Amazon: {
    mainSize: '1024*1024',
    extraSizes: [],
    styleHint:
      'Pure white background main image (RGB 255,255,255), product occupies 85% or more of the frame, no watermark, no collage, no text',
  },
  'TikTok Shop': {
    mainSize: '1024*1024',
    extraSizes: ['960*1280'],
    styleHint: 'Bright colors, strong sense of scene, close to short-video content aesthetics, suitable for vertical display',
  },
  Temu: {
    mainSize: '1024*1024',
    extraSizes: ['960*1280'],
    styleHint: 'Highlight cost-performance and product details, clean composition, direct expression of selling points',
  },
  Shopee: {
    mainSize: '1024*1024',
    extraSizes: [],
    styleHint: 'Clear product subject, bright and eye-catching, optimized for mobile small-screen display',
  },
};

export const DEFAULT_PLATFORM = 'Amazon';
