import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { StepReference } from './StepReference';
import { StepProfile } from './StepProfile';
import { StepModel } from './StepModel';
import type { ImagePipelineInput, ModelCatalog, ModelSelection, ReferenceImage } from '../../types';

const STEP_TITLES = ['商品参考图', '商品资料', '模型调用'] as const;

const SAMPLE = { productName: '轻量通勤托特包', sellingPoints: '防泼水面料、可装 15 寸笔记本、自重仅 380g、大容量多隔层。演示设定：包体宽 38 cm、高 30 cm、厚 12 cm（非实测）', platforms: ['Amazon', 'TikTok Shop'] };

/**
 * 创作三步向导（对应草图 #1→#2→#3）：商品参考图 → 商品资料（AI 润色）→ 模型调用（生成go!）。
 * 全程保持挂载（外壳仅隐藏），填到一半切去生成页再回来不丢内容。
 */
export function CreateFlow({
  catalog,
  selection,
  catalogError,
  onSelectionChange,
  onSubmit,
  onStepChange,
}: {
  catalog: ModelCatalog | null;
  selection: ModelSelection;
  catalogError: string;
  onSelectionChange: (next: ModelSelection) => void;
  onSubmit: (input: ImagePipelineInput) => void;
  onStepChange?: (step: number) => void;
}) {
  const [step, setStep] = useState(1);
  const [refs, setRefs] = useState<ReferenceImage[]>([]);
  const [productName, setProductName] = useState('');
  const [sellingPoints, setSellingPoints] = useState('');
  const [platforms, setPlatforms] = useState<string[]>(['Amazon']);
  const [market, setMarket] = useState(''); // 空 = 自动跟随平台（后端按 marketForPlatform 映射）
  const [detailTone, setDetailTone] = useState<NonNullable<ImagePipelineInput['detailTone']>>('专业可信');

  const go = (next: number) => { setStep(next); onStepChange?.(next); };

  const patch = (p: { productName?: string; sellingPoints?: string; platforms?: string[]; market?: string; detailTone?: ImagePipelineInput['detailTone'] }) => {
    if (p.productName !== undefined) setProductName(p.productName);
    if (p.sellingPoints !== undefined) setSellingPoints(p.sellingPoints);
    if (p.platforms !== undefined) setPlatforms(p.platforms);
    if (p.market !== undefined) setMarket(p.market);
    if (p.detailTone !== undefined) setDetailTone(p.detailTone);
  };

  const fillSample = () => {
    patch({ productName: SAMPLE.productName, sellingPoints: SAMPLE.sellingPoints, platforms: SAMPLE.platforms, detailTone: '专业可信' });
  };

  function submit() {
    onSubmit({
      productName: productName.trim(),
      sellingPoints: sellingPoints.trim(),
      platforms,
      detailTone,
      referenceImages: refs.map((r) => r.src),
      imageModel: selection.imageModel,
      editModel: selection.editModel,
      editGateway: selection.editGateway,
      textModel: selection.textModel,
      visionModel: selection.visionModel,
      market,
    });
  }

  return (
    <div className="mx-auto max-w-[1080px]">
      {/* 步骤指示 */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {STEP_TITLES.map((title, i) => {
          const n = i + 1;
          const active = step === n;
          const done = step > n;
          return (
            <button
              key={title}
              type="button"
              onClick={() => { if (done) go(n); }}
              disabled={!active && !done}
              className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold transition ${active ? 'bg-ink text-white' : done ? 'border border-line bg-white text-ink-mid hover:border-ink-faint hover:text-ink' : 'text-ink-faint'}`}
            >
              <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${active ? 'bg-white/20' : done ? 'bg-mist text-ink' : 'bg-mist text-ink-faint'}`}>{n}</span>
              {title}
            </button>
          );
        })}
        {step === 2 && (
          <button type="button" onClick={fillSample} className="ml-auto rounded-full border border-dashed border-line-strong px-3.5 py-2 text-xs font-semibold text-ink-mid transition hover:border-ink hover:text-ink">
            填入示例
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="card px-6 py-6 sm:px-8"
        >
          {step === 1 && (
            <StepReference
              refs={refs}
              onAddRefs={(items) => setRefs((prev) => [...prev, ...items])}
              onRemoveRef={(id) => setRefs((prev) => prev.filter((r) => r.id !== id))}
              onNext={() => go(2)}
            />
          )}
          {step === 2 && (
            <StepProfile
              productName={productName}
              sellingPoints={sellingPoints}
              platforms={platforms}
              market={market}
              detailTone={detailTone}
              models={selection}
              onChange={patch}
              onBack={() => go(1)}
              onNext={() => go(3)}
            />
          )}
          {step === 3 && (
            <StepModel
              catalog={catalog}
              selection={selection}
              catalogError={catalogError}
              platforms={platforms}
              hasRefs={refs.length > 0}
              productName={productName}
              qaScope={catalog?.qaScope}
              onSelectionChange={onSelectionChange}
              onBack={() => go(2)}
              onSubmit={submit}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
