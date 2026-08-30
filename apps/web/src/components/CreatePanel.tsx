import { useState, type ChangeEvent, type FormEvent } from 'react';
import { ReferenceUploader } from './ReferenceUploader';
import { PLATFORMS, type ImagePipelineInput, type ModelSelection, type ReferenceImage } from '../types';

const SAMPLE = { productName: '轻量通勤托特包', sellingPoints: '防泼水面料、可装 15 寸笔记本、自重仅 380g、大容量多隔层', platforms: ['Amazon', 'TikTok Shop'] };

export function CreatePanel({
  refs,
  onAddRefs,
  onRemoveRef,
  models,
  loading,
  error,
  onSubmit,
}: {
  refs: ReferenceImage[];
  onAddRefs: (items: ReferenceImage[]) => void;
  onRemoveRef: (id: string) => void;
  models: ModelSelection;
  loading: boolean;
  error: string;
  onSubmit: (input: ImagePipelineInput) => void;
}) {
  const [productName, setProductName] = useState('');
  const [sellingPoints, setSellingPoints] = useState('');
  const [platforms, setPlatforms] = useState<string[]>(['Amazon']);
  const [detailTone, setDetailTone] = useState<ImagePipelineInput['detailTone']>('专业可信');
  const [localError, setLocalError] = useState('');

  const hasRefs = refs.length > 0;
  const ready = (productName.trim() !== '' || hasRefs) && platforms.length > 0;

  const togglePlatform = (p: string) => setPlatforms((list) => list.includes(p) ? list.filter((x) => x !== p) : [...list, p]);
  const fillSample = () => { setProductName(SAMPLE.productName); setSellingPoints(SAMPLE.sellingPoints); setPlatforms(SAMPLE.platforms); };

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!productName.trim() && !hasRefs) { setLocalError('请填写商品名称，或至少添加一张商品参考图'); return; }
    if (platforms.length === 0) { setLocalError('请至少选择一个发布平台'); return; }
    setLocalError('');
    onSubmit({
      productName: productName.trim(),
      sellingPoints: sellingPoints.trim(),
      platforms,
      detailTone,
      referenceImages: refs.map((r) => r.src),
      imageModel: models.imageModel,
      editModel: models.editModel,
      textModel: models.textModel,
      visionModel: models.visionModel,
    });
  }

  const shownError = localError || error;

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-[1080px] space-y-5">
      {shownError && <div className="rounded-xl border border-[#f0b7a8] bg-[#fff1ed] px-4 py-3 text-sm text-[#a44836]">{shownError}</div>}

      <div className="grid items-stretch gap-5 lg:grid-cols-[340px_1fr]">
        {/* 01 · 商品参考图 */}
        <section className="panel flex flex-col px-6 py-6">
          <header className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-[-0.03em] text-[#17202b]"><span className="mr-1.5 text-[#ef6a4c]">01</span>商品参考图</h2>
            <span className="text-[10px] font-bold tracking-[0.14em] text-[#a49d92]">{hasRefs ? `已添加 ${refs.length}` : '可选'}</span>
          </header>
          <ReferenceUploader images={refs} onAdd={onAddRefs} onRemove={onRemoveRef} />
        </section>

        {/* 02 · 商品资料 */}
        <section className="panel px-6 py-6">
          <header className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-[-0.03em] text-[#17202b]"><span className="mr-1.5 text-[#ef6a4c]">02</span>商品资料</h2>
            <button type="button" onClick={fillSample} className="rounded-full border border-[#d9d3c9] px-3 py-1.5 text-[11px] font-semibold text-[#5e584f] transition hover:border-[#ef6a4c] hover:text-[#c84f36]">填入示例</button>
          </header>
          <div className="space-y-4">
            <div>
              <label htmlFor="product-name" className="mb-1.5 block text-xs font-semibold text-[#514b43]">商品关键词 / 名称 {hasRefs ? '' : <span className="text-[#ef6a4c]">*</span>}</label>
              <input id="product-name" className="field" value={productName} onChange={(e: ChangeEvent<HTMLInputElement>) => setProductName(e.target.value)} placeholder="例如：轻量通勤托特包；有参考图时可留空" />
            </div>
            <div>
              <label htmlFor="selling-points" className="mb-1.5 block text-xs font-semibold text-[#514b43]">商品卖点 {hasRefs ? '' : <span className="text-[#ef6a4c]">*</span>}</label>
              <textarea id="selling-points" className="field min-h-[92px] resize-y" value={sellingPoints} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setSellingPoints(e.target.value)} placeholder="例如：防泼水、能装 15 寸电脑、380g 轻量。有参考图时可选，AI 会结合参考图自行提炼。" />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-[#514b43]">发布到哪里？<span className="text-[#ef6a4c]">*</span></span>
                <span className="text-[11px] text-[#a49d92]">每个平台均生成完整五图，按平台规范差异化出图</span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {PLATFORMS.map((p) => {
                  const on = platforms.includes(p);
                  return (
                    <button key={p} type="button" onClick={() => togglePlatform(p)} aria-pressed={on}
                      className={`rounded-xl border px-3 py-2.5 text-left transition ${on ? 'border-[#ef6a4c] bg-[#fff1ed] text-[#b84934]' : 'border-[#e2ddd5] bg-[#fffdf9] text-[#6f685e] hover:border-[#bbb2a6]'}`}>
                      <span className={`mr-2 inline-block h-2 w-2 rounded-full align-middle ${on ? 'bg-[#ef6a4c]' : 'bg-[#d9d3c9]'}`} />
                      <span className="text-xs font-semibold">{p}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="mb-2 text-xs font-semibold text-[#514b43]">详情页语气</div>
              <div className="grid gap-2 sm:grid-cols-3">
                {(['专业可信', '种草转化', '简洁高端'] as const).map((tone) => (
                  <button key={tone} type="button" onClick={() => setDetailTone(tone)} aria-pressed={detailTone === tone}
                    className={`rounded-xl border px-3 py-2 text-left transition ${detailTone === tone ? 'border-[#ef6a4c] bg-[#fff1ed] text-[#b84934]' : 'border-[#e2ddd5] bg-[#fffdf9] text-[#6f685e] hover:border-[#bbb2a6]'}`}>
                    <span className="block text-xs font-semibold">{tone}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* 提交条 */}
      <div className="panel flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-lg text-xs leading-relaxed text-[#8d867c]">
          调用计划：文本 1 次（{models.textModel || '默认 qwen3.7-max'}）· 图片 {platforms.length * 5} 次{hasRefs ? '图生图' : '文生图'}（每平台五图，{hasRefs ? models.editModel || '默认 qwen-image-2.0' : models.imageModel || '默认 wan2.7-image-pro'}）· 视觉质检 {platforms.length} 次（{models.visionModel || '默认 qwen3.6-plus'}）· 过程实时可见，单图可重新生成
        </p>
        <button type="submit" disabled={loading || !ready}
          className="rounded-xl bg-[#ef6a4c] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(239,106,76,.22)] transition hover:bg-[#d95d41] disabled:cursor-not-allowed disabled:bg-[#c9c1b7] disabled:shadow-none">
          {loading ? '正在启动任务…' : '开始生成五图  →'}
        </button>
      </div>
    </form>
  );
}
