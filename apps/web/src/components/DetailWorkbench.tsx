import { useState } from 'react';
import { generateDetailPages } from '../api/client';
import { DetailPages } from './DetailPages';
import { ImageLightbox } from './ImageLightbox';
import { PLATFORMS, type DetailPage, type GeneratedImage, type ModelSelection } from '../types';

const TONES = ['专业可信', '种草转化', '简洁高端'] as const;
type Tone = (typeof TONES)[number];

/**
 * AI 详情页工作台（整页）：输入商品名称与卖点，选目标平台与语气，AI 自动组合已生成配图与文案，
 * 输出符合各平台规范的完整详情页。独立调用 POST /api/detail-page，不依赖五图流水线；
 * 传入 images（生成工作台已完成槽位图）时 AI 按模块引用配图，无图时输出纯文案模块结构。
 */
export function DetailWorkbench({
  images,
  models,
  initialName,
  initialPoints,
  initialPlatforms,
  initialTone,
  onBack,
  backLabel,
}: {
  images: GeneratedImage[];
  models: ModelSelection;
  initialName: string;
  initialPoints: string;
  initialPlatforms: string[];
  initialTone: Tone;
  onBack: () => void;
  backLabel: string;
}) {
  const [productName, setProductName] = useState(initialName);
  const [sellingPoints, setSellingPoints] = useState(initialPoints);
  const [platforms, setPlatforms] = useState<string[]>(initialPlatforms.length > 0 ? initialPlatforms : ['Amazon']);
  const [tone, setTone] = useState<Tone>(initialTone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pages, setPages] = useState<DetailPage[] | null>(null);
  const [copied, setCopied] = useState(false);
  const [preview, setPreview] = useState<{ url: string; type: string; platform: string; size: string } | null>(null);

  const ready = (productName.trim() !== '' || sellingPoints.trim() !== '') && platforms.length > 0;

  const togglePlatform = (p: string) => setPlatforms((list) => list.includes(p) ? list.filter((x) => x !== p) : [...list, p]);

  async function generate() {
    if (!ready) { setError('请填写商品名称或卖点，并至少选择一个目标平台'); return; }
    setBusy(true);
    setError('');
    setPages(null);
    try {
      const result = await generateDetailPages({
        productName: productName.trim(),
        sellingPoints: sellingPoints.trim(),
        platforms,
        detailTone: tone,
        generatedTypes: [...new Set(images.map((im) => im.type))],
        textModel: models.textModel,
      });
      setPages(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function copyAll() {
    if (!pages) return;
    const text = pages.map((p) => {
      const lines = [
        `【${p.platform}】${p.title}`,
        p.subtitle,
        p.sellingPoints.length > 0 ? `卖点：${p.sellingPoints.join('；')}` : '',
        ...p.sections.map((s) => `■ ${s.title}\n${s.body}${s.bullets && s.bullets.length > 0 ? `\n- ${s.bullets.join('\n- ')}` : ''}`),
        p.compliance.length > 0 ? `合规提示：${p.compliance.join('；')}` : '',
      ];
      return lines.filter(Boolean).join('\n');
    }).join('\n\n———\n\n');
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="mx-auto max-w-[1200px]">
      {/* 页头 */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="eyebrow mb-1.5">Detail workbench · AI automation</div>
          <h1 className="text-[26px] font-semibold tracking-[-0.04em] text-[#17202b]">AI 详情页 · 图文自动编排</h1>
          <p className="mt-1 text-sm text-[#8d867c]">输入商品卖点，AI 按平台规范自动组合配图与文案，输出完整详情页。</p>
        </div>
        <button type="button" onClick={onBack} className="rounded-xl border border-[#d9d3c9] bg-[#fffdf9] px-4 py-2.5 text-xs font-semibold text-[#5e584f] transition hover:border-[#ef6a4c] hover:text-[#c84f36]">← {backLabel}</button>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
        {/* 01 · 商品资料 */}
        <section className="panel px-5 py-5">
          <header className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-[#17202b]"><span className="mr-1.5 text-[#ef6a4c]">01</span>商品资料</h2>
            <span className="text-[10px] font-bold tracking-[0.14em] text-[#a49d92]">名称 / 卖点二选一</span>
          </header>
          <div className="space-y-4">
            <div>
              <label htmlFor="detail-product-name" className="mb-1.5 block text-xs font-semibold text-[#514b43]">商品关键词 / 名称</label>
              <input id="detail-product-name" className="field" value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="例如：轻量通勤托特包" disabled={busy} />
            </div>
            <div>
              <label htmlFor="detail-selling-points" className="mb-1.5 block text-xs font-semibold text-[#514b43]">商品卖点</label>
              <textarea id="detail-selling-points" className="field min-h-[110px] resize-y text-xs" value={sellingPoints} onChange={(e) => setSellingPoints(e.target.value)} placeholder="例如：防泼水、能装 15 寸电脑、380g 轻量。AI 会把卖点转译为购买理由。" disabled={busy} />
            </div>
          </div>
        </section>

        {/* 02 · 平台规范与文案语气 */}
        <section className="panel px-6 py-5">
          <header className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-[#17202b]"><span className="mr-1.5 text-[#ef6a4c]">02</span>平台规范与文案语气</h2>
            <span className="text-[10px] text-[#a49d92]">每个平台各输出一版详情页</span>
          </header>
          <div className="mb-2 text-xs font-semibold text-[#514b43]">目标平台</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PLATFORMS.map((p) => {
              const on = platforms.includes(p);
              return (
                <button key={p} type="button" onClick={() => togglePlatform(p)} aria-pressed={on} disabled={busy}
                  className={`rounded-xl border px-3 py-2.5 text-left transition ${on ? 'border-[#ef6a4c] bg-[#fff1ed] text-[#b84934]' : 'border-[#e2ddd5] bg-[#fffdf9] text-[#6f685e] hover:border-[#bbb2a6]'}`}>
                  <span className={`mr-2 inline-block h-2 w-2 rounded-full align-middle ${on ? 'bg-[#ef6a4c]' : 'bg-[#d9d3c9]'}`} />
                  <span className="text-xs font-semibold">{p}</span>
                </button>
              );
            })}
          </div>
          <div className="mb-2 mt-4 text-xs font-semibold text-[#514b43]">文案语气</div>
          <div className="grid gap-2 sm:grid-cols-3">
            {TONES.map((t) => (
              <button key={t} type="button" onClick={() => setTone(t)} aria-pressed={tone === t} disabled={busy}
                className={`rounded-xl border px-3 py-2 text-left transition ${tone === t ? 'border-[#ef6a4c] bg-[#fff1ed] text-[#b84934]' : 'border-[#e2ddd5] bg-[#fffdf9] text-[#6f685e] hover:border-[#bbb2a6]'}`}>
                <span className="block text-xs font-semibold">{t}</span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-[#8d867c]">
            平台规范由 AI 内置：Amazon 模块化图文（A+）、TikTok Shop 竖版种草、Temu 卖点直给、Shopee 移动端简洁分块。
          </p>
        </section>
      </div>

      {/* 03 · 配图引用（通栏） */}
      <section className="panel mt-5 px-6 py-5">
        <header className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-[#17202b]"><span className="mr-1.5 text-[#ef6a4c]">03</span>配图引用</h2>
          <span className="text-[10px] text-[#a49d92]">{images.length > 0 ? `自动引用 ${images.length} 张已生成图` : '当前无已生成图'}</span>
        </header>
        {images.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {images.map((im) => (
              <div
                key={`${im.platform}-${im.type}`}
                className="relative h-16 w-16 cursor-zoom-in overflow-hidden rounded-lg border border-[#e2ddd5]"
                title="双击放大预览"
                onDoubleClick={() => setPreview({ url: im.url, type: im.type, platform: im.platform, size: im.size })}
              >
                <img src={im.url} alt={im.type} className="h-full w-full object-cover" loading="lazy" />
                <span className="absolute bottom-0 left-0 right-0 truncate bg-black/55 px-1 py-0.5 text-center text-[8px] font-bold text-white">{im.type}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-lg bg-[#fdf8ef] px-3 py-2 text-[11px] leading-relaxed text-[#9a8a68]">
            当前没有已生成的图片可引用，本次将输出纯文案模块结构（模块仍会标注建议配图类型）；先在创作工作台跑一次五图，再回到本页即可自动引用配图。
          </p>
        )}
      </section>

      {/* 结果（骨架 → 详情页） */}
      {busy && (
        <section className="panel mt-5 px-6 py-5" aria-hidden>
          <div className="space-y-2">
            <div className="h-5 w-1/3 animate-pulse rounded-lg bg-[#eee9e1]" />
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-[#f4f1eb]" style={{ animationDelay: `${i * 0.12}s` }} />)}
          </div>
        </section>
      )}
      {pages && pages.length > 0 && (
        <div className="mt-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-[0.12em] text-[#8b8479]">生成结果 · {pages.length} 个平台版</span>
            <button type="button" onClick={copyAll}
              className="rounded-xl border border-[#d9d3c9] bg-[#fffdf9] px-4 py-2 text-xs font-semibold text-[#5e584f] transition hover:border-[#ef6a4c] hover:text-[#c84f36]">
              {copied ? '已复制 ✓' : '复制全部文案'}
            </button>
          </div>
          <DetailPages pages={pages} images={images} />
        </div>
      )}
      {error && <div className="mt-5 rounded-xl border border-[#f0b7a8] bg-[#fff1ed] px-4 py-3 text-xs text-[#a44836]">{error}</div>}

      {/* 底部操作条 */}
      <div className="panel sticky bottom-4 mt-5 flex flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xl text-xs leading-relaxed text-[#8d867c]">
          调用计划：画像 + 编排共约 {platforms.length + 1} 次文本调用（{models.textModel || '默认 qwen3.7-max'}）· 每平台 6-8 个模块，模块自动引用最合适的已生成图，AI 编排失败自动降级模板。
        </p>
        <button type="button" onClick={generate} disabled={busy || !ready}
          className="shrink-0 rounded-xl bg-[#ef6a4c] px-7 py-3.5 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(239,106,76,.22)] transition hover:bg-[#d95d41] disabled:cursor-not-allowed disabled:bg-[#c9c1b7] disabled:shadow-none">
          {busy ? 'AI 编排中，约 10–30 秒…' : `生成详情页（${platforms.length} 个平台）→`}
        </button>
      </div>

      {preview && <ImageLightbox image={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}
