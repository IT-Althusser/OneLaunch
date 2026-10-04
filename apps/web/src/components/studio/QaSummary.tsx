import { useState } from 'react';
import { ComplianceIssues } from '../common/ComplianceIssues';
import type { ImageSlotState, QaRecord } from '../../types';

/** 质检摘要：逐图通过/未通过 + 通过依据 + 合规问题 + 修复指令（可复制 / 一键带入工作台修复） */
export function QaSummary({
  qa,
  stats,
  slots,
  onFix,
  compact = false,
}: {
  qa: QaRecord[];
  stats: string;
  slots: Record<string, ImageSlotState>;
  onFix: (slotKey: string, type: string, platform: string, prompt: string) => void;
  compact?: boolean;
}) {
  const visionQc = qa.some((q) => q.model);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [copyError, setCopyError] = useState('');

  const statusOf = (q: QaRecord) => {
    if (q.status === 'manual_review' || (!q.status && !q.model)) return { label: '待人工复检', cls: 'bg-warn/10 text-warn', dot: 'bg-warn' };
    if (q.status === 'passed' || (q.status == null && q.passed)) return { label: '通过', cls: 'bg-ok/10 text-ok', dot: 'bg-ok' };
    return { label: '未通过', cls: 'bg-bad/10 text-bad', dot: 'bg-bad' };
  };

  return (
    <section className={compact ? '' : 'card px-5 py-4'}>
      {!compact && (
        <>
          <h2 className="mb-1 text-sm font-bold text-ink">合规与质检{visionQc ? ' · 视觉审核' : ' · 人工复检提醒'}</h2>
          <p className="mb-3 text-xs text-ink-mid">{stats}</p>
        </>
      )}
      {copyError && <p role="alert" className="mb-2 text-xs text-bad">{copyError}</p>}
      <div className="space-y-2">
        {qa.map((q, i) => {
          const slotEntry = Object.entries(slots).find(([, s]) => s.url === q.url);
          const st = statusOf(q);
          return (
            <div key={`${q.platform ?? ''}||${q.type}||${q.url}`} className="rounded-xl border border-line px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-semibold ${st.cls}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                  {st.label}
                </span>
                <span className="text-xs font-semibold text-ink">{q.platform} · {q.type} · {q.market}</span>
                {q.model && <span className="shrink-0 rounded-full bg-mist px-2 py-0.5 text-[9px] font-bold text-ink-mute">{q.model}</span>}
              </div>
              <p className="mt-2 break-words text-xs leading-relaxed text-ink-mid">{q.comment}</p>
              {q.passed && q.passReasons && q.passReasons.length > 0 && (
                <div className="mt-2 rounded-lg bg-ok/5 px-3 py-2">
                  <p className="text-[10px] font-bold text-ok">通过依据</p>
                  <ul className="mt-1 space-y-0.5 text-[10px] leading-relaxed text-ink-mid">
                    {q.passReasons.map((reason, j) => <li key={j}>· {reason}</li>)}
                  </ul>
                </div>
              )}
              {q.issues && q.issues.length > 0 && !q.complianceIssues?.length && (
                <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-[10px] leading-relaxed text-bad">
                  {q.issues.map((issue, j) => <li key={j}>{issue}</li>)}
                </ul>
              )}
              <ComplianceIssues issues={q.complianceIssues ?? []} />
              {!q.passed && q.suggestedPrompt && (
                <div className="mt-2 rounded-lg bg-mist p-2.5">
                  <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-ink-mute">修复指令 · 可直接复制使用，或一键带入工作台修复</span>
                    <span className="flex shrink-0 gap-1.5">
                      <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(q.suggestedPrompt!); setCopiedIdx(i); setCopyError(''); } catch { setCopyError('复制失败，请手动选中提示词复制'); } }}
                        className="rounded-md border border-line-strong bg-white px-2 py-0.5 text-[10px] font-semibold text-ink-mid transition hover:border-ink hover:text-ink">
                        {copiedIdx === i ? '已复制 ✓' : '复制'}
                      </button>
                      {slotEntry && (
                        <button type="button" onClick={() => { const [platform, type] = slotEntry[0].split('||'); onFix(slotEntry[0], type, platform, q.suggestedPrompt!); }}
                          className="rounded-md bg-ink px-2 py-0.5 text-[10px] font-semibold text-white transition hover:bg-ink-soft">
                          用此提示词修复
                        </button>
                      )}
                    </span>
                  </div>
                  <p className="break-all font-mono text-[10px] leading-relaxed text-ink-mid">{q.suggestedPrompt}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
