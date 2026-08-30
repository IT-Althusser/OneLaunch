import type {
  DetailPage,
  DetailPageRequest,
  GeneratedImage,
  ImagePipelineInput,
  LocalizeRequest,
  ModelCatalog,
  SingleImageRequest,
} from '../types';

async function apiJson<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const text = await res.text();
  let payload: unknown = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
  if (!res.ok) {
    const message = typeof payload === 'object' && payload && 'error' in payload ? String((payload as { error: unknown }).error) : String(payload || res.statusText);
    throw new Error(`后端 ${res.status}: ${message}`);
  }
  return payload as T;
}

/** GET /api/models — 网关可用模型清单（按能力分组） */
export async function fetchModelCatalog(): Promise<ModelCatalog> {
  return apiJson<ModelCatalog>('/api/models', { method: 'GET' });
}

/**
 * POST /api/images/set/stream — SSE 流式流水线。
 * 逐条分发事件：log（思考过程文字）/ profile / image_start / image_done / image_fail / done / fatal。
 */
export async function streamImagePipeline(
  input: ImagePipelineInput,
  onEvent: (event: string, data: Record<string, unknown>) => void,
): Promise<void> {
  const res = await fetch('/api/images/set/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok || !res.body) {
    let message = `后端 ${res.status}`;
    try {
      const payload: unknown = await res.json();
      if (payload && typeof payload === 'object' && 'error' in payload) message = String((payload as { error: unknown }).error);
    } catch { /* 保留状态码信息 */ }
    throw new Error(message);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf('\n\n')) >= 0) {
      const raw = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const parsed = parseSseEvent(raw);
      if (parsed) onEvent(parsed.event, parsed.data);
    }
  }
}

function parseSseEvent(raw: string): { event: string; data: Record<string, unknown> } | null {
  let event = 'message';
  const dataLines: string[] = [];
  for (const line of raw.split('\n')) {
    if (line.startsWith(':')) continue; // 心跳注释
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
  }
  if (dataLines.length === 0) return null;
  try {
    return { event, data: JSON.parse(dataLines.join('\n')) as Record<string, unknown> };
  } catch {
    return { event, data: { text: dataLines.join('\n') } };
  }
}

/** POST /api/images/single — 单图生成/参考图生成/基于已生成图修改 */
export async function regenerateSingle(req: SingleImageRequest): Promise<GeneratedImage> {
  const payload = await apiJson<{ image: GeneratedImage }>('/api/images/single', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  return payload.image;
}

/** 网关图片的同源代理地址（canvas 裁切与下载原图需要同源）。 */
export function imageProxyUrl(url: string, download = false): string {
  return `/api/image-proxy?url=${encodeURIComponent(url)}${download ? '&download=true' : ''}`;
}

/** POST /api/images/localize — 图片本地化（同步图生图，返回 type 为「本地化图」） */
export async function localizeImage(req: LocalizeRequest): Promise<GeneratedImage> {
  const payload = await apiJson<{ image: GeneratedImage }>('/api/images/localize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  return payload.image;
}

/** POST /api/detail-page — AI 详情页自动化（独立生成，不依赖五图流水线） */
export async function generateDetailPages(req: DetailPageRequest): Promise<DetailPage[]> {
  const payload = await apiJson<{ detailPages: DetailPage[] }>('/api/detail-page', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  return payload.detailPages;
}
