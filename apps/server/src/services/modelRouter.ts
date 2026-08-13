/**
 * Model Router API unified client (OpenAI-compatible protocol, uses Node 20 built-in fetch).
 * Key points of the interfaces used in this solution:
 * - chat: /v1/chat/completions synchronous/streaming (product image understanding, prompt design, quality inspection)
 * - image: /v1/images/generations new-version models (wan2.7/2.6) synchronous; old-version (wan2.5/2.2) requires X-DashScope-Async: enable + input.prompt
 * - task query: GET /v1/tasks/{task_id} (asynchronous tasks such as image editing/localization)
 * For details see ModelRouter_API.docx.
 */
import type { Response } from 'express';
import { config, requireApiKey } from '../config.js';

/** OpenAI-compatible message content: pure text or multimodal (text + image_url) */
export type MessageContent =
  | string
  | Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string } }
    >;

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: MessageContent;
}

export interface ChatParams {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface TaskResult {
  task_id: string;
  status?: string;
  [key: string]: unknown;
}

function headers(extra?: Record<string, string>): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${requireApiKey()}`,
    ...extra,
  };
}

function url(path: string): string {
  return `${config.modelRouter.baseUrl}${path}`;
}

async function fail(res: globalThis.Response): Promise<never> {
  const text = await res.text().catch(() => '');
  throw new Error(`Model Router ${res.status}: ${text.slice(0, 500)}`);
}

function chatBody(params: ChatParams, stream: boolean) {
  return {
    model: params.model,
    messages: params.messages,
    ...(params.temperature !== undefined
      ? { temperature: params.temperature }
      : {}),
    ...(params.maxTokens !== undefined ? { max_tokens: params.maxTokens } : {}),
    stream,
  };
}

export const modelRouter = {
  /** POST /v1/chat/completions — non-streaming, returns the full text */
  async chat(params: ChatParams): Promise<string> {
    const res = await fetch(url('/chat/completions'), {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(chatBody(params, false)),
    });
    if (!res.ok) await fail(res);
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return data.choices?.[0]?.message?.content ?? '';
  },

  /**
   * POST /v1/chat/completions — streaming, passes the upstream SSE transparently to the frontend response.
   * Used for product display scenarios (official Tips).
   */
  async chatStream(params: ChatParams, res: Response): Promise<void> {
    const upstream = await fetch(url('/chat/completions'), {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(chatBody(params, true)),
    });
    if (!upstream.ok || !upstream.body) await fail(upstream);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(decoder.decode(value, { stream: true }));
      }
    } finally {
      res.end();
    }
  },

  /** POST /v1/images/generations — synchronous (wan2.7/2.6 series new-version models), returns image URL list */
  async generateImage(params: {
    model: string;
    prompt: string;
    n?: number;
    size?: string;
  }): Promise<string[]> {
    const res = await fetch(url('/images/generations'), {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        model: params.model,
        prompt: params.prompt,
        n: params.n ?? 1,
        size: params.size ?? '1024*1024',
      }),
    });
    if (!res.ok) await fail(res);
    const data = (await res.json()) as { data?: { url?: string }[] };
    return (data.data ?? []).map((item) => item.url ?? '').filter(Boolean);
  },

  /**
   * POST /v1/images/generations — asynchronous (wan2.5/2.2 series old-version models / image editing).
   * Requires X-DashScope-Async: enable + input.prompt format, returns task_id.
   */
  async createImageTask(params: {
    model: string;
    prompt: string;
    images?: string[];
    size?: string;
  }): Promise<string> {
    const res = await fetch(url('/images/generations'), {
      method: 'POST',
      headers: headers({ 'X-DashScope-Async': 'enable' }),
      body: JSON.stringify({
        model: params.model,
        input: {
          prompt: params.prompt,
          ...(params.images?.length ? { images: params.images } : {}),
        },
        parameters: { size: params.size ?? '1024*1024', n: 1 },
      }),
    });
    if (!res.ok) await fail(res);
    const data = (await res.json()) as { task_id?: string };
    if (!data.task_id) throw new Error('Async image task did not return task_id');
    return data.task_id;
  },

  /** GET /v1/tasks/{task_id} — query async task status and result */
  async getTask(taskId: string): Promise<TaskResult> {
    const res = await fetch(url(`/tasks/${taskId}`), {
      headers: headers(),
    });
    if (!res.ok) await fail(res);
    return (await res.json()) as TaskResult;
  },
};
