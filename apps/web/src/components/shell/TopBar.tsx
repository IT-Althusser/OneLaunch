import { motion } from 'framer-motion';
import type { WorkbenchTab } from '../../types';

const VIEW_LABEL: Record<string, string> = {
  market: '市场规范 · 平台与市场规则浏览',
  workbench: '工作台 · 工具与已生成图片',
  tool: '单图工具工作台',
};

/**
 * 顶栏：进度条（创作=向导步进；生成=SSE 推导）+ 后台任务返回胶囊 + 创作/生成切换
 * （分段控件中的斜线分隔对应草图造型）。
 */
export function TopBar({
  view,
  createStep,
  studioProgress,
  studioRunning,
  hasStudioTask,
  hasBackgroundStudio,
  backgroundToolType,
  onGoStudio,
  onGoTool,
  onModeChange,
}: {
  view: WorkbenchTab;
  createStep: number;
  /** 生成进度：完成张数 / 总张数（无任务为 null） */
  studioProgress: { done: number; total: number } | null;
  studioRunning: boolean;
  hasStudioTask: boolean;
  hasBackgroundStudio: boolean;
  backgroundToolType: string | null;
  onGoStudio: () => void;
  onGoTool: () => void;
  onModeChange: (mode: 'create' | 'studio') => void;
}) {
  const mode: 'create' | 'studio' = view === 'studio' ? 'studio' : 'create';

  let percent = 0;
  let label: string;
  if (view === 'studio' && studioProgress) {
    percent = studioProgress.total > 0 ? Math.round((studioProgress.done / studioProgress.total) * 100) : 0;
    label = `${studioProgress.done} / ${studioProgress.total} 张 · ${studioRunning ? '生成与检测中' : '已完成'}`;
  } else if (view === 'create') {
    percent = Math.round((createStep / 3) * 100);
    label = `创作向导 · 第 ${createStep} 步，共 3 步`;
  } else {
    percent = 0;
    label = VIEW_LABEL[view] ?? 'OneLaunch';
  }

  return (
    <header className="flex h-14 shrink-0 flex-wrap items-center gap-3 border-b border-line bg-white/85 px-4 backdrop-blur lg:px-7">
      {/* 进度条 */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="h-1.5 w-full max-w-[360px] overflow-hidden rounded-full bg-mist" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
          <motion.div
            className="h-full rounded-full bg-ink"
            initial={false}
            animate={{ width: `${percent}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
        <span className="hidden shrink-0 text-[11px] font-medium text-ink-mute sm:block" aria-live="polite">{label}</span>
      </div>

      {/* 后台任务返回胶囊 */}
      {hasBackgroundStudio && view !== 'studio' && (
        <button type="button" onClick={onGoStudio} className="inline-flex shrink-0 items-center gap-2 rounded-full bg-run/10 px-3 py-1.5 text-xs font-semibold text-run transition hover:bg-run/15">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-run" />
          生成任务后台运行中 · 返回查看
        </button>
      )}
      {backgroundToolType && (
        <button type="button" onClick={onGoTool} className="inline-flex shrink-0 items-center gap-2 rounded-full bg-run/10 px-3 py-1.5 text-xs font-semibold text-run transition hover:bg-run/15">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-run" />
          {backgroundToolType === '详情页' ? 'AI 详情页' : backgroundToolType}任务后台运行中 · 返回查看
        </button>
      )}

      {/* 创作 / 生成 */}
      <div className="flex shrink-0 items-center rounded-full border border-line bg-white p-1 shadow-card">
        {(['create', 'studio'] as const).map((m, i) => (
          <span key={m} className="flex items-center">
            {i === 1 && <span aria-hidden className="mx-0.5 h-4 w-px rotate-12 bg-line-strong" />}
            <button
              type="button"
              onClick={() => onModeChange(m)}
              disabled={m === 'studio' && !hasStudioTask}
              aria-pressed={mode === m}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${mode === m ? 'bg-ink text-white' : 'text-ink-mid hover:text-ink'}`}
            >
              {m === 'create' ? '创作' : '生成'}
            </button>
          </span>
        ))}
      </div>
    </header>
  );
}
