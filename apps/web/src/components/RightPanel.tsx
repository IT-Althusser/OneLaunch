import type { ModelCatalog, ModelOption, ModelSelection } from '../types';

function Select({
  id,
  label,
  hint,
  options,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  options: ModelOption[];
  value: string;
  onChange: (id: string) => void;
}) {
  // 已验证模型排前面，当前值不在清单（清单加载失败降级）时保留现值
  const sorted = [...options].sort((a, b) => Number(b.verified) - Number(a.verified));
  const known = sorted.some((o) => o.id === value);
  return (
    <div>
      <div className="mb-1.5 flex items-baseline gap-2">
        <label htmlFor={id} className="min-w-0 flex-1 truncate text-xs font-semibold text-[#514b43]">{label}</label>
        <span className="shrink-0 text-[10px] text-[#a49d92]">{hint}</span>
      </div>
      <select
        id={id}
        className="field select-field !py-2.5 text-xs font-medium"
        value={known ? value : ''}
        onChange={(e) => onChange(e.target.value)}
      >
        {!known && <option value="">当前模型 {value}（网关清单不可用）</option>}
        {sorted.map((o) => (
          <option key={o.id} value={o.id}>{o.id}{o.verified ? ' · 已验证' : ''}</option>
        ))}
      </select>
    </div>
  );
}

/**
 * 03 · 模型与调用：右栏可选的生成模型调用面板（不再放功能讲解）。
 * 分组对应技术栈：通义万相（图片生成）· Qwen-Image（图生图/参考图）· Qwen 系列（文案）·
 * 视觉模型（白底图质检：内容理解与合规检测；网关无可用视觉模型时降级人工复检）。
 */
export function RightPanel({
  catalog,
  selection,
  onChange,
}: {
  catalog: ModelCatalog | null;
  selection: ModelSelection;
  onChange: (next: ModelSelection) => void;
}) {
  return (
    <aside className="hidden w-[300px] shrink-0 overflow-y-auto border-l border-[#e2ddd5] bg-[#f8f5ef] px-5 py-7 xl:block">
      <div className="sticky top-0">
        <header className="mb-5">
          <h2 className="text-xl font-semibold tracking-[-0.03em] text-[#17202b]"><span className="mr-1.5 text-[#ef6a4c]">03</span>模型与调用</h2>
          <p className="mt-1 text-xs text-[#8d867c]">{catalog ? `网关在线 · ${catalog.textToImage.length + catalog.imageToImage.length} 个图片模型可用` : '正在读取网关模型清单…'}</p>
        </header>

        {catalog ? (
          <div className="space-y-5">
            <Select
              id="model-image"
              label="图片生成 · 通义万相"
              hint="文生图"
              options={catalog.textToImage}
              value={selection.imageModel}
              onChange={(id) => onChange({ ...selection, imageModel: id })}
            />
            <Select
              id="model-edit"
              label="参考图 / 编辑 · Qwen-Image"
              hint="图生图"
              options={catalog.imageToImage}
              value={selection.editModel}
              onChange={(id) => onChange({ ...selection, editModel: id })}
            />
            <Select
              id="model-text"
              label="文案生成 · Qwen 系列"
              hint="画像 / 提示词"
              options={catalog.text}
              value={selection.textModel}
              onChange={(id) => onChange({ ...selection, textModel: id })}
            />

            {catalog.visionAvailable && catalog.vision.length > 0 ? (
              <div className="space-y-2">
                <Select
                  id="model-vision"
                  label="白底图质检 · 视觉模型"
                  hint="内容理解与合规"
                  options={catalog.vision}
                  value={selection.visionModel}
                  onChange={(id) => onChange({ ...selection, visionModel: id })}
                />
                <p className="text-[11px] leading-relaxed text-[#9a9389]">
                  白底图生成后自动视觉质检：白底纯净度、商品完整性、水印与违规元素检测，未通过项列明细。
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-[#eee4d2] bg-[#fdf8ef] px-3.5 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#7a6a4f]">视觉模型 · 内容理解与合规检测</span>
                  <span className="rounded-full bg-[#f3e8d2] px-2 py-0.5 text-[9px] font-bold text-[#9a7b3f]">不可用</span>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-[#9a8a68]">网关清单暂无可用视觉模型，白底图质检降级为人工复检提醒。</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3" aria-hidden>
            {[0, 1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-[#eee9e1]" />)}
          </div>
        )}

        <div className="mt-6 h-px bg-[#e2ddd5]" />
        <p className="mt-4 text-[11px] leading-relaxed text-[#9a9389]">
          有参考图自动走图生图模型；无参考图走文生图模型。单图重新生成沿用当前选择。
        </p>
      </div>
    </aside>
  );
}
