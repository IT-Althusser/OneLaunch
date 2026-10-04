import { useEffect, useMemo, useRef, useState } from 'react';
import { regenerateSingle, localizeImage, complianceCheck, imageProxyUrl } from '../api/client';
import { ReferenceUploader } from './common/ReferenceUploader';
import { ImageLightbox } from './common/ImageLightbox';
import { PLATFORMS, IMAGE_TYPES, type ImageType, type ComplianceResult, type GeneratedImage, type ModelSelection, type ReferenceImage, type SideToolType } from '../types';
import { ComplianceIssues } from './common/ComplianceIssues';

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
    { label: '景别', options: ['腰部以上完整人物', '全身展示', '人物与商品同框'] },
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

/** 平台默认投放市场兜底表（优先用后端 /api/models 下发的 platformMarkets，单一只读副本仅兜底） */
function marketForPlatform(platform: string, platformMarkets?: Record<string, string>): string {
  const mapped = platformMarkets?.[platform];
  if (mapped) return mapped;
  switch (platform) {
    case 'TikTok Shop': case 'Shopee': return '东南亚';
    case 'Temu': return '欧盟';
    case '日本': return '日本';
    case 'UK': return 'UK';
    case '欧洲': return '欧盟';
    default: return 'US';
  }
}

/** 画幅默认值按工具特性区分 */
const DEFAULT_ASPECT: Partial<Record<SideToolType, AspectId>> = {
  白底图: '1:1',
  场景图: '3:2',
  模特图: '2:3',
  对比图: '3:2',
  尺寸图: '1:1',
  本地化: '1:1',
  合规检测: '1:1',
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
  platform: initialPlatform,
  current,
  models,
  promptOverride,
  onBack,
  backLabel,
  onApplied,
  onRepair,
  onBusyChange,
  idScope,
  productFacts,
  platformMarkets,
}: {
  type: SideToolType;
  platform: string;
  current?: { url: string; size: string; prompt: string; type?: ImageType } | null;
  models: ModelSelection;
  /** 后端 /api/models 下发的平台→市场映射（缺失时用本地兜底表） */
  platformMarkets?: Record<string, string>;
  /** 外部带入的提示词（如质检修复样例），优先级最高 */
  promptOverride?: string | null;
  onBack: () => void;
  backLabel: string;
  onApplied?: (image: GeneratedImage, prompt: string) => void;
  onRepair: (type: ImageType, platform: string, url: string, prompt: string) => void;
  /** 向应用外壳上报运行状态；工作台隐藏时请求仍继续执行。 */
  onBusyChange?: (busy: boolean) => void;
  /** 实例标识：多实例并存（后台任务保持挂载）时保证 DOM id 唯一 */
  idScope?: string | number;
  /** 商品资料（名称+卖点）：合规检测与流水线 QA 保持同一判定口径 */
  productFacts?: string;
}) {
  const isLocalize = type === '本地化';
  const isCompliance = type === '合规检测';
  const hasCurrent = Boolean(current?.url);
  const [platform, setPlatform] = useState(initialPlatform);
  const [refs, setRefs] = useState<ReferenceImage[]>(current?.url && (isLocalize || isCompliance || promptOverride) ? [{ id: 'current-image', src: current.url, name: '当前商品图', kind: 'url' }] : []);
  // 描述默认留空（placeholder 引导）；仅在外部带入明确指令（质检修复样例 / 槽位原提示词）时预填
  const [prompt, setPrompt] = useState(promptOverride || current?.prompt || '');
  const [mode, setMode] = useState<'regen' | 'edit'>(promptOverride && current?.url ? 'edit' : 'regen');
  const [market, setMarket] = useState<(typeof MARKETS)[number]>('US');
  const [aspects, setAspects] = useState<string[]>(['scene']);
  const [targetLanguage, setTargetLanguage] = useState('英语');
  const [modelProfile, setModelProfile] = useState('欧美面孔模特');
  const [complianceMarket, setComplianceMarket] = useState(marketForPlatform(platform, platformMarkets));
  const [complianceType, setComplianceType] = useState<ImageType>(current?.type ?? '白底图');
  const [complianceResult, setComplianceResult] = useState<ComplianceResult | null>(null);
  const [aspect, setAspect] = useState<AspectId>(DEFAULT_ASPECT[type] ?? '1:1');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ image: GeneratedImage; applied: boolean; appliedAspects?: string[]; note?: string; prompt?: string } | null>(null);
  /** 生成结果的自动合规复检（五类图）：新图 URL 直传检测，无需下载重传 */
  const [resultCompliance, setResultCompliance] = useState<ComplianceResult | null>(null);
  const [complianceChecking, setComplianceChecking] = useState(false);
  const [complianceCheckError, setComplianceCheckError] = useState('');
  const [copied, setCopied] = useState(false);
  const [preview, setPreview] = useState<{ url: string; type: string; platform: string; size: string } | null>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const busyChangeRef = useRef(onBusyChange);
  const checkSeqRef = useRef(0);
  /** 最近一次生成所用锚点参考图（edit→源图 / regen→首张参考图），供手动「重新检测」复用 P3 本体检验 */
  const lastAnchorRef = useRef<string | undefined>(undefined);
  const promptId = idScope != null ? `tool-prompt-${idScope}` : 'tool-prompt';

  useEffect(() => { busyChangeRef.current = onBusyChange; }, [onBusyChange]);
  useEffect(() => { busyChangeRef.current?.(busy || complianceChecking); }, [busy, complianceChecking]);
  useEffect(() => () => busyChangeRef.current?.(false), []);

  const imageMode = !isLocalize && !isCompliance;
  const useEditModel = isLocalize || mode === 'edit' || refs.length > 0;
  const activeModel = useEditModel ? models.editModel : models.imageModel;
  const aspectDef = useMemo(() => ASPECTS.find((a) => a.id === aspect)!, [aspect]);
  const displayUrl = result?.image.url ?? current?.url ?? '';

  const sourceMissing = (isLocalize || isCompliance) && refs.length === 0;
  const canGenerate = !busy && (isCompliance || isLocalize || prompt.trim() !== '') && !sourceMissing && (mode !== 'edit' || refs.length > 0);

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

  /** 生成结果自动合规复检（含 P3 本体一致性检验）：新图 URL 直传检测，referenceUrl 为本次生成的锚点参考图（regen→参考图 / edit→源图）；
   *  seq 守卫丢弃过期结果，防止与新一轮检测竞态 */
  async function checkCompliance(url: string, referenceUrl?: string) {
    const seq = ++checkSeqRef.current;
    setComplianceChecking(true);
    setComplianceCheckError('');
    setResultCompliance(null);
    try {
      const checked = await complianceCheck({ imageUrl: url, imageType: type as ImageType, platform, market: marketForPlatform(platform, platformMarkets), visionModel: models.visionModel, productFacts, referenceImageUrl: referenceUrl });
      if (seq !== checkSeqRef.current) return;
      setResultCompliance(checked);
    } catch (e) {
      if (seq !== checkSeqRef.current) return;
      setComplianceCheckError((e as Error).message);
    } finally {
      if (seq === checkSeqRef.current) setComplianceChecking(false);
    }
  }

  // 合规工作台带入图片后自动发起检测：URL 直传内部接口，无需下载重传；
  // 结果写入 complianceResult（工作台原生检测结果区渲染），换图时清掉过期结果。
  useEffect(() => {
    if (!isCompliance || !refs[0]?.src || busy) return;
    setComplianceResult(null);
    void (async () => {
      setBusy(true);
      setError('');
      try {
        const checked = await complianceCheck({ imageUrl: refs[0].src, imageType: complianceType, platform, market: complianceMarket, visionModel: models.visionModel, productFacts });
        setComplianceResult(checked);
        setResult(null);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCompliance, refs[0]?.src]);

  /** 合规复检未通过时的一键修复：新图转源图、切编辑模式、预填修复指令并立即再生成（生成后自动再复检） */
  async function repairWithSuggestion() {
    const suggestion = resultCompliance?.suggestedPrompt;
    if (!suggestion || !result?.image.url || busy || complianceChecking) return;
    const repairRefs: ReferenceImage[] = [{ id: `repair-${result.image.url}`, src: result.image.url, name: '待修复的新图', kind: 'url' }];
    setPrompt(suggestion);
    setMode('edit');
    setRefs(repairRefs);
    await generate({ prompt: suggestion, mode: 'edit', refs: repairRefs });
  }

  /** overrides 供一键修复等程序化调用直接传参，绕过表单校验；人工点击时校验状态门槛 */
  async function generate(overrides?: { prompt?: string; mode?: 'regen' | 'edit'; refs?: ReferenceImage[] }) {
    const nextPrompt = (overrides?.prompt ?? prompt).trim();
    const nextMode = overrides?.mode ?? mode;
    const nextRefs = overrides?.refs ?? refs;
    if (!overrides && !canGenerate) {
      setError(sourceMissing ? '请先提供一张源图（上传或粘贴图片链接）' : '请填写文字描述并在修改模式提供源图');
      return;
    }
    setBusy(true);
    setError('');
    setResult(null);
    setComplianceResult(null);
    setResultCompliance(null);
    setComplianceCheckError('');
    try {
      if (isCompliance) {
        const checked = await complianceCheck({ imageUrl: nextRefs[0].src, imageType: complianceType, platform, market: complianceMarket, visionModel: models.visionModel, productFacts });
        setComplianceResult(checked);
        setResult(null);
        return;
      }
      if (isLocalize) {
        const localized = await localizeImage({ sourceUrl: nextRefs[0].src, targetMarket: market, instruction: nextPrompt, model: models.editModel, aspects, targetLanguage, modelProfile, editGateway: models.editGateway });
        setResult({ ...localized, applied: false });
        return;
      }
      const nextActiveModel = isLocalize || nextMode === 'edit' || nextRefs.length > 0 ? models.editModel : models.imageModel;
      const editSourceUrl = nextMode === 'edit' ? nextRefs[0]?.src ?? current?.url : undefined;
      const image = await regenerateSingle({
            type: type as ImageType,
            prompt: nextPrompt,
            platform,
            referenceImages: nextMode === 'edit' || nextRefs.length === 0 ? undefined : nextRefs.map((r) => r.src),
            sourceUrl: editSourceUrl,
            model: nextActiveModel,
            editGateway: models.editGateway,
          });
      setResult({ image, applied: false });
      // 生成即复检（含 P3 本体一致性）：锚点参考 = edit→源图 / regen→首张参考图；新图 URL 直传合规检测，结果内联展示，未通过可一键修复
      if (imageMode) {
        const anchorUrl = nextMode === 'edit' ? editSourceUrl : (nextRefs.length > 0 ? nextRefs[0].src : undefined);
        lastAnchorRef.current = anchorUrl;
        void checkCompliance(image.url, anchorUrl);
      }
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
          <h1 className="text-[26px] font-semibold tracking-[-0.04em] text-[#0d0d0d]">{type} · 单图工作台</h1>
          <p className="mt-1 text-sm text-[#8e8e9a]">
            {isCompliance
              ? '上传商品图或粘贴图片链接，检查平台规范与目标市场广告法风险。'
              : isLocalize
              ? '背景场景 / 文字语言 / 模特形象'
              : hasCurrent
                ? `基于当前 ${current!.size} 成品细改：专属参考图、文字描述与投放画幅。`
                : '独立生成一张该类型图片：参考图、文字描述与投放画幅。'}
          </p>
        </div>
        <button type="button" onClick={onBack} className="rounded-xl border border-[#dcdce3] bg-[#ffffff] px-4 py-2.5 text-xs font-semibold text-[#5d5d6b] transition hover:border-ink hover:text-ink">← {backLabel}</button>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* 01 · 参考素材 / 本地化源图 */}
        <section className="cardpx-5 py-5">
          <header className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-[#0d0d0d]"><span className="mr-1.5 text-[#0d0d0d]">01</span>{isCompliance ? '检测对象' : isLocalize ? '本地化源图' : mode === 'edit' ? '源图' : '参考素材'}</h2>
            <span className="text-[10px] font-bold tracking-[0.14em] text-[#b4b4bf]">{isCompliance || isLocalize ? '必选 · 取第一张' : mode === 'edit' && refs.length > 0 ? '默认当前图 · 可更换' : refs.length > 0 ? `已添加 ${refs.length}` : '可选'}</span>
          </header>
          {(isLocalize || isCompliance) && refs.length > 0 && (
            <p className="mb-2 break-words rounded-lg bg-[#fffbeb] px-3 py-2 text-[11px] leading-relaxed text-[#b45309]">当前源图：{refs[0].name}</p>
          )}
          <ReferenceUploader
            images={refs}
            maxImages={isLocalize || isCompliance || mode === 'edit' ? 1 : 6}
            disabled={busy}
            onAdd={(items) => setRefs((prev) => (isLocalize || isCompliance) ? [...prev, ...items].slice(0, 1) : [...prev, ...items])}
            onRemove={(id) => setRefs((prev) => prev.filter((r) => r.id !== id))}
          />
        </section>

        {/* 02 · 文字描述 */}
        <section className="cardpx-6 py-5">
          <header className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-[#0d0d0d]"><span className="mr-1.5 text-[#0d0d0d]">02</span>{isCompliance ? '检测范围' : isLocalize ? '本地化维度' : '文字描述'}</h2>
          </header>
          {imageMode && (
            <div className="mb-3 grid max-w-[520px] grid-cols-2 gap-2">
              {([['regen', '以文字描述生成'], ['edit', '基于当前图修改']] as const).map(([id, label]) => (
                <button key={id} type="button" onClick={() => switchMode(id)} aria-pressed={mode === id}
                  className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold transition ${mode === id ? 'border-ink bg-mist text-ink' : 'border-[#e9e9ee] bg-[#ffffff] text-[#5d5d6b] hover:border-[#b4b4bf]'}`}>
                  {label}
                </button>
              ))}
            </div>
          )}
          {isCompliance && <div className="mb-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-[#5d5d6b]">平台<select disabled={busy} className="field mt-1" value={platform} onChange={(e) => setPlatform(e.target.value)}>{PLATFORMS.map((p) => <option key={p}>{p}</option>)}</select></label>
            <label className="text-xs text-[#5d5d6b]">目标市场<select disabled={busy} className="field mt-1" value={complianceMarket} onChange={(e) => setComplianceMarket(e.target.value)}><option>US</option><option>UK</option><option>欧盟</option><option>日本</option><option>东南亚</option></select></label>
            <label className="text-xs text-[#5d5d6b]">图类<select disabled={busy} className="field mt-1" value={complianceType} onChange={(e) => setComplianceType(e.target.value as ImageType)}>{IMAGE_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
          </div>}
          {isLocalize && <div className="mb-3 flex flex-wrap gap-2">{[['scene','背景场景'],['text','文字语言'],['model','模特形象']].map(([id,label]) => <button key={id} type="button" disabled={busy} aria-pressed={aspects.includes(id)} onClick={() => setAspects((p) => p.includes(id) ? p.length > 1 ? p.filter((x) => x !== id) : p : [...p,id])} className={`rounded-xl border px-3 py-2 text-xs font-semibold ${aspects.includes(id) ? 'border-ink bg-mist text-ink' : 'border-[#dcdce3] bg-[#ffffff] text-[#5d5d6b]'}`}>{label}</button>)}</div>}
          {!isCompliance && <label htmlFor={promptId} className="mb-2 block text-xs text-[#5d5d6b]">{isLocalize ? '附加要求（可选）' : '画面要求'}</label>}
          {!isCompliance && <textarea
            id={promptId}
            ref={promptRef}
            className="field min-h-[150px] resize-y text-xs"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={isLocalize ? '描述本地化要求，例如：替换为北美家庭玄关场景，文字改为英文' : '描述这张图的画面要求，例如：纯白背景，产品 15 度角摆放，底部柔和投影'}
            disabled={busy}
          />}
          {/* 按工具特性分组的选项（点击插入提示词短语，再点移除） */}
          {imageMode && (TOOL_OPTION_GROUPS[type] ?? []).length > 0 && (
            <div className="mt-3 space-y-2">
              {(TOOL_OPTION_GROUPS[type] ?? []).map((group) => (
                <div key={group.label} className="flex flex-wrap items-center gap-1.5">
                  <span className="w-12 shrink-0 text-[10px] font-bold tracking-[0.08em] text-[#b4b4bf]">{group.label}</span>
                  {group.options.map((opt) => {
                    const on = prompt.includes(opt);
                    return (
                      <button key={opt} type="button" onClick={() => toggleOption(opt)} aria-pressed={on} disabled={busy}
                        className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${on ? 'border-ink bg-mist text-ink' : 'border-[#dcdce3] bg-[#ffffff] text-[#5d5d6b] hover:border-[#b4b4bf]'}`}>
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
            <>
            {aspects.includes('text') && <label className="mt-3 block text-xs text-[#5d5d6b]">目标语言<select disabled={busy} className="field mt-1" value={targetLanguage} onChange={(e) => setTargetLanguage(e.target.value)}><option>英语</option><option>日语</option><option>德语</option><option>法语</option><option>西班牙语</option><option>泰语</option><option>印尼语</option></select></label>}
            {aspects.includes('model') && <label className="mt-3 block text-xs text-[#5d5d6b]">模特形象<select disabled={busy} className="field mt-1" value={modelProfile} onChange={(e) => setModelProfile(e.target.value)}><option>欧美面孔模特</option><option>日韩面孔模特</option><option>东南亚面孔模特</option><option>移除模特仅保留商品</option></select></label>}
            {aspects.includes('text') && <p className="mt-3 rounded-lg bg-[#fffbeb] px-3 py-2 text-xs text-[#b45309]">AI 生成文字可能有小误差，请人工复核</p>}
            </>
          )}
          {isLocalize && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="w-12 shrink-0 text-[10px] font-bold tracking-[0.08em] text-[#b4b4bf]">市场</span>
              {MARKETS.map((m) => (
                <button key={m} type="button" onClick={() => { setMarket(m); setTargetLanguage(m === '日本' ? '日语' : '英语'); }} aria-pressed={market === m} disabled={busy}
                  className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${market === m ? 'border-ink bg-mist text-ink' : 'border-[#dcdce3] bg-[#ffffff] text-[#5d5d6b] hover:border-[#b4b4bf]'}`}>
                  {m}
                </button>
              ))}
            </div>
          )}
          {/* 工具专属提示 */}
          {type === '白底图' && PLATFORM_MAIN_IMAGE_RULES[platform] && (
            <p className="mt-3 rounded-lg bg-[#ecfdf5] px-3 py-2 text-[11px] leading-relaxed text-[#047857]">{PLATFORM_MAIN_IMAGE_RULES[platform]}</p>
          )}
          {TEXT_WARNING[type] && (
            <p className="mt-3 rounded-lg bg-[#fffbeb] px-3 py-2 text-[11px] leading-relaxed text-[#b45309]">{TEXT_WARNING[type]}</p>
          )}
        </section>

        {/* 03 · 输出规格（通栏：画幅 + 调用模型） */}
        {!isCompliance && <section className="cardpx-6 py-5 lg:col-span-2">
          <header className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-[#0d0d0d]"><span className="mr-1.5 text-[#0d0d0d]">03</span>输出规格</h2>
            <span className="text-[10px] text-[#b4b4bf]">选择最终投放画幅</span>
          </header>
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_260px]">
            <div className="grid grid-cols-3 gap-2">
              {ASPECTS.map((a) => (
                <button key={a.id} type="button" onClick={() => setAspect(a.id)} aria-pressed={aspect === a.id}
                  className={`rounded-xl border px-3.5 py-3 text-left transition ${aspect === a.id ? 'border-ink bg-mist' : 'border-line bg-white hover:border-ink-faint'}`}>
                  <span className={`flex items-center justify-between text-sm font-bold ${aspect === a.id ? 'text-ink' : 'text-ink-soft'}`}>{a.id}{aspect === a.id && <span className="text-xs">✓</span>}</span>
                  <span className="mt-0.5 block text-[11px] font-semibold text-[#5d5d6b]">{a.label}</span>
                  <span className="mt-0.5 block text-[10px] leading-snug text-[#b4b4bf]">{a.hint}</span>
                </button>
              ))}
            </div>
            <div className="rounded-xl bg-[#f7f7f8] px-4 py-3.5">
              <div className="text-[10px] font-bold tracking-[0.12em] text-[#b4b4bf]">本次调用模型</div>
              <div className="mt-1 text-xs font-semibold text-[#5d5d6b]">{activeModel}</div>
              <div className="mt-1 text-[10px] leading-relaxed text-[#8e8e9a]">{useEditModel ? '图生图（参考图 / 当前图修改 / 本地化）' : '文生图'} · 网关固定输出方图，画幅为居中裁切输出规格。</div>
            </div>
          </div>
        </section>}
      </div>

      {/* 结果对比 */}
      {busy && <section className="cardslot-shimmer mt-5 px-6 py-5" role="status"><p className="text-sm text-[#5d5d6b]">{isCompliance ? '合规 Agent：正在核查平台与市场规则…' : '生成工具：正在处理图片…'}</p><div className="mt-3 h-20 rounded-xl bg-[#f0f0f3]" /></section>}
      {isCompliance && !busy && !complianceResult && <section className="cardmt-5 px-6 py-5"><h2 className="text-sm font-semibold"><span className="mr-1.5 text-[#0d0d0d]">03</span>检测结果</h2><p className="mt-2 text-xs text-[#5d5d6b]">{error ? '检测未完成，请检查错误信息后重试。' : '等待检测'}</p></section>}
      {isCompliance && complianceResult && (
        <section className="cardmt-5 px-6 py-5">
          <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold"><span className="mr-1.5 text-[#0d0d0d]">03</span>检测结果</h2>
            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${complianceResult.passed ? 'bg-[#ecfdf5] text-[#059669]' : 'bg-[#fef2f2] text-[#dc2626]'}`}><span className={`h-2 w-2 rounded-full ${complianceResult.passed ? 'bg-[#10b981]' : 'bg-[#dc2626]'}`} />{complianceResult.passed ? '通过' : '未通过'}</span>
          </header>
          <p className="break-words text-xs leading-relaxed text-[#5d5d6b]">{complianceResult.summary}</p>
          {complianceResult.passed && complianceResult.passReasons && complianceResult.passReasons.length > 0 && (
            <div className="mt-3 rounded-xl bg-[#ecfdf5] px-4 py-3">
              <p className="text-[10px] font-bold tracking-[0.12em] text-[#059669]">通过依据</p>
              <ul className="mt-1 space-y-0.5 text-xs leading-relaxed text-[#047857]">
                {complianceResult.passReasons.map((reason, index) => <li key={index}>· {reason}</li>)}
              </ul>
            </div>
          )}
          <ComplianceIssues issues={complianceResult.complianceIssues ?? []} />
          {complianceResult.suggestedPrompt && <div className="mt-3 border-t border-[#e9e9ee] pt-3">
            <p className="break-words text-xs leading-relaxed text-[#5d5d6b]">{complianceResult.suggestedPrompt}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(complianceResult.suggestedPrompt ?? ''); setCopied(true); } catch { setError('复制失败，请手动选中修复指令复制'); } }} className="rounded-xl border border-[#dcdce3] px-3 py-2 text-xs">{copied ? '已复制' : '复制修复指令'}</button>
              <button type="button" onClick={() => onRepair(complianceType, platform, refs[0].src, complianceResult.suggestedPrompt ?? '')} className="rounded-xl bg-ink px-3 py-2 text-xs font-semibold text-white hover:bg-ink-soft">用此指令修复</button>
            </div>
          </div>}
        </section>
      )}
      {result && (
        <section className="cardmt-5 px-6 py-5">
          <header className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-[#0d0d0d]">生成结果</h2>
            <span className="text-[10px] text-[#b4b4bf]">{result.image.size} · {result.image.type}</span>
          </header>
          {result.appliedAspects && <div className="mb-3 flex flex-wrap gap-2">{result.appliedAspects.map((a) => <span key={a} className="rounded-full bg-mist px-3 py-1 text-xs text-ink-mid">{a === 'scene' ? '背景场景' : a === 'text' ? '文字语言' : '模特形象'}</span>)}</div>}
          {result.note && <p className="mb-3 rounded-lg bg-[#fffbeb] px-3 py-2 text-xs text-[#b45309]">{result.note}</p>}
          {result.prompt && <details className="mb-3 text-xs text-[#5d5d6b]"><summary className="cursor-pointer">本次本地化提示词</summary><p className="mt-2 break-words">{result.prompt}</p></details>}
          <div className="flex flex-wrap items-start gap-4">
            {hasCurrent && (
              <div>
                <p className="mb-1.5 text-[10px] font-bold tracking-[0.12em] text-[#b4b4bf]">当前图</p>
                <img
                  src={current!.url}
                  alt="当前图"
                  className="h-44 w-44 cursor-zoom-in rounded-xl border border-[#e9e9ee] object-cover"
                  title="双击放大预览"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPreview({ url: current!.url, type, platform, size: current!.size }); } }}
                  onDoubleClick={() => setPreview({ url: current!.url, type, platform, size: current!.size })}
                />
              </div>
            )}
            <div>
              <p className="mb-1.5 text-[10px] font-bold tracking-[0.12em] text-ink">新图 · {aspect}</p>
              <div className="overflow-hidden rounded-xl border border-ink" style={{ width: 176, aspectRatio: String(aspectDef.ratio) }}>
                <img
                  src={result.image.url}
                  alt="新图"
                  className="h-full w-full cursor-zoom-in object-cover"
                  title="双击放大预览"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPreview({ url: result.image.url, type, platform, size: result.image.size }); } }}
                  onDoubleClick={() => setPreview({ url: result.image.url, type, platform, size: result.image.size })}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2 self-stretch justify-center">
              {onApplied && (
                <button type="button" onClick={() => { onApplied(result.image, prompt.trim()); setResult((prev) => prev ? { ...prev, applied: true } : prev); }}
                  className="rounded-xl bg-ink px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-ink-soft">
                  {result.applied ? '已应用 ✓' : `应用回${platform}槽位`}
                </button>
              )}
              <a href={imageProxyUrl(result.image.url, true)} download="product-image.png" className="rounded-xl border border-[#dcdce3] bg-[#ffffff] px-5 py-2.5 text-center text-xs font-semibold text-[#5d5d6b] transition hover:border-ink hover:text-ink">下载原图</a>
              {aspect !== '1:1' && (
                <button type="button" onClick={downloadCropped} className="rounded-xl border border-[#dcdce3] bg-[#ffffff] px-5 py-2.5 text-xs font-semibold text-[#5d5d6b] transition hover:border-ink hover:text-ink">
                  下载{aspect}裁切图
                </button>
              )}
            </div>
          </div>
          {/* 生成即复检（五类图）：新图 URL 直传合规检测，无需下载重传；未通过可一键修复闭环 */}
          {imageMode && (
            <div className="mt-4 border-t border-[#e9e9ee] pt-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] font-bold tracking-[0.12em] text-[#8e8e9a]">合规复检 · {platform} · {marketForPlatform(platform, platformMarkets)} 市场</span>
                {!complianceChecking && (
                  <button type="button" onClick={() => result && checkCompliance(result.image.url)} disabled={busy}
                    className="rounded-md border border-[#dcdce3] bg-[#ffffff] px-2 py-0.5 text-[10px] font-semibold text-[#5d5d6b] transition hover:border-ink hover:text-ink disabled:opacity-50">
                    重新检测
                  </button>
                )}
              </div>
              {complianceChecking && <p className="text-xs text-[#5d5d6b]" role="status">合规 Agent：正在按 {platform} 平台规则检测新图…</p>}
              {!complianceChecking && complianceCheckError && (
                <p className="text-xs leading-relaxed text-[#dc2626]">自动复检失败：{complianceCheckError}。可点击「重新检测」重试，或到「合规检测」工作台人工复检。</p>
              )}
              {!complianceChecking && !resultCompliance && !complianceCheckError && (
                <button type="button" onClick={() => result && checkCompliance(result.image.url, lastAnchorRef.current)} disabled={busy}
                  className="rounded-xl border border-[#dcdce3] bg-[#ffffff] px-4 py-2 text-xs font-semibold text-[#5d5d6b] transition hover:border-ink hover:text-ink disabled:opacity-50">
                  检测此图合规性
                </button>
              )}
              {!complianceChecking && resultCompliance && (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${resultCompliance.passed ? 'bg-[#ecfdf5] text-[#059669]' : 'bg-[#fef2f2] text-[#dc2626]'}`}>
                      <span className={`h-2 w-2 rounded-full ${resultCompliance.passed ? 'bg-[#10b981]' : 'bg-[#dc2626]'}`} />
                      {resultCompliance.passed ? '通过' : '未通过'}
                    </span>
                    {resultCompliance.model && <span className="rounded-full bg-[#f0f0f3] px-2 py-0.5 text-[9px] font-bold text-[#5d5d6b]">{resultCompliance.model}</span>}
                  </div>
                  <p className="mt-2 break-words text-xs leading-relaxed text-[#5d5d6b]">{resultCompliance.summary}</p>
                  {resultCompliance.passed && resultCompliance.passReasons && resultCompliance.passReasons.length > 0 && (
                    <div className="mt-2 rounded-xl bg-[#ecfdf5] px-4 py-3">
                      <p className="text-[10px] font-bold tracking-[0.12em] text-[#059669]">通过依据</p>
                      <ul className="mt-1 space-y-0.5 text-xs leading-relaxed text-[#047857]">
                        {resultCompliance.passReasons.map((reason, index) => <li key={index}>· {reason}</li>)}
                      </ul>
                    </div>
                  )}
                  <ComplianceIssues issues={resultCompliance.complianceIssues ?? []} />
                  {!resultCompliance.passed && resultCompliance.suggestedPrompt && (
                    <div className="mt-3 rounded-lg bg-[#f7f7f8] p-2.5">
                      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[10px] font-bold tracking-[0.12em] text-[#8e8e9a]">修复指令 · 可直接执行</span>
                        <span className="flex shrink-0 gap-1.5">
                          <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(resultCompliance.suggestedPrompt ?? ''); setCopied(true); } catch { setError('复制失败，请手动选中修复指令复制'); } }}
                            className="rounded-md border border-[#dcdce3] bg-[#ffffff] px-2 py-0.5 text-[10px] font-semibold text-[#5d5d6b] transition hover:border-ink hover:text-ink">
                            {copied ? '已复制 ✓' : '复制修复指令'}
                          </button>
                          <button type="button" onClick={repairWithSuggestion} disabled={busy}
                            className="rounded-md bg-ink px-2 py-0.5 text-[10px] font-semibold text-white transition hover:bg-ink-soft disabled:opacity-50">
                            {busy ? '修复中…' : '一键修复此图'}
                          </button>
                        </span>
                      </div>
                      <p className="break-all font-mono text-[10px] leading-relaxed text-[#5d5d6b]">{resultCompliance.suggestedPrompt}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </section>
      )}
      {error && <div role="alert" className="mt-5 break-words rounded-xl border border-bad/30 bg-bad/5 px-4 py-3 text-xs text-bad">{error}</div>}

      {/* 底部操作条 */}
      <div className="cardsticky bottom-4 mt-5 flex flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xl text-xs leading-relaxed text-[#8e8e9a]">
          {isCompliance
            ? `合规检测：检查 ${complianceMarket} 市场与 ${platform} 平台的 ${complianceType}。`
            : isLocalize
            ? `本地化：以源图 + 改写要求调用图生图（${market} 市场审美），生成后可按 ${aspect} 画幅下载。`
            : mode === 'edit'
              ? `基于当前图修改：以当前成品为源图 + 描述改动，生成后可按 ${aspect} 画幅下载${onApplied ? '或应用回槽位' : ''}。`
              : refs.length > 0
                ? `参考图生成：以 ${refs.length} 张参考素材保持商品一致，生成后可按 ${aspect} 画幅下载${onApplied ? '或应用回槽位' : ''}。`
                : `文生图：按文字描述生成，生成后可按 ${aspect} 画幅下载${onApplied ? '或应用回槽位' : ''}。`}
        </p>
        <button type="button" onClick={() => generate()} disabled={!canGenerate}
          className="rounded-xl bg-ink px-7 py-3.5 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(13,13,13,.18)] transition hover:bg-ink-soft disabled:cursor-not-allowed disabled:bg-line-strong disabled:shadow-none">
          {busy ? (isCompliance ? '正在检测…' : '正在生成…') : isCompliance ? `开始合规检测（${complianceMarket} · ${complianceType}）` : isLocalize ? `开始本地化（${market}）` : mode === 'edit' ? '基于当前图重新生成' : '开始生成'}
        </button>
      </div>

      {preview && <ImageLightbox image={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}
