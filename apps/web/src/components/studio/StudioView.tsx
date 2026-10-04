import { useState } from 'react';
import { usePipeline } from '../../hooks/usePipeline';
import { formatElapsed } from '../../lib/format';
import { SlotCard } from './SlotCard';
import { SlotEditor } from './SlotEditor';
import { ProcessDeck } from './ProcessDeck';
import { QaSummary } from './QaSummary';
import { DetailPages } from '../common/DetailPages';
import { ImageLightbox } from '../common/ImageLightbox';
import type { GeneratedImage, ImagePipelineInput, ModelSelection, SlotBrief } from '../../types';

export interface Editor {
  key: string;
  type: string;
  platform: string;
  mode: 'regen' | 'edit';
  prompt: string;
}

/** 终态分档：全败=失败、部分=部分完成、全成=已完成（避免全败仍显示绿色已完成） */
function finalStatus(doneCount: number, totalSlots: number): { label: string; cls: string; dot: string } {
  if (totalSlots > 0 && doneCount === 0) return { label: '生成失败', cls: 'bg-bad/10 text-bad', dot: 'bg-bad' };
  if (doneCount < totalSlots) return { label: `部分完成 ${doneCount}/${totalSlots}`, cls: 'bg-warn/10 text-warn', dot: 'bg-warn' };
  return { label: '已完成', cls: 'bg-ok/10 text-ok', dot: 'bg-ok' };
}

/**
 * 生成工作台：五图实时槽位 + 右侧「思考/检查」双卡堆叠（ProcessDeck）+ 单图重生成/修改。
 * SSE 状态机在 usePipeline（行为与旧版一致）；挂载即启动，外壳切换仅隐藏不卸载。
 */
export function StudioView({
  input,
  models,
  onOpenWorkbench,
  onSlotIndex,
  slotUpdate,
  onSlotUpdateConsumed,
  onNewTask,
  onRunningChange,
}: {
  input: ImagePipelineInput;
  models: ModelSelection;
  onOpenWorkbench?: (slotKey: string, type: string, platform: string, promptOverride?: string) => void;
  onSlotIndex?: (index: Record<string, SlotBrief>) => void;
  slotUpdate?: { key: string; image: GeneratedImage; prompt: string; seq: number } | null;
  onSlotUpdateConsumed?: () => void;
  onNewTask: () => void;
  onRunningChange?: (running: boolean) => void;
}) {
  const {
    platforms, typeMap, refs, slots, totalSlots, doneCount,
    logs, profile, result, fatal, running, elapsed, imageWorkComplete,
    busyKey, editorError, setEditorError, runSingle, currentQa, currentImages,
  } = usePipeline({ input, models, onSlotIndex, slotUpdate, onSlotUpdateConsumed, onRunningChange });

  const [editor, setEditor] = useState<Editor | null>(null);
  const [preview, setPreview] = useState<{ url: string; type: string; platform: string; size: string } | null>(null);

  const qaStats = `${doneCount} 图 · 已质检 ${currentQa.filter((q) => q.status !== 'manual_review' && q.model).length} · 未通过 ${currentQa.filter((q) => q.status === 'failed' || (q.status == null && q.model && !q.passed)).length} · 待复检 ${currentQa.filter((q) => q.status === 'manual_review' || (!q.status && !q.model)).length}`;

  const finalState = !running && !fatal ? finalStatus(doneCount, totalSlots) : null;
  const statusLabel = running ? (imageWorkComplete ? '详情页编排中' : '生成与检测中') : fatal ? '任务失败' : finalState!.label;
  const statusCls = running ? 'bg-run/10 text-run' : fatal ? 'bg-bad/10 text-bad' : finalState!.cls;
  const statusDot = running ? 'animate-pulse bg-run' : fatal ? 'bg-bad' : finalState!.dot;

  return (
    <div className="mx-auto max-w-[1200px]">
      {/* 状态条 */}
      <div className="card mb-5 flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-4">
        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${statusCls}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${statusDot}`} />
          {statusLabel}
        </span>
        <span className="text-xs font-semibold text-ink">{doneCount} / {totalSlots} 张完成</span>
        <span className="text-xs text-ink-mute">耗时 {formatElapsed(elapsed)}</span>
        <span className="text-xs text-ink-mid" aria-live="polite">{qaStats}</span>
        <span className="hidden text-xs text-ink-mute md:inline">
          {input.productName ? `《${input.productName}》` : '按参考图生成'} · {refs.length > 0 ? `参考图 ${refs.length} 张 · 图生图` : '无参考图 · 文生图'}
        </span>
        <button type="button" onClick={onNewTask} disabled={running} className="btn-ghost ml-auto px-4 py-2 text-xs">新建任务</button>
      </div>

      {fatal && <div className="mb-5 rounded-xl border border-bad/30 bg-bad/5 px-4 py-3 text-sm text-bad">{fatal}</div>}

      <div className="grid gap-5 xl:grid-cols-[1fr_330px]">
        {/* 左：图片槽位 */}
        <div className="min-w-0 space-y-5">
          {platforms.map((platform) => (
            <section key={platform} className="card px-5 py-5">
              <header className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold text-ink">{platform}</h2>
                <span className="text-[11px] text-ink-faint">完整五图 · 按平台规范差异化</span>
              </header>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {typeMap[platform].map((type) => {
                  const key = `${platform}||${type}`;
                  return (
                    <SlotCard
                      key={key}
                      type={type}
                      state={slots[key]}
                      busy={busyKey === key}
                      editorOpen={editor?.key === key}
                      onOpenWorkbench={() => onOpenWorkbench?.(key, type, platform)}
                      onRegen={() => { setEditorError(''); setEditor({ key, type, platform, mode: 'regen', prompt: slots[key]?.prompt ?? '' }); }}
                      onEdit={() => { setEditorError(''); setEditor({ key, type, platform, mode: 'edit', prompt: '' }); }}
                      onPreview={() => { const s = slots[key]; if (s?.url) setPreview({ url: s.url, type, platform, size: s.size ?? '' }); }}
                    />
                  );
                })}
              </div>
              {editor && editor.platform === platform && (
                <SlotEditor
                  editor={editor}
                  busy={busyKey === editor.key}
                  error={editorError}
                  onChange={(prompt) => setEditor((prev) => (prev ? { ...prev, prompt } : prev))}
                  onCancel={() => { setEditor(null); setEditorError(''); }}
                  onConfirm={() => { if (editor.prompt.trim()) runSingle({ platform: editor.platform, type: editor.type, mode: editor.mode }, editor.prompt.trim(), editor.mode === 'edit' ? slots[editor.key]?.url : undefined); }}
                />
              )}
            </section>
          ))}

          {currentQa.length > 0 && <QaSummary qa={currentQa} stats={qaStats} slots={slots} onFix={(slotKey, type, platform, prompt) => onOpenWorkbench?.(slotKey, type, platform, prompt)} />}
          {result && result.detailPages && result.detailPages.length > 0 && <DetailPages pages={result.detailPages} images={currentImages} />}
        </div>

        {/* 右：思考/检查双卡堆叠 + 画像 */}
        <div className="min-w-0 xl:sticky xl:top-2 xl:self-start">
          <ProcessDeck logs={logs} profile={profile} qa={currentQa} stats={qaStats} running={running} slots={slots} onFix={(slotKey, type, platform, prompt) => onOpenWorkbench?.(slotKey, type, platform, prompt)} />
        </div>
      </div>

      {preview && <ImageLightbox image={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}
