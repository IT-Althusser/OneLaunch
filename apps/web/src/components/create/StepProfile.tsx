import { useState } from 'react';
import { ArrowLeft, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { polishText } from '../../api/client';
import { PLATFORMS, type ImagePipelineInput, type ModelSelection, type PolishKind } from '../../types';

const TONES: ImagePipelineInput['detailTone'][] = ['专业可信', '种草转化', '简洁高端'];
const MARKETS = ['US', 'UK', '欧盟', '日本', '东南亚'];

/** 第 2 步 · 商品资料：名称关键词 + 卖点（AI 润色）+ 目标市场 / 发布平台 / 详情页语气（对应草图 #2） */
export function StepProfile({
  productName,
  sellingPoints,
  platforms,
  market,
  detailTone,
  models,
  onChange,
  onBack,
  onNext,
}: {
  productName: string;
  sellingPoints: string;
  platforms: string[];
  market: string;
  detailTone: NonNullable<ImagePipelineInput['detailTone']>;
  models: ModelSelection;
  onChange: (patch: { productName?: string; sellingPoints?: string; platforms?: string[]; market?: string; detailTone?: ImagePipelineInput['detailTone'] }) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [polishing, setPolishing] = useState(false);
  const [polishError, setPolishError] = useState('');

  async function polish() {
    const hasPoints = sellingPoints.trim() !== '';
    const text = (hasPoints ? sellingPoints : productName).trim();
    if (!text) { setPolishError('先填写卖点或商品名称，再一键润色'); return; }
    setPolishing(true);
    setPolishError('');
    try {
      const kind: PolishKind = hasPoints ? 'selling-points' : 'keywords';
      const { text: polished } = await polishText({ text, kind, model: models.textModel || undefined });
      if (hasPoints) onChange({ sellingPoints: polished });
      else onChange({ productName: polished });
    } catch (e) {
      setPolishError((e as Error).message);
    } finally {
      setPolishing(false);
    }
  }

  const togglePlatform = (p: string) =>
    onChange({ platforms: platforms.includes(p) ? platforms.filter((x) => x !== p) : [...platforms, p] });

  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="profile-name" className="mb-1.5 block text-xs font-semibold text-ink-mid">商品名词 + 关键词</label>
        <input
          id="profile-name"
          className="field"
          value={productName}
          onChange={(e) => onChange({ productName: e.target.value })}
          placeholder="例如：轻量通勤托特包；有参考图时可留空"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_270px]">
        {/* 商品买点和功能介绍 + AI 润色 */}
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <label htmlFor="profile-points" className="text-xs font-semibold text-ink-mid">商品买点和功能介绍</label>
            <button
              type="button"
              onClick={polish}
              disabled={polishing}
              className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-line-strong px-3 py-1 text-[11px] font-semibold text-ink-mid transition hover:border-ink hover:text-ink disabled:opacity-50"
            >
              {polishing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              AI 润色
            </button>
          </div>
          <textarea
            id="profile-points"
            className="field min-h-[224px] resize-y text-sm leading-relaxed"
            value={sellingPoints}
            onChange={(e) => onChange({ sellingPoints: e.target.value })}
            placeholder={'例如：防泼水、能装 15 寸电脑、380g 轻量。\n有参考图时可选，AI 会结合参考图自行提炼。'}
          />
          {polishError && <p className="mt-1.5 text-xs text-bad">{polishError}</p>}
        </div>

        {/* 右列：目标市场 / 发布到哪里 / 详情页语气 */}
        <div className="space-y-4">
          <div>
            <label htmlFor="profile-market" className="mb-1.5 block text-xs font-semibold text-ink-mid">目标市场</label>
            <select id="profile-market" className="field select-field !py-2.5 text-xs" value={market} onChange={(e) => onChange({ market: e.target.value })}>
              <option value="">自动跟随平台</option>
              {MARKETS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <div className="mb-1.5 text-xs font-semibold text-ink-mid">发布到哪里？<span className="ml-1 text-[10px] font-normal text-ink-faint">每平台各出完整五图</span></div>
            <div className="grid grid-cols-2 gap-2">
              {PLATFORMS.map((p) => {
                const on = platforms.includes(p);
                return (
                  <button key={p} type="button" onClick={() => togglePlatform(p)} aria-pressed={on}
                    className={`rounded-[10px] border px-3 py-2 text-left text-xs font-semibold transition ${on ? 'border-ink bg-mist text-ink' : 'border-line bg-white text-ink-mid hover:border-ink-faint'}`}>
                    <span className={`mr-2 inline-block h-1.5 w-1.5 rounded-full align-middle ${on ? 'bg-ink' : 'bg-line-strong'}`} />
                    {p}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div className="mb-1.5 text-xs font-semibold text-ink-mid">详情页语气风格</div>
            <div className="grid gap-2">
              {TONES.map((tone) => (
                <button key={tone} type="button" onClick={() => onChange({ detailTone: tone })} aria-pressed={detailTone === tone}
                  className={`rounded-[10px] border px-3 py-2 text-left text-xs font-semibold transition ${detailTone === tone ? 'border-ink bg-mist text-ink' : 'border-line bg-white text-ink-mid hover:border-ink-faint'}`}>
                  {tone}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack} className="btn-ghost px-5 py-2.5 text-sm">
          <ArrowLeft className="h-4 w-4" />
          上一步
        </button>
        <button type="button" onClick={onNext} className="btn-primary px-6 py-2.5 text-sm">
          下一步
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
