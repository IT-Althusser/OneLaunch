import type { QaRecord, ThinkingLogLine } from '../types';

/** 同一平台/图类只保留最终审查状态，避免首轮与修复结果在摘要中重复出现。 */
export function mergeQa(records: QaRecord[]): QaRecord[] {
  const bySlot = new Map<string, QaRecord>();
  for (const record of records) {
    const key = record.platform ? `${record.platform}||${record.type}` : record.url;
    bySlot.set(key, record);
  }
  return Array.from(bySlot.values());
}

export function nowTime(): string {
  return new Date().toLocaleTimeString('zh-CN', { hour12: false });
}

export function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** 画像文本清洗：剥离 markdown 加粗与模型自带的重复标题，列表符转圆点 */
export function formatProfile(raw: string): string {
  return raw
    .replace(/\*\*/g, '')
    .trim()
    .replace(/^[【\[]?商品画像[】\]]?[:：]?\s*\n*/, '')
    .replace(/^\s*[*-]\s+/gm, '· ');
}

export function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

/** 五类图点缀色（tailwind type-* 同源）：小圆点 / 标签用 */
export const TYPE_DOT: Record<string, string> = {
  白底图: 'bg-type-white',
  场景图: 'bg-type-scene',
  模特图: 'bg-type-model',
  对比图: 'bg-type-compare',
  尺寸图: 'bg-type-size',
};

export function logLineTone(text: string): string {
  if (text.includes('✓')) return 'text-ok';
  if (text.includes('✗')) return 'text-bad';
  return 'text-ink-mid';
}

export type { ThinkingLogLine };
