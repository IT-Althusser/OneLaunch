import type { ImagePipelineInput, ImagePipelineResult } from '../types';

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

/** POST /api/images/set — Run the full image generation pipeline */
export async function runImagePipeline(
  input: ImagePipelineInput,
): Promise<ImagePipelineResult> {
  return apiJson<ImagePipelineResult>('/api/images/set', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function regenerateImage(input: { type: string; prompt: string; platform?: string }) {
  return apiJson<{ image: ImagePipelineResult['images'][number] | null }>('/api/images/single', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
}

/** POST /api/images/localize — Synchronous image-to-image localization edit */
export async function localizeImage(input: { sourceUrl: string; targetMarket?: string; instruction?: string }) {
  return apiJson<{ image: ImagePipelineResult['images'][number] | null }>('/api/images/localize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
}
