import { useEffect, useRef, useState } from 'react';
import { streamImagePipeline, regenerateSingle, imageProxyUrl } from '../api/client';
import { DetailPages } from './DetailPages';
import { ImageLightbox } from './ImageLightbox';
import {
  imageTypesForPlatform,
  type GeneratedImage,
  type ImagePipelineInput,
  type ImagePipelineResult,
  type ImageSlotState,
  type ImageType,
  type ModelSelection,
  type SlotBrief,
  type ThinkingLogLine,
} from '../types';

const slotKey = (platform: string, type: string) => `${platform}||${type}`;

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function nowTime(): string {
  return new Date().toLocaleTimeString('zh-CN', { hour12: false });
}

/** 画像文本清洗：剥离 markdown 加粗与模型自带的重复标题，列表符转圆点 */
function formatProfile(raw: string): string {
  return raw
    .replace(/\*\*/g, '')
    .trim()
    .replace(/^[【\[]?商品画像[】\]]?[:：]?\s*\n*/, '')
    .replace(/^\s*[*-]\s+/gm, '· ');
}

/** 终态分档：全败=失败、部分=部分完成、全成=已完成（避免全败仍显示绿色已完成） */
function finalStatus(doneCount: number, totalSlots: number): { label: string; tone: string; dot: string } {
  if (totalSlots > 0 && doneCount === 0) return { label: '生成失败', tone: 'bg-[#fdeceb] text-[#a44836]', dot: 'bg-[#d9534f]' };
  if (doneCount < totalSlots) return { label: `部分完成 ${doneCount}/${totalSlots}`, tone: 'bg-[#fdf3e2] text-[#9a6b2f]', dot: 'bg-[#e0a23c]' };
  return { label: '已完成', tone: 'bg-[#e9f7ee] text-[#1d7a44]', dot: 'bg-[#2ea35f]' };
}

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

interface Editor {
  key: string;
  type: string;
  platform: string;
  mode: 'regen' | 'edit';
  prompt: string;
}

/**
 * 生成工作台：五图实时槽位 + 思考过程日志（SSE）+ 单图重新生成/修改。
 * 挂载即启动流式任务；StrictMode 下用 ref 保证只启动一次。
 * - onSlotIndex：把已完成槽位摘要上报给 App（侧栏工具打开对应工作台时定位当前图）
 * - slotUpdate：单图工具工作台「应用回槽位」的更新指令
 * - onOpenWorkbench：槽位「工作台」按钮 → 跳转单图工具工作台整页
 */
export function StudioView({
  input,
  models,
  onOpenWorkbench,
  onSlotIndex,
  slotUpdate,
  onSlotUpdateConsumed,
  onNewTask,
}: {
  input: ImagePipelineInput;
  models: ModelSelection;
  onOpenWorkbench?: (slotKey: string, type: string, platform: string, promptOverride?: string) => void;
  onSlotIndex?: (index: Record<string, SlotBrief>) => void;
  slotUpdate?: { key: string; image: GeneratedImage; prompt: string; seq: number } | null;
  onSlotUpdateConsumed?: () => void;
  onNewTask: () => void;
}) {
  const startedRef = useRef(false);
  const consoleRef = useRef<HTMLDivElement>(null);
  const [logs, setLogs] = useState<ThinkingLogLine[]>([{ text: '任务已提交，等待网关响应…', time: nowTime() }]);
  const [profile, setProfile] = useState('');
  const [result, setResult] = useState<ImagePipelineResult | null>(null);
  const [fatal, setFatal] = useState('');
  const [running, setRunning] = useState(true);
  const [startedAt] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [editorError, setEditorError] = useState('');
  const [preview, setPreview] = useState<{ url: string; type: string; platform: string; size: string } | null>(null);

  const platforms = input.platforms.length > 0 ? input.platforms : ['Amazon'];
  const typeMap = imageTypesForPlatform(platforms);
  const refs = input.referenceImages ?? [];

  const [slots, setSlots] = useState<Record<string, ImageSlotState>>(() => {
    const initial: Record<string, ImageSlotState> = {};
    for (const platform of platforms) {
      for (const type of typeMap[platform]) initial[slotKey(platform, type)] = { status: 'pending' };
    }
    return initial;
  });

  const totalSlots = Object.keys(slots).length;
  const doneCount = Object.values(slots).filter((s) => s.status === 'done').length;

  useEffect(() => {
    // 任务结束（完成/失败/中断）即停表，避免「已完成」后耗时仍走动
    if (!running) return;
    const timer = setInterval(() => setElapsed(Date.now() - startedAt), 1000);
    return () => clearInterval(timer);
  }, [running, startedAt]);

  useEffect(() => {
    if (consoleRef.current) consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
  }, [logs]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    streamImagePipeline(input, (event, data) => {
      const key = slotKey(str(data.platform, 'Amazon'), str(data.type));
      switch (event) {
        case 'log':
          setLogs((prev) => [...prev, { text: str(data.text, ''), time: nowTime() }]);
          break;
        case 'profile':
          setProfile(formatProfile(str(data.text)));
          break;
        case 'image_start':
          setSlots((prev) => ({ ...prev, [key]: { ...prev[key], status: 'running', prompt: str(data.prompt), error: undefined } }));
          break;
        case 'image_done':
          setSlots((prev) => ({
            ...prev,
            [key]: { ...prev[key], status: 'done', url: str(data.url), size: str(data.size), prompt: str(data.prompt, str(prev[key]?.prompt)), error: undefined },
          }));
          break;
        case 'image_fail':
          setSlots((prev) => ({ ...prev, [key]: { ...prev[key], status: 'failed', error: str(data.error, '生成失败') } }));
          break;
        case 'done':
          setResult(data as unknown as ImagePipelineResult);
          setRunning(false);
          setElapsed(Date.now() - startedAt);
          setLogs((prev) => [...prev, { text: '—— 任务完成 ——', time: nowTime() }]);
          break;
        case 'fatal':
          setFatal(str(data.error, '任务失败'));
          setRunning(false);
          setElapsed(Date.now() - startedAt);
          setLogs((prev) => [...prev, { text: `任务失败：${str(data.error, '')}`, time: nowTime() }]);
          break;
        default:
          break;
      }
    }).catch((e: unknown) => {
      setFatal((e as Error).message);
      setRunning(false);
      setLogs((prev) => [...prev, { text: `连接失败：${(e as Error).message}`, time: nowTime() }]);
    });
    // 流式任务与挂载一一对应，input/models 均在挂载时固定
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runSingle(editor: Editor, prompt: string, sourceUrl?: string) {
    const key = slotKey(editor.platform, editor.type);
    setBusyKey(key);
    setEditorError('');
    setLogs((prev) => [...prev, { text: sourceUrl ? `正在基于当前图修改：${editor.type}（${editor.platform}）…` : `正在重新生成：${editor.type}（${editor.platform}）…`, time: nowTime() }]);
    try {
      const image = await regenerateSingle({
        type: editor.type as never,
        prompt,
        platform: editor.platform,
        referenceImages: sourceUrl ? undefined : (refs.length > 0 ? refs : undefined),
        sourceUrl,
        model: sourceUrl ? models.editModel : (refs.length > 0 ? models.editModel : models.imageModel),
      });
      setSlots((prev) => ({ ...prev, [key]: { ...prev[key], status: 'done', url: image.url, size: image.size, prompt, error: undefined } }));
      setLogs((prev) => [...prev, { text: `✓ ${editor.type}（${editor.platform}）已更新 · ${image.size}`, time: nowTime() }]);
      setEditor(null);
    } catch (e) {
      const message = (e as Error).message;
      setEditorError(message);
      setLogs((prev) => [...prev, { text: `✗ ${editor.type} 更新失败：${message}`, time: nowTime() }]);
    } finally {
      setBusyKey(null);
    }
  }

  // 已完成槽位摘要上报（App 的单图工具工作台据此带入当前图）
  const slotIndexRef = useRef(onSlotIndex);
  slotIndexRef.current = onSlotIndex;
  useEffect(() => {
    const index: Record<string, SlotBrief> = {};
    for (const [key, s] of Object.entries(slots)) {
      if (s.status === 'done' && s.url) {
        const [platform, type] = key.split('||');
        index[key] = { key, type: type as ImageType, platform, url: s.url, size: s.size ?? '', prompt: s.prompt ?? '' };
      }
    }
    slotIndexRef.current?.(index);
  }, [slots]);

  // 单图工具工作台「应用回槽位」指令
  const lastUpdateSeq = useRef(0);
  useEffect(() => {
    if (!slotUpdate || slotUpdate.seq === lastUpdateSeq.current) return;
    lastUpdateSeq.current = slotUpdate.seq;
    const { key, image, prompt } = slotUpdate;
    setSlots((prev) => ({ ...prev, [key]: { ...prev[key], status: 'done', url: image.url, size: image.size, prompt, error: undefined } }));
    setLogs((prev) => [...prev, { text: `✓ ${image.type}（${image.platform}）已在工作台更新 · ${image.size}`, time: nowTime() }]);
    onSlotUpdateConsumed?.();
    // 仅响应应用指令序号变化
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotUpdate?.seq]);

  return (
    <div className="mx-auto max-w-[1200px]">
      {/* 状态条 */}
      <div className="panel mb-5 flex flex-wrap items-center gap-x-5 gap-y-2 px-6 py-4">
        {(() => {
          const finalState = !running && !fatal ? finalStatus(doneCount, totalSlots) : null;
          const label = running ? '生成中' : fatal ? '任务失败' : finalState!.label;
          const tone = running ? 'bg-[#fff1ed] text-[#c84f36]' : fatal ? 'bg-[#fdeceb] text-[#a44836]' : finalState!.tone;
          const dot = running ? 'animate-pulse bg-[#ef6a4c]' : fatal ? 'bg-[#d9534f]' : finalState!.dot;
          return (
            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${tone}`}>
              <span className={`h-2 w-2 rounded-full ${dot}`} />
              {label}
            </span>
          );
        })()}
        <span className="text-xs font-semibold text-[#514b43]">{doneCount} / {totalSlots} 张完成</span>
        <span className="text-xs text-[#8d867c]">耗时 {formatElapsed(elapsed)}</span>
        <span className="hidden text-xs text-[#8d867c] md:inline">
          {input.productName ? `《${input.productName}》` : '按参考图生成'} · {refs.length > 0 ? `参考图 ${refs.length} 张 · 图生图` : '无参考图 · 文生图'}
        </span>
        <button type="button" onClick={onNewTask} className="ml-auto rounded-xl border border-[#d9d3c9] bg-[#fffdf9] px-4 py-2 text-xs font-semibold text-[#5e584f] transition hover:border-[#ef6a4c] hover:text-[#c84f36]">新建任务</button>
      </div>

      {fatal && <div className="mb-5 rounded-xl border border-[#f0b7a8] bg-[#fff1ed] px-4 py-3 text-sm text-[#a44836]">{fatal}</div>}

      <div className="grid gap-5 xl:grid-cols-[1fr_330px]">
        {/* 左：图片槽位 */}
        <div className="min-w-0 space-y-5">
          {platforms.map((platform) => (
            <section key={platform} className="panel px-5 py-5">
              <header className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold text-[#17202b]">{platform}</h2>
                <span className="text-[11px] text-[#8d867c]">完整五图 · 按平台规范差异化</span>
              </header>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {typeMap[platform].map((type) => {
                  const key = slotKey(platform, type);
                  return <SlotCard key={key} type={type} state={slots[key]} busy={busyKey === key} onOpenWorkbench={() => onOpenWorkbench?.(key, type, platform)} onRegen={() => { setEditorError(''); setEditor({ key, type, platform, mode: 'regen', prompt: slots[key]?.prompt ?? '' }); }} onEdit={() => { setEditorError(''); setEditor({ key, type, platform, mode: 'edit', prompt: '' }); }} editorOpen={editor?.key === key} onPreview={() => { const s = slots[key]; if (s?.url) setPreview({ url: s.url, type, platform, size: s.size ?? '' }); }} />;
                })}
              </div>
              {editor && editor.platform === platform && (
                <SlotEditor
                  editor={editor}
                  busy={busyKey === editor.key}
                  error={editorError}
                  onChange={(prompt) => setEditor((prev) => (prev ? { ...prev, prompt } : prev))}
                  onCancel={() => { setEditor(null); setEditorError(''); }}
                  onConfirm={() => { if (editor.prompt.trim()) runSingle(editor, editor.prompt.trim(), editor.mode === 'edit' ? slots[editor.key]?.url : undefined); }}
                />
              )}
            </section>
          ))}

          {/* 质检摘要 */}
          {result && result.qa.length > 0 && <QaSummary qa={result.qa} slots={slots} onFix={(slotKey, type, platform, prompt) => onOpenWorkbench?.(slotKey, type, platform, prompt)} />}

          {/* 详情页（AI 组合配图与文案） */}
          {result && result.detailPages && result.detailPages.length > 0 && <DetailPages pages={result.detailPages} images={result.images} />}
        </div>

        {/* 右：思考过程 + 画像 */}
        <div className="min-w-0 space-y-4 xl:sticky xl:top-4 xl:self-start">
          <section className="overflow-hidden rounded-[20px] bg-[#19232b] shadow-[0_12px_32px_rgba(25,35,43,.25)]">
            <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <h2 className="text-xs font-bold tracking-[0.12em] text-[#8f9ba1]">思考过程</h2>
              <span className={`h-1.5 w-1.5 rounded-full ${running ? 'animate-pulse bg-[#ef6a4c]' : 'bg-[#3d4c54]'}`} />
            </header>
            <div ref={consoleRef} className="max-h-[420px] space-y-1.5 overflow-y-auto px-4 py-3 font-mono text-[11px] leading-relaxed">
              {logs.map((line, i) => (
                <p key={`${line.time}-${i}`} className="log-line flex gap-2">
                  <span className="shrink-0 text-[#5d6d75]">{line.time}</span>
                  <span className={line.text.startsWith('✓') ? 'text-[#8ed1a5]' : line.text.startsWith('✗') ? 'text-[#f2a08d]' : 'text-[#c3cdd2]'}>{line.text}</span>
                </p>
              ))}
              {running && <p className="text-[#5d6d75]">▍</p>}
            </div>
          </section>

          {profile && (
            <details className="panel px-4 py-3" open>
              <summary className="cursor-pointer list-none text-xs font-bold tracking-[0.12em] text-[#8b8479]">商品画像</summary>
              <p className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap text-[11px] leading-relaxed text-[#514b43]">{profile}</p>
            </details>
          )}
        </div>
      </div>

      {preview && <ImageLightbox image={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

function SlotCard({
  type,
  state,
  busy,
  editorOpen,
  onOpenWorkbench,
  onRegen,
  onEdit,
  onPreview,
}: {
  type: string;
  state?: ImageSlotState;
  busy: boolean;
  editorOpen: boolean;
  onOpenWorkbench: () => void;
  onRegen: () => void;
  onEdit: () => void;
  onPreview: () => void;
}) {
  const status = state?.status ?? 'pending';
  const hasImage = Boolean(state?.url);
  // 下载原图经同源代理带 Content-Disposition: attachment；入口收敛到右上角「下载」按钮
  const downloadImage = () => {
    if (!state?.url || busy) return;
    const a = document.createElement('a');
    a.href = imageProxyUrl(state.url, true);
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };
  return (
    <div className={`group relative overflow-hidden rounded-xl border bg-[#f8f5ef] transition ${editorOpen ? 'border-[#ef6a4c]' : 'border-[#e2ddd5]'}`}>
      <div
        className={`relative aspect-square w-full ${hasImage && !busy ? 'cursor-zoom-in' : ''}`}
        onDoubleClick={() => { if (hasImage && !busy) onPreview(); }}
        onKeyDown={(e) => { if (e.key === 'Enter' && hasImage && !busy) { e.preventDefault(); onPreview(); } }}
        role={hasImage ? 'button' : undefined}
        tabIndex={hasImage && !busy ? 0 : undefined}
        title={hasImage && !busy ? '双击放大预览；右上角可下载原图' : undefined}
      >
        {hasImage && (
          <img src={state?.url} alt={type} className={`h-full w-full object-cover transition ${busy ? 'opacity-40' : ''}`} loading="lazy" />
        )}
        {/* pending / running 占位 */}
        {!hasImage && (
          <div className="flex h-full flex-col items-center justify-center gap-1.5 px-2 text-center">
            {status === 'running' ? (
              <>
                <span className="slot-shimmer h-1 w-3/5 rounded-full bg-[#e2ddd5]" />
                <span className="slot-shimmer h-1 w-4/5 rounded-full bg-[#e8e2d9]" style={{ animationDelay: '0.15s' }} />
                <span className="slot-shimmer h-1 w-2/5 rounded-full bg-[#e2ddd5]" style={{ animationDelay: '0.3s' }} />
              </>
            ) : (
              <>
                <span className="text-xs font-semibold text-[#8d867c]">{type}</span>
                <span className="text-[10px] text-[#b3ab9f]">{status === 'failed' ? '生成失败' : '等待中'}</span>
              </>
            )}
          </div>
        )}
        {/* 类型 + 尺寸标签 */}
        {hasImage && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-4">
            <span className="text-[11px] font-semibold text-white">{type}</span>
            <span className="ml-1.5 text-[9px] text-white/70">{state?.size}</span>
          </div>
        )}
        {/* 失败提示 */}
        {status === 'failed' && hasImage && <span className="absolute left-1.5 top-1.5 rounded-full bg-[#d9534f] px-1.5 py-0.5 text-[9px] font-bold text-white">上次失败</span>}
        {status === 'failed' && !hasImage && <span className="absolute left-1.5 top-1.5 rounded-full bg-[#d9534f] px-1.5 py-0.5 text-[9px] font-bold text-white">失败</span>}
        {/* 操作按钮（hover 或选中时显示） */}
        {hasImage && !busy && (
          <div onDoubleClick={(e) => e.stopPropagation()} className={`absolute right-1.5 top-1.5 flex flex-col gap-1 transition ${editorOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'}`}>
            <button type="button" onClick={(e) => { e.stopPropagation(); downloadImage(); }} className="rounded-lg bg-black/65 px-2 py-1 text-[10px] font-semibold text-white transition hover:bg-[#ef6a4c]">下载</button>
            <button type="button" onClick={(e) => { e.stopPropagation(); onOpenWorkbench(); }} className="rounded-lg bg-black/65 px-2 py-1 text-[10px] font-semibold text-white transition hover:bg-[#ef6a4c]">工作台</button>
            <button type="button" onClick={(e) => { e.stopPropagation(); onRegen(); }} className="rounded-lg bg-black/65 px-2 py-1 text-[10px] font-semibold text-white transition hover:bg-[#ef6a4c]">重新生成</button>
            <button type="button" onClick={(e) => { e.stopPropagation(); onEdit(); }} className="rounded-lg bg-black/65 px-2 py-1 text-[10px] font-semibold text-white transition hover:bg-[#ef6a4c]">修改</button>
          </div>
        )}
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/25">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-label="生成中" />
          </div>
        )}
        {status === 'running' && !hasImage && (
          <span className="absolute bottom-1.5 left-0 right-0 truncate px-2 text-center text-[9px] text-[#8d867c]">网关生成中，通常 20–60 秒</span>
        )}
      </div>
    </div>
  );
}

function SlotEditor({
  editor,
  busy,
  error,
  onChange,
  onCancel,
  onConfirm,
}: {
  editor: Editor;
  busy: boolean;
  error: string;
  onChange: (prompt: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="mt-3 rounded-xl border border-[#e2ddd5] bg-[#fffdf9] px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-bold text-[#39342e]">
          {editor.mode === 'regen' ? `重新生成 · ${editor.type}（${editor.platform}）` : `基于当前图修改 · ${editor.type}（${editor.platform}）`}
        </span>
        <span className="text-[10px] text-[#a49d92]">{editor.mode === 'regen' ? '文生图 / 参考图生成' : '图生图 · 以当前结果为源图'}</span>
      </div>
      <textarea
        className="field min-h-[64px] resize-y text-xs"
        value={editor.prompt}
        onChange={(e) => onChange(e.target.value)}
        placeholder={editor.mode === 'regen' ? '编辑提示词后重新生成，例如：纯白背景，产品稍微倾斜 15 度，增加投影' : '描述要改什么，例如：把背景换成清晨的咖啡桌场景，保留商品不变'}
        disabled={busy}
      />
      {error && <p className="mt-1.5 text-xs text-[#c84f36]">{error}</p>}
      <div className="mt-2 flex justify-end gap-2">
        <button type="button" onClick={onCancel} disabled={busy} className="rounded-lg border border-[#d9d3c9] px-3 py-1.5 text-xs font-semibold text-[#6f685e] transition hover:border-[#bbb2a6] disabled:opacity-50">取消</button>
        <button type="button" onClick={onConfirm} disabled={busy || !editor.prompt.trim()} className="rounded-lg bg-[#ef6a4c] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[#d95d41] disabled:cursor-not-allowed disabled:bg-[#c9c1b7]">
          {busy ? '生成中…' : editor.mode === 'regen' ? '确认重新生成' : '确认修改'}
        </button>
      </div>
    </div>
  );
}

function QaSummary({
  qa,
  slots,
  onFix,
}: {
  qa: { type: string; url: string; passed: boolean; comment: string; issues?: string[]; model?: string; suggestedPrompt?: string }[];
  slots: Record<string, ImageSlotState>;
  onFix: (slotKey: string, type: string, platform: string, prompt: string) => void;
}) {
  const visionQc = qa.some((q) => q.model);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  return (
    <section className="panel px-5 py-4">
      <h2 className="mb-2 text-sm font-bold text-[#17202b]">白底图质检{visionQc ? ' · 视觉审核' : ' · 人工复检提醒'}</h2>
      <div className="space-y-1.5">
        {qa.map((q, i) => {
          const slotEntry = Object.entries(slots).find(([, s]) => s.url === q.url);
          return (
          <div key={i} className="rounded-lg border border-[#e8e2d9] px-3 py-2">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 shrink-0 rounded-full ${q.passed ? 'bg-[#2ea35f]' : 'bg-[#d9534f]'}`} />
              <span className="text-xs font-semibold text-[#39342e]">{q.type}</span>
              {q.model && <span className="shrink-0 rounded-full bg-[#eee9e1] px-2 py-0.5 text-[9px] font-bold text-[#6f685e]">{q.model}</span>}
              <span className="ml-auto truncate text-[11px] text-[#8d867c]">{q.comment}</span>
            </div>
            {q.issues && q.issues.length > 0 && (
              <ul className="mt-1.5 list-disc space-y-0.5 pl-6 text-[10px] leading-relaxed text-[#a44836]">
                {q.issues.map((issue, j) => <li key={j}>{issue}</li>)}
              </ul>
            )}
            {/* 未通过时给出符合规范的修复提示词样例：可复制，或一键去工作台修复 */}
            {!q.passed && q.suggestedPrompt && (
              <div className="mt-2 rounded-lg bg-[#f4f1eb] p-2.5">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold tracking-[0.12em] text-[#8b8479]">修复提示词样例 · 已按平台规范生成</span>
                  <span className="flex shrink-0 gap-1.5">
                    <button type="button" onClick={() => { navigator.clipboard?.writeText(q.suggestedPrompt!); setCopiedIdx(i); }}
                      className="rounded-md border border-[#d9d3c9] bg-[#fffdf9] px-2 py-0.5 text-[10px] font-semibold text-[#5e584f] transition hover:border-[#ef6a4c] hover:text-[#c84f36]">
                      {copiedIdx === i ? '已复制 ✓' : '复制'}
                    </button>
                    {slotEntry && (
                      <button type="button" onClick={() => { const [platform, type] = slotEntry[0].split('||'); onFix(slotEntry[0], type, platform, q.suggestedPrompt!); }}
                        className="rounded-md bg-[#ef6a4c] px-2 py-0.5 text-[10px] font-semibold text-white transition hover:bg-[#d95d41]">
                        用此提示词修复
                      </button>
                    )}
                  </span>
                </div>
                <p className="break-all font-mono text-[10px] leading-relaxed text-[#514b43]">{q.suggestedPrompt}</p>
              </div>
            )}
          </div>
          );
        })}
      </div>
    </section>
  );
}
