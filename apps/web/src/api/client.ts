import type { ImagePipelineInput, ImagePipelineResult } from '../types';

/** POST /api/images/set — Run the full image generation pipeline */
export async function runImagePipeline(
  input: ImagePipelineInput,
): Promise<ImagePipelineResult> {
  const res = await fetch('/api/images/set', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(`后端 ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as ImagePipelineResult;
}
