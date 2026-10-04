import { useCallback, useMemo, useState } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { CreateFlow } from '../create/CreateFlow';
import { StudioView } from '../studio/StudioView';
import { ToolWorkbench } from '../ToolWorkbench';
import { DetailWorkbench } from '../DetailWorkbench';
import { Workbench } from '../workbench/Workbench';
import { MarketRules } from '../market/MarketRules';
import type {
  GeneratedImage,
  ImagePipelineInput,
  ModelCatalog,
  ModelSelection,
  SideToolType,
  SlotBrief,
  WorkbenchTab,
} from '../../types';
import { IMAGE_TYPES } from '../../types';

/** 单图工具工作台实例：切换视图时保持挂载（仅隐藏），生成任务在后台继续运行；seq 为实例唯一标识 */
type ToolPageState = {
  type: SideToolType;
  slotKey: string | null;
  platform: string;
  source?: SlotBrief;
  promptOverride?: string;
  seq: number;
};

/**
 * 应用外壳：浅色侧边栏（8 入口）+ 顶栏（进度条 + 创作/生成切换）+ 视图容器。
 * 核心保护：StudioView 与全部工具工作台实例隐藏不卸载，SSE 与生成任务在后台持续运行。
 */
export function AppShell({
  catalog,
  selection,
  onSelectionChange,
  catalogError,
  apiOk,
}: {
  catalog: ModelCatalog | null;
  selection: ModelSelection;
  onSelectionChange: (next: ModelSelection) => void;
  catalogError: string;
  apiOk: boolean | null;
}) {
  const [view, setView] = useState<WorkbenchTab>('create');
  const [createStep, setCreateStep] = useState(1);
  const [studioInput, setStudioInput] = useState<ImagePipelineInput | null>(null);
  const [studioKey, setStudioKey] = useState(0);
  const [studioRunning, setStudioRunning] = useState(false);
  const [toolPages, setToolPages] = useState<ToolPageState[]>([]);
  const [toolPage, setToolPage] = useState<ToolPageState | null>(null);
  const [busyToolSeqs, setBusyToolSeqs] = useState<number[]>([]);
  const [engagedToolSeqs, setEngagedToolSeqs] = useState<number[]>([]);
  const [slotIndex, setSlotIndex] = useState<Record<string, SlotBrief>>({});
  const [slotUpdate, setSlotUpdate] = useState<{ key: string; image: GeneratedImage; prompt: string; seq: number } | null>(null);

  const handleStudioRunningChange = useCallback((running: boolean) => setStudioRunning(running), []);

  /** 工具实例运行状态上报：busy=运行中；engaged 记录发起过任务的实例（完成后切回仍能看到结果） */
  const handleToolBusyChange = useCallback((seq: number, busy: boolean) => {
    setBusyToolSeqs((prev) => (busy ? (prev.includes(seq) ? prev : [...prev, seq]) : prev.filter((s) => s !== seq)));
    if (busy) setEngagedToolSeqs((prev) => (prev.includes(seq) ? prev : [...prev, seq]));
  }, []);

  /** 新的五图任务：清理不在运行中的工具工作台实例；运行中的保留（后台继续，切回可查看） */
  const resetIdleToolPages = useCallback(() => {
    setToolPages((prev) => prev.filter((p) => busyToolSeqs.includes(p.seq)));
    setToolPage((prev) => (prev && busyToolSeqs.includes(prev.seq) ? prev : null));
  }, [busyToolSeqs]);

  function handleSubmit(input: ImagePipelineInput) {
    setStudioInput(input);
    setStudioRunning(true);
    setSlotIndex({});
    setStudioKey((k) => k + 1);
    resetIdleToolPages();
    setView('studio');
  }

  /**
   * 打开（或回到）单图工具工作台：
   * - 同类型同槽位实例正在运行 → 复用实例回到任务现场，后台任务不被打断
   * - 实例发起过任务且本次无新指令（promptOverride）→ 复用实例回看结果
   * - 其余情况新建实例并替换同键旧实例
   */
  const openToolPage = useCallback((next: ToolPageState) => {
    const existing = toolPages.find((p) => p.type === next.type && p.slotKey === next.slotKey);
    const reusable = existing && (busyToolSeqs.includes(existing.seq) || (!next.promptOverride && engagedToolSeqs.includes(existing.seq))) ? existing : null;
    const target = reusable ?? next;
    if (!reusable) setToolPages((prev) => [...prev.filter((p) => !(p.type === target.type && p.slotKey === target.slotKey)), target]);
    setToolPage(target);
    setView('tool');
  }, [toolPages, busyToolSeqs, engagedToolSeqs]);

  /** 侧栏工具：打开对应类型的单图工具工作台整页；该类型已有完成图则带入槽位，否则独立生成 */
  const handleOpenTool = useCallback((tool: string) => {
    const platform = studioInput?.platforms[0] ?? 'Amazon';
    // 本地化 / AI 详情页为独立工作台，不带入生成工作台槽位
    const key = tool === '本地化' || tool === '合规检测' || tool === '详情页' ? null : `${platform}||${tool}`;
    const slot = key ? slotIndex[key] : undefined;
    const source = tool === '本地化' || tool === '合规检测' ? Object.values(slotIndex)[0] : undefined;
    openToolPage({ type: tool as SideToolType, slotKey: slot?.key ?? null, source, platform: slot?.platform ?? source?.platform ?? platform, seq: Date.now() });
  }, [studioInput, slotIndex, openToolPage]);

  const handleOpenSlotWorkbench = useCallback((slotKey: string, type: string, platform: string, promptOverride?: string) => {
    openToolPage({ type: type as SideToolType, slotKey, platform, promptOverride, seq: Date.now() });
  }, [openToolPage]);

  const handleSlotIndex = useCallback((index: Record<string, SlotBrief>) => setSlotIndex(index), []);

  /** 已完成槽位图 → AI 详情页工作台的配图引用（槽位 key 唯一） */
  const detailImages = useMemo<GeneratedImage[]>(
    () => Object.values(slotIndex).map((b) => ({ type: b.type, platform: b.platform, size: b.size, url: b.url })),
    [slotIndex],
  );

  /** 后台运行中的工具任务（当前不在查看的实例）：顶栏显示返回入口 */
  const backgroundTool = toolPages.find((p) => busyToolSeqs.includes(p.seq) && !(view === 'tool' && toolPage?.seq === p.seq)) ?? null;
  const runningTools = useMemo(() => toolPages.filter((p) => busyToolSeqs.includes(p.seq)).map((p) => p.type), [toolPages, busyToolSeqs]);

  /** 顶栏进度：生成模式用 SSE 上报的槽位完成数（platforms × 5） */
  const studioProgress = studioInput ? { done: Object.keys(slotIndex).length, total: (studioInput.platforms.length || 1) * 5 } : null;

  return (
    <div className="flex min-h-screen w-full bg-white text-ink">
      <Sidebar
        view={view}
        activeTool={view === 'tool' && toolPage ? toolPage.type : ''}
        apiOk={apiOk}
        runningTools={runningTools}
        studioRunning={studioRunning}
        onNavigate={setView}
        onOpenTool={handleOpenTool}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          view={view}
          createStep={createStep}
          studioProgress={studioProgress}
          studioRunning={studioRunning}
          hasStudioTask={Boolean(studioInput)}
          hasBackgroundStudio={studioRunning && view !== 'studio'}
          backgroundToolType={backgroundTool ? backgroundTool.type : null}
          onGoStudio={() => setView('studio')}
          onGoTool={() => { if (backgroundTool) { setToolPage(backgroundTool); setView('tool'); } }}
          onModeChange={(mode) => setView(mode)}
        />
        {/* 小屏工具导航（侧边栏在 <lg 隐藏） */}
        <nav aria-label="工具导航" className="border-b border-line bg-white px-5 py-3 lg:hidden">
          <select
            aria-label="选择工作台工具"
            className="field select-field !py-2.5 text-xs"
            value={view === 'tool' ? toolPage?.type ?? '' : view}
            onChange={(e) => {
              const v = e.target.value;
              if (v === 'create' || v === 'studio' || v === 'market' || v === 'workbench') setView(v);
              else if (v) handleOpenTool(v);
            }}
          >
            <option value="create">五图一键生成 · 创作向导</option>
            {studioInput && <option value="studio">生成工作台</option>}
            {[...IMAGE_TYPES, '本地化', '合规检测', '详情页'].map((tool) => <option key={tool} value={tool}>{tool === '详情页' ? 'AI 详情页' : `${tool}工具`}</option>)}
            <option value="market">市场规范</option>
            <option value="workbench">工作台</option>
          </select>
        </nav>

        <div className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1240px] px-5 py-7 lg:px-10 lg:py-9">
            <div className={view === 'create' ? 'view-in' : 'hidden'}>
              <CreateFlow
                catalog={catalog}
                selection={selection}
                catalogError={catalogError}
                onSelectionChange={onSelectionChange}
                onSubmit={handleSubmit}
                onStepChange={setCreateStep}
              />
            </div>

            {/* StudioView 在任务期间保持挂载：切换视图只隐藏，避免 SSE 流中断或任务重跑 */}
            {studioInput && (
              <div className={view === 'studio' ? 'view-in' : 'hidden'}>
                <StudioView
                  key={studioKey}
                  input={studioInput}
                  models={selection}
                  onOpenWorkbench={handleOpenSlotWorkbench}
                  onSlotIndex={handleSlotIndex}
                  slotUpdate={slotUpdate}
                  onSlotUpdateConsumed={() => setSlotUpdate(null)}
                  onRunningChange={handleStudioRunningChange}
                  onNewTask={() => { setStudioRunning(false); setStudioInput(null); setSlotIndex({}); resetIdleToolPages(); setView('create'); setCreateStep(1); }}
                />
              </div>
            )}
            {view === 'studio' && !studioInput && <EmptyStudio onCreate={() => setView('create')} />}

            <div className={view === 'workbench' ? 'view-in' : 'hidden'}>
              <Workbench slotIndex={slotIndex} onOpenTool={handleOpenTool} onOpenSlot={handleOpenSlotWorkbench} />
            </div>

            <div className={view === 'market' ? 'view-in' : 'hidden'}>
              <MarketRules />
            </div>

            {/* 工具工作台（整页）：实例保持挂载、切换仅隐藏——运行中的任务后台继续，切回可看结果；AI 详情页走 DetailWorkbench，其余为单图工具工作台 */}
            {toolPages.map((page) => {
              const visible = view === 'tool' && toolPage?.seq === page.seq;
              return (
                <div key={page.seq} className={visible ? 'view-in' : 'hidden'}>
                  {page.type === '详情页' ? (
                    <DetailWorkbench
                      images={detailImages}
                      models={selection}
                      initialName={studioInput?.productName ?? ''}
                      initialPoints={studioInput?.sellingPoints ?? ''}
                      initialPlatforms={studioInput?.platforms ?? ['Amazon']}
                      initialTone={studioInput?.detailTone ?? '专业可信'}
                      onBack={() => setView(studioInput ? 'studio' : 'create')}
                      backLabel={studioInput ? '返回生成工作台' : '返回创作向导'}
                      onBusyChange={(busy) => handleToolBusyChange(page.seq, busy)}
                      idScope={page.seq}
                    />
                  ) : (
                    <ToolWorkbench
                      type={page.type}
                      platform={page.platform}
                      platformMarkets={catalog?.platformMarkets}
                      current={page.slotKey ? slotIndex[page.slotKey] ?? null : page.source ?? null}
                      promptOverride={page.promptOverride}
                      models={selection}
                      onBack={() => setView(studioInput ? 'studio' : 'create')}
                      backLabel={studioInput ? '返回生成工作台' : '返回创作向导'}
                      onApplied={page.slotKey ? (image, prompt) => setSlotUpdate({ key: page.slotKey!, image, prompt, seq: Date.now() }) : undefined}
                      onRepair={(type, platform, url, prompt) => { const existing = Object.values(slotIndex).find((slot) => slot.url === url); openToolPage({ type, platform, slotKey: existing?.key ?? null, source: existing ?? { key: '', type, platform, url, size: '', prompt }, promptOverride: prompt, seq: Date.now() }); }}
                      onBusyChange={(busy) => handleToolBusyChange(page.seq, busy)}
                      idScope={page.seq}
                      productFacts={[studioInput?.productName, studioInput?.sellingPoints].filter(Boolean).join('；') || undefined}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyStudio({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex min-h-[420px] items-center justify-center">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-mist text-ink-faint">✦</div>
        <h2 className="text-lg font-bold text-ink">还没有进行中的任务</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-mute">回到创作向导填写商品资料或添加参考图，点击「生成go！」后这里会实时展示生成过程。</p>
        <button type="button" onClick={onCreate} className="btn-primary mt-5 px-5 py-3 text-sm">创建图片任务</button>
      </div>
    </div>
  );
}
