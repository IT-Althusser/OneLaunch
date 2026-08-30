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

type Tab = WorkbenchTab;

const DEFAULT_SELECTION: ModelSelection = { imageModel: 'wan2.7-image-pro', editModel: 'qwen-image-2.0', textModel: 'qwen3.7-max', visionModel: 'qwen3.6-plus' };

export default function App() {
  const [tab, setTab] = useState<Tab>('create');
  const [refs, setRefs] = useState<ReferenceImage[]>([]);
  const [catalog, setCatalog] = useState<ModelCatalog | null>(null);
  const [selection, setSelection] = useState<ModelSelection>(DEFAULT_SELECTION);
  const [error, setError] = useState('');
  const [studioInput, setStudioInput] = useState<ImagePipelineInput | null>(null);
  const [studioKey, setStudioKey] = useState(0);
  const [apiOk, setApiOk] = useState<boolean | null>(null);
  const [toolPage, setToolPage] = useState<{ type: SideToolType; slotKey: string | null; platform: string; promptOverride?: string; seq: number } | null>(null);
  const [slotIndex, setSlotIndex] = useState<Record<string, SlotBrief>>({});
  const [slotUpdate, setSlotUpdate] = useState<{ key: string; image: GeneratedImage; prompt: string; seq: number } | null>(null);

  useEffect(() => {
    fetch('/api/health').then((r) => setApiOk(r.ok)).catch(() => setApiOk(false));
    fetchModelCatalog()
      .then((c) => {
        setCatalog(c);
        // 网关清单可用时，把选择校准到真实存在的模型（默认项优先已验证）
        setSelection((prev) => ({
          imageModel: pickModel(c.textToImage, prev.imageModel),
          editModel: pickModel(c.imageToImage, prev.editModel),
          textModel: pickModel(c.text, prev.textModel),
          visionModel: pickModel(c.vision, prev.visionModel),
        }));
      })
      .catch(() => setCatalog(null));
  }, []);

  function handleSubmit(input: ImagePipelineInput) {
    setError('');
    setStudioInput(input);
    setStudioKey((k) => k + 1);
    setTab('studio');
  }

  /** 侧栏工具：打开对应类型的单图工具工作台整页；该类型已有完成图则带入槽位，否则独立生成 */
  const handleOpenTool = useCallback((tool: string) => {
    setError('');
    const platform = studioInput?.platforms[0] ?? 'Amazon';
    // 本地化 / AI 详情页为独立工作台，不带入生成工作台槽位
    const key = tool === '本地化' || tool === '详情页' ? null : `${platform}||${tool}`;
    const slot = key ? slotIndex[key] : undefined;
    setToolPage({ type: tool as SideToolType, slotKey: slot?.key ?? null, platform: slot?.platform ?? platform, seq: Date.now() });
    setTab('tool');
  }, [studioInput, slotIndex]);

  const handleSlotIndex = useCallback((index: Record<string, SlotBrief>) => setSlotIndex(index), []);

  const handleOpenSlotWorkbench = useCallback((slotKey: string, type: string, platform: string, promptOverride?: string) => {
    setToolPage({ type: type as SideToolType, slotKey, platform, promptOverride, seq: Date.now() });
    setTab('tool');
  }, []);

  /** 已完成槽位图 → AI 详情页工作台的配图引用（槽位 key 唯一） */
  const detailImages = useMemo<GeneratedImage[]>(
    () => Object.values(slotIndex).map((b) => ({ type: b.type, platform: b.platform, size: b.size, url: b.url })),
    [slotIndex],
  );

  return (
    <div className="flex min-h-screen bg-[#f4f1eb] text-[#17202b]">
      <Sidebar apiOk={apiOk} tab={tab} activeTool={tab === 'tool' && toolPage ? toolPage.type : ''} onNavigate={setTab} onOpenTool={handleOpenTool} />
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-[88px] shrink-0 items-center justify-between gap-6 border-b border-[#e2ddd5] bg-[#fffdf9] px-6 py-5 lg:px-10">
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
        </header>
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-5 py-7 lg:px-10 lg:py-9">
            {tab === 'create' && (
              <CreatePanel
                refs={refs}
                onAddRefs={(items) => setRefs((prev) => [...prev, ...items])}
                onRemoveRef={(id) => setRefs((prev) => prev.filter((r) => r.id !== id))}
                models={selection}
                loading={false}
                error={error}
                onSubmit={handleSubmit}
              />
            )}
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
                  onNewTask={() => { setStudioInput(null); setTab('create'); }}
                />
              </div>
            )}
            {/* 工具工作台（整页）：AI 详情页走 DetailWorkbench，其余为单图工具工作台；key 含类型与槽位：切换工具时按新特性重新初始化 */}
            {tab === 'tool' && toolPage && (
              toolPage.type === '详情页' ? (
                <DetailWorkbench
                  key={`detail-${toolPage.seq}`}
                  images={detailImages}
                  models={selection}
                  initialName={studioInput?.productName ?? ''}
                  initialPoints={studioInput?.sellingPoints ?? ''}
                  initialPlatforms={studioInput?.platforms ?? ['Amazon']}
                  initialTone={studioInput?.detailTone ?? '专业可信'}
                  onBack={() => setTab(studioInput ? 'studio' : 'create')}
                  backLabel={studioInput ? '返回生成工作台' : '返回创作工作台'}
                />
              ) : (
                <ToolWorkbench
                  key={`${toolPage.type}-${toolPage.slotKey ?? 'standalone'}-${toolPage.seq}`}
                  type={toolPage.type}
                  platform={toolPage.platform}
                  current={toolPage.slotKey ? slotIndex[toolPage.slotKey] ?? null : null}
                  promptOverride={toolPage.promptOverride}
                  models={selection}
                  onBack={() => setTab(studioInput ? 'studio' : 'create')}
                  backLabel={studioInput ? '返回生成工作台' : '返回创作工作台'}
                  onApplied={toolPage.slotKey ? (image, prompt) => setSlotUpdate({ key: toolPage.slotKey!, image, prompt, seq: Date.now() }) : undefined}
                />
              )
            )}
            {tab === 'studio' && !studioInput && <EmptyStudio />}
          </div>
          <RightPanel catalog={catalog} selection={selection} onChange={setSelection} />
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

function EmptyStudio() {
  return (
    <div className="flex min-h-[420px] items-center justify-center">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[20px] bg-[#e8e2d9] text-2xl text-[#8d867c]">✦</div>
        <h2 className="text-lg font-semibold text-[#39342e]">还没有进行中的任务</h2>
        <p className="mt-2 text-sm leading-relaxed text-[#8d867c]">回到创作工作台，填写商品资料或添加参考图，点击「开始生成五图」后这里会实时展示生成过程。</p>
      </div>
    </div>
  );
}
