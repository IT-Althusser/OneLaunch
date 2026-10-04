import { motion } from 'framer-motion';
import { Columns2, Image, LayoutGrid, Mountain, Plane, Ruler, ScrollText, Sparkles, User } from 'lucide-react';
import type { ComponentType } from 'react';
import type { WorkbenchTab } from '../../types';
import { IMAGE_TYPES } from '../../types';
import { TYPE_DOT } from '../../lib/format';

/** 五类单图工具的侧栏图标 */
const TOOL_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  白底图: Image,
  场景图: Mountain,
  模特图: User,
  对比图: Columns2,
  尺寸图: Ruler,
};

/**
 * 浅色侧边栏：五图一键生成（主入口，与落地页 CTA 共享布局变形）/ 五类单图工具 /
 * 市场规范 / 工作台；运行中的任务在对应条目显示呼吸点。
 */
export function Sidebar({
  view,
  activeTool,
  apiOk,
  runningTools,
  studioRunning,
  onNavigate,
  onOpenTool,
}: {
  view: WorkbenchTab;
  activeTool: string;
  apiOk: boolean | null;
  runningTools: string[];
  studioRunning: boolean;
  onNavigate: (view: 'create' | 'studio' | 'market' | 'workbench') => void;
  onOpenTool: (tool: string) => void;
}) {
  const primaryActive = view === 'create' || view === 'studio';
  const isBusy = (tool: string) => runningTools.includes(tool) || (studioRunning && tool === '五图');

  return (
    <aside className="hidden w-[232px] shrink-0 flex-col border-r border-line bg-white lg:flex">
      <div className="flex items-center gap-2.5 px-5 pb-5 pt-6">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink text-white">
          <Plane className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="text-[15px] font-bold tracking-[-0.02em] text-ink">OneLaunch</div>
          <div className="truncate text-[11px] text-ink-mute">新品出海图片工作台</div>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        {/* 主入口：与落地页 CTA 的共享布局变形落点 */}
        <button
          type="button"
          onClick={() => onNavigate('create')}
          className={`relative flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors ${primaryActive ? 'text-white' : 'text-ink-mid hover:bg-mist hover:text-ink'}`}
        >
          {primaryActive && (
            <motion.span
              layoutId="nav-primary"
              className="absolute inset-0 rounded-xl bg-ink"
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            />
          )}
          <Sparkles className="relative z-10 h-4 w-4 shrink-0" />
          <span className="relative z-10 flex-1 text-left font-semibold">五图一键生成</span>
          {studioRunning && <span className="relative z-10 mr-0.5 h-1.5 w-1.5 animate-pulse rounded-full bg-run" />}
        </button>

        <div className="eyebrow px-3 pb-1 pt-5">单图工具</div>
        {IMAGE_TYPES.map((type) => {
          const Icon = TOOL_ICONS[type];
          const active = view === 'tool' && activeTool === type;
          return (
            <button
              key={type}
              type="button"
              onClick={() => onOpenTool(type)}
              className={`group flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] transition-colors ${active ? 'bg-mist font-semibold text-ink' : 'text-ink-mid hover:bg-mist hover:text-ink'}`}
            >
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${TYPE_DOT[type]}`} />
              <Icon className="h-3.5 w-3.5 shrink-0 text-ink-faint group-hover:text-ink-mid" />
              <span className="flex-1 text-left">{type}</span>
              {isBusy(type) && <span className="mr-0.5 h-1.5 w-1.5 animate-pulse rounded-full bg-run" />}
            </button>
          );
        })}

        <div className="eyebrow px-3 pb-1 pt-5">参考</div>
        <button
          type="button"
          onClick={() => onNavigate('market')}
          className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] transition-colors ${view === 'market' ? 'bg-mist font-semibold text-ink' : 'text-ink-mid hover:bg-mist hover:text-ink'}`}
        >
          <ScrollText className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
          <span className="flex-1 text-left">市场规范</span>
        </button>
        <button
          type="button"
          onClick={() => onNavigate('workbench')}
          className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] transition-colors ${view === 'workbench' ? 'bg-mist font-semibold text-ink' : 'text-ink-mid hover:bg-mist hover:text-ink'}`}
        >
          <LayoutGrid className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
          <span className="flex-1 text-left">工作台</span>
          {runningTools.length > 0 && <span className="mr-0.5 h-1.5 w-1.5 animate-pulse rounded-full bg-run" />}
        </button>
      </nav>

      <div className="flex items-center gap-2 border-t border-line px-5 py-4 text-[11px] text-ink-mute">
        <span className={`h-1.5 w-1.5 rounded-full ${apiOk === false ? 'bg-bad' : apiOk ? 'bg-ok' : 'bg-ink-faint'}`} />
        {apiOk === false ? '服务未连接' : '服务已连接'}
      </div>
    </aside>
  );
}
