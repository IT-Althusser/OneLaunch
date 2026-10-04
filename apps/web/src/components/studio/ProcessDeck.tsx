import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { BrainCircuit, ShieldCheck } from 'lucide-react';
import { logLineTone } from '../../lib/format';
import type { ImageSlotState, QaRecord, ThinkingLogLine } from '../../types';
import { QaSummary } from './QaSummary';

type Front = 'thinking' | 'checking';

/**
 * 检查过程 + 思考过程 双卡堆叠（对应草图右侧的两卡堆叠效果）：
 * 前层为当前阅读的卡片，后层错位偏移露出标题，点击即交换前后层。
 */
export function ProcessDeck({
  logs,
  profile,
  qa,
  stats,
  running,
  slots,
  onFix,
}: {
  logs: ThinkingLogLine[];
  profile: string;
  qa: QaRecord[];
  stats: string;
  running: boolean;
  slots: Record<string, ImageSlotState>;
  onFix: (slotKey: string, type: string, platform: string, prompt: string) => void;
}) {
  const [front, setFront] = useState<Front>('thinking');
  const consoleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (consoleRef.current) consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
  }, [logs, front]);

  const back: Front = front === 'thinking' ? 'checking' : 'thinking';
  const BACK_LABEL = { thinking: '思考过程', checking: '检查过程' } as const;

  return (
    <div className="space-y-4">
      <div className="relative pt-7">
        {/* 后层卡片（露头可点击交换） */}
        <motion.button
          type="button"
          layout
          onClick={() => setFront(back)}
          aria-label={`切换到${BACK_LABEL[back]}`}
          className="absolute inset-x-4 top-0 z-0 flex h-12 items-center gap-2 rounded-2xl border border-line bg-mist px-4 text-xs font-semibold text-ink-mute shadow-card"
          whileHover={{ y: -2 }}
        >
          {back === 'thinking' ? <BrainCircuit className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
          {BACK_LABEL[back]}
          {back === 'checking' && qa.length > 0 && <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-[10px] text-ink-mute">{qa.length} 条</span>}
        </motion.button>

        {/* 前层卡片 */}
        <motion.div
          layout
          transition={{ type: 'spring', stiffness: 380, damping: 34 }}
          className="relative z-10 rounded-2xl border border-line bg-white shadow-pop"
        >
          <header className="flex items-center justify-between border-b border-line px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-bold text-ink">
              {front === 'thinking' ? <BrainCircuit className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
              {BACK_LABEL[front]}
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setFront(back)} className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-ink-faint transition hover:text-ink">
                查看{BACK_LABEL[back]} →
              </button>
              <span className={`h-1.5 w-1.5 rounded-full ${running ? 'animate-pulse bg-run' : 'bg-line-strong'}`} />
            </div>
          </header>

          {front === 'thinking' ? (
            <div ref={consoleRef} className="max-h-[430px] min-h-[240px] space-y-1.5 overflow-y-auto px-4 py-3 font-mono text-[11px] leading-relaxed">
              {logs.map((line, i) => (
                <p key={`${line.time}-${i}`} className="log-line flex gap-2">
                  <span className="shrink-0 text-ink-faint">{line.time}</span>
                  <span className={`min-w-0 break-words ${logLineTone(line.text)}`}>{line.text}</span>
                </p>
              ))}
              {running && <p className="text-ink-faint">▍</p>}
            </div>
          ) : (
            <div className="max-h-[430px] min-h-[240px] overflow-y-auto px-4 py-3">
              {qa.length > 0
                ? <QaSummary qa={qa} stats={stats} slots={slots} onFix={onFix} compact />
                : <p className="py-10 text-center text-xs text-ink-faint">质检开始后，这里会逐图展示检查结论。</p>}
            </div>
          )}
        </motion.div>
      </div>

      {profile && (
        <details className="card px-4 py-3" open>
          <summary className="cursor-pointer list-none text-xs font-bold text-ink">商品画像</summary>
          <p className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap text-[11px] leading-relaxed text-ink-mid">{profile}</p>
        </details>
      )}
    </div>
  );
}
