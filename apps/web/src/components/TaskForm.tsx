/**
 * 创作面板 — 编号分区表单
 * 01 · PRODUCT INFO：商品名称、卖点、参考图
 * 02 · PLATFORM：目标平台多选
 * 底部：生成按钮
 */
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { PLATFORMS, type ImagePipelineInput } from '../types';

const SAMPLE = {
  productName: '轻量通勤托特包',
  sellingPoints: '防泼水面料、可装 15 寸笔记本、自重仅 380g、大容量多隔层',
  platforms: ['Amazon', 'TikTok Shop'],
};

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20';
const labelCls = 'mb-1.5 block text-xs font-medium text-slate-500';

export function TaskForm({
  loading,
  error,
  onSubmit,
}: {
  loading: boolean;
  error: string;
  onSubmit: (input: ImagePipelineInput) => void;
}) {
  const [productName, setProductName] = useState('');
  const [sellingPoints, setSellingPoints] = useState('');
  const [referenceImageUrl, setReferenceImageUrl] = useState('');
  const [platforms, setPlatforms] = useState<string[]>(['Amazon']);

  function togglePlatform(p: string) {
    setPlatforms((list) =>
      list.includes(p) ? list.filter((x) => x !== p) : [...list, p],
    );
  }

  function fillSample() {
    setProductName(SAMPLE.productName);
    setSellingPoints(SAMPLE.sellingPoints);
    setPlatforms(SAMPLE.platforms);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!productName.trim() || !sellingPoints.trim() || platforms.length === 0)
      return;
    onSubmit({
      productName: productName.trim(),
      sellingPoints: sellingPoints.trim(),
      platforms,
      referenceImageUrl: referenceImageUrl.trim() || undefined,
    });
  }

  const ready =
    productName.trim() !== '' &&
    sellingPoints.trim() !== '' &&
    platforms.length > 0;

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-5">
      {/* 错误提示 */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* 01 · 商品信息 */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold tracking-[.14em] text-emerald-600">
              01 · PRODUCT INFO
            </div>
            <h2 className="mt-0.5 text-sm font-bold text-slate-800">商品信息</h2>
          </div>
          <button
            type="button"
            onClick={fillSample}
            className="text-[11px] font-medium text-emerald-600 hover:text-emerald-700 hover:underline"
          >
            填入示例
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className={labelCls}>
              商品名称 <span className="text-emerald-500">*</span>
            </label>
            <input
              className={inputCls}
              value={productName}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setProductName(e.target.value)
              }
              placeholder="例如：轻量通勤托特包"
            />
          </div>

          <div>
            <label className={labelCls}>
              核心卖点 <span className="text-emerald-500">*</span>
            </label>
            <textarea
              className={`${inputCls} h-20 resize-none`}
              value={sellingPoints}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                setSellingPoints(e.target.value)
              }
              placeholder="例如：防泼水面料、可装 15 寸笔记本、自重仅 380g"
            />
          </div>

          <div>
            <label className={labelCls}>参考图 URL（选填，用于商品图理解）</label>
            <input
              className={inputCls}
              value={referenceImageUrl}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setReferenceImageUrl(e.target.value)
              }
              placeholder="https://…"
            />
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
              视觉模型将解析参考图构建结构化商品画像；无参考图时降级为纯文本画像，流程不中断。
            </p>
          </div>
        </div>
      </section>

      {/* 02 · 目标平台 */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <div className="text-[10px] font-bold tracking-[.14em] text-emerald-600">
            02 · PLATFORM
          </div>
          <h2 className="mt-0.5 text-sm font-bold text-slate-800">目标平台</h2>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {PLATFORMS.map((p) => {
            const on = platforms.includes(p);
            return (
              <button
                key={p}
                type="button"
                onClick={() => togglePlatform(p)}
                className={`rounded-lg border px-3 py-2.5 text-xs font-semibold transition-all ${
                  on
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-emerald-400'
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>
        <p className="mt-2.5 text-[11px] leading-relaxed text-slate-400">
          首个平台生成全部五图（白底 / 场景 / 模特 / 对比 / 尺寸），其余平台生成白底主图适配版；白底图强制质检。
        </p>
      </section>

      {/* 底部操作区 */}
      <div className="flex items-center justify-between border-t border-slate-200 pt-4">
        <p className="text-[11px] text-slate-400">
          每次提交生成一组套图，费用由阿里云百炼平台结算。
        </p>
        <button
          type="submit"
          disabled={loading || !ready}
          className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {loading ? '生成中…' : '生成五图套图 →'}
        </button>
      </div>
    </form>
  );
}
