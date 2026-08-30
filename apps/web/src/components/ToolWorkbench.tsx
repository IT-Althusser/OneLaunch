import { useMemo, useRef, useState } from 'react';
import { regenerateSingle, localizeImage, imageProxyUrl } from '../api/client';
import { ReferenceUploader } from './ReferenceUploader';
import { ImageLightbox } from './ImageLightbox';
import type { GeneratedImage, ModelSelection, ReferenceImage, SideToolType } from '../types';

/** 画幅选择项 */
const ASPECTS = [
  { id: '1:1', label: '方形主图', ratio: 1, hint: '平台主图通用' },
  { id: '3:2', label: '横版信息流', ratio: 3 / 2, hint: '横幅 / 搜索位' },
  { id: '2:3', label: '竖版内容流', ratio: 2 / 3, hint: 'TikTok / Shopee 信息流' },
] as const;
type AspectId = (typeof ASPECTS)[number]['id'];

/** 工具选项：中文提示词短语，点击插入「02 文字描述」，再点移除 */
const TOOL_OPTION_GROUPS: Partial<Record<SideToolType, { label: string; options: string[] }[]>> = {
  白底图: [
    { label: '光影', options: ['柔光箱棚拍布光', '自然窗光', '高反射材质质感光'] },
    { label: '投影', options: ['底部自然软投影', '无投影纯白底', '镜面倒影'] },
    { label: '构图', options: ['商品居中占画面 85%', '商品占 70% 留白呼吸感'] },
  ],
  场景图: [
    { label: '场景', options: ['都市街头场景', '居家客厅场景', '咖啡馆场景', '办公桌面场景', '户外山野场景'] },
    { label: '光线', options: ['清晨柔光', '午后自然光', '黄昏暖光', '夜景灯光'] },
    { label: '景深', options: ['浅景深突出商品', '环境全景交代使用场景'] },
  ],
  模特图: [
    { label: '模特', options: ['职场白领模特', '大学生模特', '年轻妈妈模特', '运动青年模特'] },
    { label: '景别', options: ['半身特写', '全身展示', '手部持握特写'] },
    { label: '姿态', options: ['自然手持展示', '上身使用中', '行走抓拍'] },
  ],
  对比图: [
    { label: '版式', options: ['左右分屏对比', '上下分层对比', '要点清单式排版'] },
    { label: '文字', options: ['中文标注', '英文标注', '仅图形无文字'] },
    { label: '维度', options: ['自重对比', '容量对比', '材质对比', '价格优势'] },
  ],
  尺寸图: [
    { label: '标注', options: ['长宽高三维尺寸', '自重标注', '材质说明', '容量说明'] },
    { label: '风格', options: ['线框标注风', '参数卡片风'] },
    { label: '单位', options: ['公制单位 cm·kg', '英制单位 inch·lb'] },
  ],
};

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 画幅默认值按工具特性区分 */
const DEFAULT_ASPECT: Partial<Record<SideToolType, AspectId>> = {
  白底图: '1:1',
  场景图: '3:2',
  模特图: '2:3',
  对比图: '3:2',
  尺寸图: '1:1',
  本地化: '1:1',
};

/** 白底图的平台主图合规提示 */
const PLATFORM_MAIN_IMAGE_RULES: Record<string, string> = {
  Amazon: 'Amazon 主图规范：纯白背景（RGB 255,255,255）、无文字 / 水印 / 道具 / 拼图，商品占比 ≥85%',
  'TikTok Shop': 'TikTok Shop 主图：白底优先，场景与促销元素放附加图，首图忌贴牛皮癣文字',
  Temu: 'Temu 主图：白底简洁，卖点短标签放附加图',
  Shopee: 'Shopee 主图：白底清晰，保证移动端小屏可读',
};

/** 含 AI 文字的工具需要人工复核提醒 */
const TEXT_WARNING: Partial<Record<SideToolType, string>> = {
  对比图: '提示：AI 直出图内的文字可能存在小误差，标注文案与关键卖点建议生成后放大人工核对。',
  尺寸图: '提示：AI 直出图内的数字标注可能不精确，尺寸参数建议以实测为准并人工核对。',
};

const MARKETS = ['US', 'UK', '欧洲', '日本', '东南亚'] as const;

/**
 * 单图工具工作台（整页）：侧栏工具与槽位「工作台」入口的落点。
 * - 01 参考素材（本地化时为必选源图）
 * - 02 文字描述（生成 / 基于当前图修改双模式，或本地化的改写要求 + 目标市场）
 * - 03 输出规格（1:1 / 3:2 / 2:3 画幅；网关固定输出方图，画幅为居中裁切输出规格）
 * current 为空时是独立生成模式：生成结果仅提供下载；有 current 且提供 onApplied 时可应用回生成工作台槽位。
 */
export function ToolWorkbench({
  type,
  platform,
  current,
  models,
  promptOverride,
  onBack,
  backLabel,
  onApplied,
}: {
  type: SideToolType;
  platform: string;
  current?: { url: string; size: string; prompt: string } | null;
  models: ModelSelection;
  /** 外部带入的提示词（如质检修复样例），优先级最高 */
  promptOverride?: string | null;
  onBack: () => void;
  backLabel: string;
  onApplied?: (image: GeneratedImage, prompt: string) => void;
}) {
  const isLocalize = type === '本地化';
  const hasCurrent = Boolean(current?.url);
  const [refs, setRefs] = useState<ReferenceImage[]>([]);
  // 描述默认留空（placeholder 引导）；仅在外部带入明确指令（质检修复样例 / 槽位原提示词）时预填
  const [prompt, setPrompt] = useState(promptOverride || current?.prompt || '');
  const [mode, setMode] = useState<'regen' | 'edit'>('regen');
  const [market, setMarket] = useState<(typeof MARKETS)[number]>('US');
  const [aspect, setAspect] = useState<AspectId>(DEFAULT_ASPECT[type] ?? '1:1');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ image: GeneratedImage; applied: boolean } | null>(null);
  const [preview, setPreview] = useState<{ url: string; type: string; platform: string; size: string } | null>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  const imageMode = !isLocalize;
  const useEditModel = isLocalize || mode === 'edit' || refs.length > 0;
  const activeModel = useEditModel ? models.editModel : models.imageModel;
  const aspectDef = useMemo(() => ASPECTS.find((a) => a.id === aspect)!, [aspect]);
  const displayUrl = result?.image.url ?? current?.url ?? '';

  const sourceMissing = isLocalize && refs.length === 0;
  const canGenerate = !busy && prompt.trim() !== '' && !sourceMissing && (imageMode || refs.length > 0);

  /** 切换生成模式；基于当前图修改时默认把当前图带入源图（可更换） */
  function switchMode(id: 'regen' | 'edit') {
    setMode(id);
    if (id === 'edit' && current?.url && refs.length === 0) {
      setRefs([{ id: 'current-image', src: current.url, name: '当前图', kind: 'url' }]);
    }
  }

  /** 选项点击：插入中文提示词短语，再点移除 */
  function toggleOption(phrase: string) {
    setPrompt((prev) => prev.includes(phrase)
      ? prev.replace(new RegExp(`[,，]?\\s*${escapeRegExp(phrase)}`, 'g'), '').replace(/[,，]\s*[,，]/g, '，').replace(/^[，,\s]+/, '').trim()
      : `${prev.trim().replace(/[,，\s]+$/, '')}，${phrase}`);
    promptRef.current?.focus();
  }

  async function generate() {
    if (!canGenerate) {
      setError(sourceMissing ? '本地化需要先提供一张源图（上传或粘贴链接）' : '请先填写文字描述');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const image = isLocalize
        ? await localizeImage({ sourceUrl: refs[0].src, targetMarket: market, instruction: prompt.trim(), model: models.editModel })
        : await regenerateSingle({
            type: type as never,
            prompt: prompt.trim(),
            platform,
            referenceImages: mode === 'edit' || refs.length === 0 ? undefined : refs.map((r) => r.src),
            sourceUrl: mode === 'edit' ? refs[0]?.src ?? current?.url : undefined,
            model: activeModel,
          });
      setResult({ image, applied: false });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function downloadCropped() {
    const img = new Image();
    img.src = imageProxyUrl(displayUrl);
    try { await img.decode(); } catch { setError('图片加载失败，无法裁切'); return; }
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const ratio = aspectDef.ratio;
    let sw = w;
    let sh = Math.round(w / ratio);
    if (sh > h) { sh = h; sw = Math.round(h * ratio); }
    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    canvas.getContext('2d')?.drawImage(img, Math.round((w - sw) / 2), Math.round((h - sh) / 2), sw, sh, 0, 0, sw, sh);
    canvas.toBlob((blob) => {
      if (!blob) { setError('裁切失败'); return; }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `onelaunch-${type}-${aspect.replace(':', 'x')}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    }, 'image/png');
  }

  return (
    <div className="mx-auto max-w-[1200px]">
      {/* 页头 */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="eyebrow mb-1.5">Tool workbench · {platform}</div>
          <h1 className="text-[26px] font-semibold tracking-[-0.04em] text-[#17202b]">{type} · 单图工作台</h1>
          <p className="mt-1 text-sm text-[#8d867c]">
            {isLocalize
              ? '上传源图，AI 替换背景场景与文字语言，适配目标市场审美。'
              : hasCurrent
                ? `基于当前 ${current!.size} 成品细改：专属参考图、文字描述与投放画幅。`
                : '独立生成一张该类型图片：参考图、文字描述与投放画幅。'}
          </p>
        </div>
        <button type="button" onClick={onBack} className="rounded-xl border border-[#d9d3c9] bg-[#fffdf9] px-4 py-2.5 text-xs font-semibold text-[#5e584f] transition hover:border-[#ef6a4c] hover:text-[#c84f36]">← {backLabel}</button>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* 01 · 参考素材 / 本地化源图 */}
        <section className="panel px-5 py-5">
          <header className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-[#17202b]"><span className="mr-1.5 text-[#ef6a4c]">01</span>{isLocalize ? '本地化源图' : mode === 'edit' ? '源图' : '参考素材'}</h2>
            <span className="text-[10px] font-bold tracking-[0.14em] text-[#a49d92]">{isLocalize ? '必选 · 取第一张' : mode === 'edit' && refs.length > 0 ? '默认当前图 · 可更换' : refs.length > 0 ? `已添加 ${refs.length}` : '可选'}</span>
          </header>
          {isLocalize && refs.length > 0 && (
            <p className="mb-2 rounded-lg bg-[#fdf8ef] px-3 py-2 text-[11px] leading-relaxed text-[#9a8a68]">将以「{refs[0].name}」为源图执行本地化；如需更换请先移除已有素材。</p>
          )}
          <ReferenceUploader
            images={refs}
            onAdd={(items) => setRefs((prev) => isLocalize ? [...prev, ...items].slice(0, 1) : [...prev, ...items])}
            onRemove={(id) => setRefs((prev) => prev.filter((r) => r.id !== id))}
          />
        </section>

        {/* 02 · 文字描述 */}
        <section className="panel px-6 py-5">
          <header className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-[#17202b]"><span className="mr-1.5 text-[#ef6a4c]">02</span>{isLocalize ? '改写要求' : '文字描述'}</h2>
            <span className="text-[10px] text-[#a49d92]">点击插入，仍可继续修改</span>
          </header>
          {imageMode && (
            <div className="mb-3 grid max-w-[520px] grid-cols-2 gap-2">
              {([['regen', '以文字描述生成'], ['edit', '基于当前图修改']] as const).map(([id, label]) => (
                <button key={id} type="button" onClick={() => switchMode(id)} aria-pressed={mode === id}
                  className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold transition ${mode === id ? 'border-[#ef6a4c] bg-[#fff1ed] text-[#b84934]' : 'border-[#e2ddd5] bg-[#fffdf9] text-[#6f685e] hover:border-[#bbb2a6]'}`}>
                  {label}
                </button>
              ))}
            </div>
          )}
          <textarea
            ref={promptRef}
            className="field min-h-[150px] resize-y text-xs"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={isLocalize ? '描述本地化要求，例如：替换为北美家庭玄关场景，文字改为英文' : '描述这张图的画面要求，例如：纯白背景，产品 15 度角摆放，底部柔和投影'}
            disabled={busy}
          />
          {/* 按工具特性分组的选项（点击插入提示词短语，再点移除） */}
          {imageMode && (TOOL_OPTION_GROUPS[type] ?? []).length > 0 && (
            <div className="mt-3 space-y-2">
              {(TOOL_OPTION_GROUPS[type] ?? []).map((group) => (
                <div key={group.label} className="flex flex-wrap items-center gap-1.5">
                  <span className="w-12 shrink-0 text-[10px] font-bold tracking-[0.08em] text-[#a49d92]">{group.label}</span>
                  {group.options.map((opt) => {
                    const on = prompt.includes(opt);
                    return (
                      <button key={opt} type="button" onClick={() => toggleOption(opt)} aria-pressed={on} disabled={busy}
                        className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${on ? 'border-[#ef6a4c] bg-[#fff1ed] text-[#c84f36]' : 'border-[#d9d3c9] bg-[#fffdf9] text-[#6f685e] hover:border-[#bbb2a6]'}`}>
                        {opt}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
          {/* 本地化：目标市场 */}
          {isLocalize && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="w-12 shrink-0 text-[10px] font-bold tracking-[0.08em] text-[#a49d92]">市场</span>
              {MARKETS.map((m) => (
                <button key={m} type="button" onClick={() => setMarket(m)} aria-pressed={market === m} disabled={busy}
                  className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${market === m ? 'border-[#ef6a4c] bg-[#fff1ed] text-[#c84f36]' : 'border-[#d9d3c9] bg-[#fffdf9] text-[#6f685e] hover:border-[#bbb2a6]'}`}>
                  {m}
                </button>
              ))}
            </div>
          )}
          {/* 工具专属提示 */}
          {type === '白底图' && PLATFORM_MAIN_IMAGE_RULES[platform] && (
            <p className="mt-3 rounded-lg bg-[#eef4f0] px-3 py-2 text-[11px] leading-relaxed text-[#3d6b52]">{PLATFORM_MAIN_IMAGE_RULES[platform]}</p>
          )}
          {TEXT_WARNING[type] && (
            <p className="mt-3 rounded-lg bg-[#fdf8ef] px-3 py-2 text-[11px] leading-relaxed text-[#9a8a68]">{TEXT_WARNING[type]}</p>
          )}
        </section>

        {/* 03 · 输出规格（通栏：画幅 + 调用模型） */}
        <section className="panel px-6 py-5 lg:col-span-2">
          <header className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-[#17202b]"><span className="mr-1.5 text-[#ef6a4c]">03</span>输出规格</h2>
            <span className="text-[10px] text-[#a49d92]">选择最终投放画幅</span>
          </header>
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_260px]">
            <div className="grid grid-cols-3 gap-2">
              {ASPECTS.map((a) => (
                <button key={a.id} type="button" onClick={() => setAspect(a.id)} aria-pressed={aspect === a.id}
                  className={`rounded-xl border px-3.5 py-3 text-left transition ${aspect === a.id ? 'border-[#ef6a4c] bg-[#fff1ed]' : 'border-[#e2ddd5] bg-[#fffdf9] hover:border-[#bbb2a6]'}`}>
                  <span className={`flex items-center justify-between text-sm font-bold ${aspect === a.id ? 'text-[#c84f36]' : 'text-[#39342e]'}`}>{a.id}{aspect === a.id && <span className="text-xs">✓</span>}</span>
                  <span className="mt-0.5 block text-[11px] font-semibold text-[#514b43]">{a.label}</span>
                  <span className="mt-0.5 block text-[10px] leading-snug text-[#9a9389]">{a.hint}</span>
                </button>
              ))}
            </div>
            <div className="rounded-xl bg-[#f4f1eb] px-4 py-3.5">
              <div className="text-[10px] font-bold tracking-[0.12em] text-[#a49d92]">本次调用模型</div>
              <div className="mt-1 text-xs font-semibold text-[#39342e]">{activeModel}</div>
              <div className="mt-1 text-[10px] leading-relaxed text-[#8d867c]">{useEditModel ? '图生图（参考图 / 当前图修改 / 本地化）' : '文生图'} · 网关固定输出方图，画幅为居中裁切输出规格。</div>
            </div>
          </div>
        </section>
      </div>

      {/* 结果对比 */}
      {result && (
        <section className="panel mt-5 px-6 py-5">
          <header className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-[#17202b]">生成结果</h2>
            <span className="text-[10px] text-[#a49d92]">{result.image.size} · {result.image.type}</span>
          </header>
          <div className="flex flex-wrap items-start gap-4">
            {hasCurrent && (
              <div>
                <p className="mb-1.5 text-[10px] font-bold tracking-[0.12em] text-[#a49d92]">当前图</p>
                <img
                  src={current!.url}
                  alt="当前图"
                  className="h-44 w-44 cursor-zoom-in rounded-xl border border-[#e2ddd5] object-cover"
                  title="双击放大预览"
                  onDoubleClick={() => setPreview({ url: current!.url, type, platform, size: current!.size })}
                />
              </div>
            )}
            <div>
              <p className="mb-1.5 text-[10px] font-bold tracking-[0.12em] text-[#c84f36]">新图 · {aspect}</p>
              <div className="overflow-hidden rounded-xl border border-[#ef6a4c]" style={{ width: 176, aspectRatio: String(aspectDef.ratio) }}>
                <img
                  src={result.image.url}
                  alt="新图"
                  className="h-full w-full cursor-zoom-in object-cover"
                  title="双击放大预览"
                  onDoubleClick={() => setPreview({ url: result.image.url, type, platform, size: result.image.size })}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2 self-stretch justify-center">
              {onApplied && (
                <button type="button" onClick={() => { onApplied(result.image, prompt.trim()); setResult((prev) => prev ? { ...prev, applied: true } : prev); }}
                  className="rounded-xl bg-[#ef6a4c] px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-[#d95d41]">
                  {result.applied ? '已应用 ✓' : `应用回${platform}槽位`}
                </button>
              )}
              <a href={imageProxyUrl(result.image.url, true)} className="rounded-xl border border-[#d9d3c9] bg-[#fffdf9] px-5 py-2.5 text-center text-xs font-semibold text-[#5e584f] transition hover:border-[#ef6a4c] hover:text-[#c84f36]">下载原图</a>
              {aspect !== '1:1' && (
                <button type="button" onClick={downloadCropped} className="rounded-xl border border-[#d9d3c9] bg-[#fffdf9] px-5 py-2.5 text-xs font-semibold text-[#5e584f] transition hover:border-[#ef6a4c] hover:text-[#c84f36]">
                  下载{aspect}裁切图
                </button>
              )}
            </div>
          </div>
        </section>
      )}
      {error && <div className="mt-5 rounded-xl border border-[#f0b7a8] bg-[#fff1ed] px-4 py-3 text-xs text-[#a44836]">{error}</div>}

      {/* 底部操作条 */}
      <div className="panel sticky bottom-4 mt-5 flex flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xl text-xs leading-relaxed text-[#8d867c]">
          {isLocalize
            ? `本地化：以源图 + 改写要求调用图生图（${market} 市场审美），生成后可按 ${aspect} 画幅下载。`
            : mode === 'edit'
              ? `基于当前图修改：以当前成品为源图 + 描述改动，生成后可按 ${aspect} 画幅下载${onApplied ? '或应用回槽位' : ''}。`
              : refs.length > 0
                ? `参考图生成：以 ${refs.length} 张参考素材保持商品一致，生成后可按 ${aspect} 画幅下载${onApplied ? '或应用回槽位' : ''}。`
                : `文生图：按文字描述生成，生成后可按 ${aspect} 画幅下载${onApplied ? '或应用回槽位' : ''}。`}
        </p>
        <button type="button" onClick={generate} disabled={!canGenerate}
          className="rounded-xl bg-[#ef6a4c] px-7 py-3.5 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(239,106,76,.22)] transition hover:bg-[#d95d41] disabled:cursor-not-allowed disabled:bg-[#c9c1b7] disabled:shadow-none">
          {busy ? '正在生成，通常 20–60 秒…' : isLocalize ? `开始本地化（${market} · ${aspect}）→` : mode === 'edit' ? `基于当前图重新生成（${aspect}）→` : `开始生成（${refs.length > 0 ? `参考图 ${refs.length} 张 · 图生图` : '文生图'} · ${aspect}）→`}
        </button>
      </div>

      {preview && <ImageLightbox image={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}
