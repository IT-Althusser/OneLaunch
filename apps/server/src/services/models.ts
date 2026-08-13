/**
 * Centralized management of model IDs — all from the competition's 126-model list (see ModelRouter_API.docx).
 * This solution's direction: AI product image generation.
 * Hard rule: it is forbidden to add model IDs outside of this file.
 */
export const MODELS = {
  /** Text dialogue: scene design / generation prompt writing */
  text: {
    /** Flagship model, used for final effect */
    flagship: 'qwen/qwen3.7-max',
    /** Official Tips: first validate the prototype with a small model, then switch to a high-performance model */
    prototype: 'qwen/qwen3.5-flash',
  },
  /** Visual understanding: product image parsing / generated image quality inspection */
  vision: {
    /** Precision check (product image understanding, quality inspection) */
    precise: 'qwen/qwen3-vl-plus',
    /** Low-cost coarse screening (batch image quality inspection) */
    screening: 'qwen/qwen3-vl-flash',
  },
  /** Image generation/editing */
  image: {
    /** Main force for white-background images / scene images / model images / comparison images / dimension diagrams (synchronous call) */
    pro: 'qwen/wan2.7-image-pro',
    std: 'qwen/wan2.7-image',
    /** Image editing / localization replacement (old-version model, asynchronous task) */
    edit: 'qwen/wan2.5-i2i-preview',
  },
} as const;
