/** Types shared between frontend and backend (corresponds to apps/server/src/main/java/com/onelaunch/ApiModels.java) */

/** 工作台页签：创作 / 生成 / 单图工具工作台（侧边栏目录面板的跳转目标） */
export type WorkbenchTab = 'create' | 'studio' | 'tool';

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

/** 平台生成的图片类型：每个平台都生成完整五图，提示词按平台规范差异化（与后端 ImagePipelineService 一致） */
export function imageTypesForPlatform(platforms: string[]): Record<string, readonly ImageType[]> {
  const map: Record<string, readonly ImageType[]> = {};
  platforms.forEach((p) => { map[p] = IMAGE_TYPES; });
  return map;
}

export interface ImagePipelineInput {
  productName: string;
  sellingPoints: string;
  platforms: string[];
  /** Optional presentation direction for the generated detail page. */
  detailTone?: '专业可信' | '种草转化' | '简洁高端';
  /** 商品参考图：公网 URL 或 data:image/...;base64（本地上传直传）。有参考图时走图生图。 */
  referenceImages?: string[];
  /** 模型覆盖（右侧「模型与调用」面板选择） */
  imageModel?: string;
  editModel?: string;
  textModel?: string;
  /** 白底图视觉质检模型（须具备视觉理解能力，默认 qwen3.6-plus） */
  visionModel?: string;
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
  /** 视觉质检未通过项（降级人工复检时为空） */
  issues?: string[];
  /** 执行质检的视觉模型（降级人工复检时为空） */
  model?: string;
  /** 未通过时的修复提示词样例（符合平台规范，可直接用于重新生成） */
  suggestedPrompt?: string;
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

/** 单图请求：sourceUrl 存在 → 图生图修改；否则 referenceImages → 参考图生成；否则文生图 */
export interface SingleImageRequest {
  type: ImageType;
  prompt: string;
  platform: string;
  referenceImages?: string[];
  sourceUrl?: string;
  model?: string;
}

/** 图片本地化请求（对应后端 POST /api/images/localize） */
export interface LocalizeRequest {
  sourceUrl: string;
  targetMarket?: string;
  instruction?: string;
  model?: string;
}

/** 独立 AI 详情页请求（对应后端 POST /api/detail-page）：名称与卖点至少其一 */
export interface DetailPageRequest {
  productName: string;
  sellingPoints: string;
  platforms: string[];
  detailTone?: '专业可信' | '种草转化' | '简洁高端';
  /** 已有生成图的类型集合（供 AI 引用配图；无图可省略，输出纯文案模块） */
  generatedTypes?: string[];
  textModel?: string;
}

/** 侧栏工具入口类型：五类单图 + 本地化 + AI 详情页（'五图套图生成' 走主流程不在此列） */
export type SideToolType = ImageType | '本地化' | '详情页';

/** 已完成槽位的摘要（生成工作台上报给单图工具工作台） */
export interface SlotBrief {
  key: string;
  type: ImageType;
  platform: string;
  url: string;
  size: string;
  prompt: string;
}

/** 参考图条目（工作台状态） */
export interface ReferenceImage {
  id: string;
  /** 图片 URL 或 data:image/...;base64 数据 */
  src: string;
  name: string;
  kind: 'upload' | 'url';
}

/** GET /api/models 返回的模型目录（按能力分组） */
export interface ModelOption {
  id: string;
  verified: boolean;
}

export interface ModelCatalog {
  textToImage: ModelOption[];
  imageToImage: ModelOption[];
  text: ModelOption[];
  other: ModelOption[];
  /** 具备视觉理解能力的模型（白底图质检/内容理解与合规检测） */
  vision: ModelOption[];
  visionAvailable: boolean;
}

/** 右栏模型选择状态 */
export interface ModelSelection {
  imageModel: string;
  editModel: string;
  textModel: string;
  visionModel: string;
}

/** 单个图片槽位的实时状态（生成工作台） */
export interface ImageSlotState {
  status: 'pending' | 'running' | 'done' | 'failed';
  prompt?: string;
  url?: string;
  size?: string;
  error?: string;
}

export interface ThinkingLogLine {
  text: string;
  time: string;
}
