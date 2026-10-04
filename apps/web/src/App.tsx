import { useCallback, useEffect, useMemo, useState } from 'react';

/*
 * 方向契约（impeccable code-led 扩展，既有暖纸/橙色/深侧栏世界）
 * THESIS: 输入商品与参考图 → 五图在生产线上实时成形，过程全程可见、单图可返工——拒绝"提交后黑盒等待"的表单工具范式。
 * OWN-WORLD: 暖纸底 #f4f1eb、奶白面板 #fffdf9、橙 #ef6a4c 单一强调、深墨 #19232b 侧栏与日志控制台；20px 圆角 panel、12px field、无第二套样式系统。
 * STORY: 卖家在 01 添加商品参考图、02 填商品资料 → 03 右栏选定调用模型 → 生成工作台里看思考日志逐行滚动、图片逐格点亮（点图下载）；侧栏工具直开对应单图工具工作台整页细改，完成后附 AI 详情页图文编排。
 * FIRST VIEWPORT: 创作页 01/02 双卡 + 右栏 03 模型与调用；生成页顶部状态胶囊（状态·计数·耗时）+ 左槽位网格 + 右深色日志台。
 * FORM: 既有世界内的三区扩展（用户指定参考 JuECOM 的 01/02/03 功能结构）；finish 以"未评审未记录即未完成"收口。
 */
import { Sidebar } from './components/Sidebar';
import { CreatePanel } from './components/CreatePanel';
import { StudioView } from './components/StudioView';
import { ToolWorkbench } from './components/ToolWorkbench';
import { DetailWorkbench } from './components/DetailWorkbench';
import { RightPanel } from './components/RightPanel';
import { fetchModelCatalog } from './api/client';
import type {
  GeneratedImage,
  ImagePipelineInput,
  ModelCatalog,
  ModelSelection,
  ReferenceImage,
  SideToolType,
  SlotBrief,
  WorkbenchTab,
} from './types';
import { IMAGE_TYPES } from './types';

type Tab = WorkbenchTab;

/** 单图工具工作台实例：切换工作台时保持挂载（仅隐藏），生成任务在后台继续运行；seq 为实例唯一标识 */
type ToolPageState = {
  type: SideToolType;
  slotKey: string | null;
  platform: string;
  source?: SlotBrief;
  promptOverride?: string;
  seq: number;
};

const DEFAULT_SELECTION: ModelSelection = { imageModel: '', editModel: '', textModel: '', visionModel: '', editGateway: 'default' };

export default function App() {
  const [tab, setTab] = useState<Tab>('create');
  const [refs, setRefs] = useState<ReferenceImage[]>([]);
  const [catalog, setCatalog] = useState<ModelCatalog | null>(null);
  const [selection, setSelection] = useState<ModelSelection>(DEFAULT_SELECTION);
  const [error, setError] = useState('');
  const [studioInput, setStudioInput] = useState<ImagePipelineInput | null>(null);
  const [studioKey, setStudioKey] = useState(0);
  const [studioRunning, setStudioRunning] = useState(false);
  const [apiOk, setApiOk] = useState<boolean | null>(null);
  const [toolPages, setToolPages] = useState<ToolPageState[]>([]);
  const [toolPage, setToolPage] = useState<ToolPageState | null>(null);
  const [busyToolSeqs, setBusyToolSeqs] = useState<number[]>([]);
  const [engagedToolSeqs, setEngagedToolSeqs] = useState<number[]>([]);
  const [slotIndex, setSlotIndex] = useState<Record<string, SlotBrief>>({});
  const [slotUpdate, setSlotUpdate] = useState<{ key: string; image: GeneratedImage; prompt: string; seq: number } | null>(null);

  useEffect(() => {
    fetch('/api/health').then((r) => setApiOk(r.ok)).catch(() => setApiOk(false));
    fetchModelCatalog()
      .then((c) => {
        setCatalog(c);
        // 网关清单可用时，把选择校准到真实存在的模型（默认项优先已验证）
        // 图生图模型清单跟随当前路由档位：默认档校准主网关清单，自定义档校准独立网关清单
        setSelection((previous) => {
          const prev = c.defaults ?? previous;
          const editOptions = previous.editGateway === 'custom' && c.editToImage?.length ? c.editToImage : c.imageToImage;
          return ({
            imageModel: pickModel(c.textToImage, prev.imageModel),
            editModel: pickModel(editOptions, prev.editModel),
            textModel: pickModel(c.text, prev.textModel),
            visionModel: pickModel(c.vision, prev.visionModel),
            editGateway: previous.editGateway,
          });
        });
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  function handleSubmit(input: ImagePipelineInput) {
    setError('');
    setStudioInput(input);
    setStudioRunning(true);
    setSlotIndex({});
    setStudioKey((k) => k + 1);
    resetIdleToolPages();
    setTab('studio');
  }

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

  /**
   * 打开（或回到）单图工具工作台：
   * - 同类型同槽位实例正在运行 → 复用实例回到任务现场，后台任务不被打断
   * - 实例发起过任务且本次无新指令（promptOverride）→ 复用实例回看结果
   * - 其余情况新建实例并替换同键旧实例
   */
  const openToolPage = useCallback((next: ToolPageState) => {
    setError('');
    const existing = toolPages.find((p) => p.type === next.type && p.slotKey === next.slotKey);
    const reusable = existing && (busyToolSeqs.includes(existing.seq) || (!next.promptOverride && engagedToolSeqs.includes(existing.seq))) ? existing : null;
    const target = reusable ?? next;
    if (!reusable) setToolPages((prev) => [...prev.filter((p) => !(p.type === target.type && p.slotKey === target.slotKey)), target]);
    setToolPage(target);
    setTab('tool');
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

  const handleSlotIndex = useCallback((index: Record<string, SlotBrief>) => setSlotIndex(index), []);

  const handleOpenSlotWorkbench = useCallback((slotKey: string, type: string, platform: string, promptOverride?: string) => {
    openToolPage({ type: type as SideToolType, slotKey, platform, promptOverride, seq: Date.now() });
  }, [openToolPage]);

  /** 已完成槽位图 → AI 详情页工作台的配图引用（槽位 key 唯一） */
  const detailImages = useMemo<GeneratedImage[]>(
    () => Object.values(slotIndex).map((b) => ({ type: b.type, platform: b.platform, size: b.size, url: b.url })),
    [slotIndex],
  );

  /** 后台运行中的工具任务（当前不在查看的实例）：页头显示返回入口 */
  const backgroundTool = toolPages.find((p) => busyToolSeqs.includes(p.seq) && !(tab === 'tool' && toolPage?.seq === p.seq)) ?? null;

  return (
    <div className="flex min-h-screen bg-[#f4f1eb] text-[#17202b]">
      <Sidebar apiOk={apiOk} tab={tab} activeTool={tab === 'tool' && toolPage ? toolPage.type : ''} onNavigate={setTab} onOpenTool={handleOpenTool} />
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-[88px] shrink-0 flex-wrap items-center justify-between gap-4 border-b border-[#e2ddd5] bg-[#fffdf9] px-5 py-5 lg:px-10">
          <div>
            <div className="eyebrow mb-2">OneLaunch / Image studio</div>
            <h1 className="text-[24px] font-semibold tracking-[-0.045em] text-[#17202b] sm:text-[30px]">把新品，做成一套能上架的图。</h1>
            <p className="mt-1.5 hidden text-sm text-[#8d867c] md:block">参考图 + 商品资料 → 五图实时生成，过程可见，单图可改。</p>
          </div>
          <nav className="flex shrink-0 rounded-xl border border-[#e2ddd5] bg-[#f4f1eb] p-1">
            {(['create', 'studio'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                aria-pressed={tab === t}
                className={`rounded-lg px-3 py-2 text-xs font-semibold transition sm:px-4 ${tab === t ? 'bg-[#19232b] text-white shadow-sm' : 'text-[#777168] hover:text-[#17202b]'}`}
              >
                {t === 'create' ? '创作工作台' : '生成工作台'}
              </button>
            ))}
          </nav>
          {(studioInput && tab !== 'studio' && studioRunning) || backgroundTool ? (
            <div className="order-3 flex shrink-0 flex-wrap items-center gap-2">
              {studioInput && tab !== 'studio' && studioRunning && (
                <button type="button" onClick={() => setTab('studio')} className="inline-flex items-center gap-2 rounded-full bg-[#fff1ed] px-3 py-1.5 text-xs font-semibold text-[#c84f36] hover:bg-[#fde4dc]" aria-label="返回正在运行的生成任务">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-[#ef6a4c]" />生成任务后台运行中 · 返回查看
                </button>
              )}
              {backgroundTool && (
                <button type="button" onClick={() => { setToolPage(backgroundTool); setTab('tool'); }} className="inline-flex items-center gap-2 rounded-full bg-[#fff1ed] px-3 py-1.5 text-xs font-semibold text-[#c84f36] hover:bg-[#fde4dc]" aria-label="返回正在运行的工具任务">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-[#ef6a4c]" />{backgroundTool.type === '详情页' ? 'AI 详情页' : backgroundTool.type}任务后台运行中 · 返回查看
                </button>
              )}
            </div>
          ) : null}
        </header>
        <nav aria-label="工具导航" className="border-b border-[#e2ddd5] bg-[#fffdf9] px-5 py-3 lg:hidden">
          <select aria-label="选择工作台工具" className="field select-field" value={tab === 'tool' ? toolPage?.type ?? '' : ''} onChange={(e) => { if (e.target.value) handleOpenTool(e.target.value); else setTab('create'); }}>
            <option value="">五图套图生成</option>
            {[...IMAGE_TYPES, '本地化', '合规检测', '详情页'].map((tool) => <option key={tool} value={tool}>{tool === '详情页' ? 'AI 详情页' : tool}</option>)}
          </select>
        </nav>
        <div className="flex flex-1 overflow-hidden">
          <div className="min-w-0 flex-1 overflow-y-auto px-5 py-7 lg:px-10 lg:py-9">
            <details className="panel mb-5 px-4 py-3 xl:hidden"><summary className="cursor-pointer text-sm font-semibold">模型与调用</summary><RightPanel inline catalog={catalog} selection={selection} onChange={setSelection} error={error} /></details>
            <div className={tab === 'create' ? '' : 'hidden'}>
              <CreatePanel
                refs={refs}
                onAddRefs={(items) => setRefs((prev) => [...prev, ...items])}
                onRemoveRef={(id) => setRefs((prev) => prev.filter((r) => r.id !== id))}
                models={selection}
                qaScope={catalog?.qaScope}
                loading={false}
                error={error}
                onSubmit={handleSubmit}
              />
            </div>
            {/* StudioView 在任务期间保持挂载：切换 tab 只隐藏，避免 SSE 流中断或任务重跑 */}
            {studioInput && (
              <div className={tab === 'studio' ? '' : 'hidden'}>
                <StudioView
                  key={studioKey}
                  input={studioInput}
                  models={selection}
                  onOpenWorkbench={handleOpenSlotWorkbench}
                  onSlotIndex={handleSlotIndex}
                  slotUpdate={slotUpdate}
                  onSlotUpdateConsumed={() => setSlotUpdate(null)}
                  onRunningChange={handleStudioRunningChange}
                  onNewTask={() => { setStudioRunning(false); setStudioInput(null); setSlotIndex({}); resetIdleToolPages(); setTab('create'); }}
                />
              </div>
            )}
            {/* 工具工作台（整页）：实例保持挂载、切换仅隐藏——运行中的任务后台继续，切回可看结果；AI 详情页走 DetailWorkbench，其余为单图工具工作台 */}
            {toolPages.map((page) => {
              const visible = tab === 'tool' && toolPage?.seq === page.seq;
              return (
                <div key={page.seq} className={visible ? '' : 'hidden'}>
                  {page.type === '详情页' ? (
                    <DetailWorkbench
                      images={detailImages}
                      models={selection}
                      initialName={studioInput?.productName ?? ''}
                      initialPoints={studioInput?.sellingPoints ?? ''}
                      initialPlatforms={studioInput?.platforms ?? ['Amazon']}
                      initialTone={studioInput?.detailTone ?? '专业可信'}
                      onBack={() => setTab(studioInput ? 'studio' : 'create')}
                      backLabel={studioInput ? '返回生成工作台' : '返回创作工作台'}
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
                      onBack={() => setTab(studioInput ? 'studio' : 'create')}
                      backLabel={studioInput ? '返回生成工作台' : '返回创作工作台'}
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
            {tab === 'studio' && !studioInput && <EmptyStudio onCreate={() => setTab('create')} />}
          </div>
          <RightPanel catalog={catalog} selection={selection} onChange={setSelection} error={error} />
        </div>
      </main>
    </div>
  );
}

/** 清单可用时优先保留用户选择；否则回退到已验证项，再回退到第一项。 */
function pickModel(options: { id: string; verified: boolean }[], current: string): string {
  if (options.some((o) => o.id === current)) return current;
  const verified = options.find((o) => o.verified);
  return (verified ?? options[0])?.id ?? current;
}

function EmptyStudio({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex min-h-[420px] items-center justify-center">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[20px] bg-[#e8e2d9] text-2xl text-[#8d867c]">✦</div>
        <h2 className="text-lg font-semibold text-[#39342e]">还没有进行中的任务</h2>
        <p className="mt-2 text-sm leading-relaxed text-[#8d867c]">回到创作工作台，填写商品资料或添加参考图，点击「开始生成五图」后这里会实时展示生成过程。</p>
        <button type="button" onClick={onCreate} className="mt-4 rounded-xl bg-[#ef6a4c] px-5 py-3 text-sm font-semibold text-white hover:bg-[#d95d41]">创建图片任务</button>
      </div>
    </div>
  );
}
