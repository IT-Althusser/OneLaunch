import { ReferenceUploader } from '../common/ReferenceUploader';
import { ArrowRight, ImagePlus } from 'lucide-react';
import type { ReferenceImage } from '../../types';

/** 第 1 步 · 商品参考图：大虚线拖放区 + 粘贴公网链接（对应草图 #1） */
export function StepReference({
  refs,
  onAddRefs,
  onRemoveRef,
  onNext,
}: {
  refs: ReferenceImage[];
  onAddRefs: (items: ReferenceImage[]) => void;
  onRemoveRef: (id: string) => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-dashed border-line-strong bg-white p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
          <ImagePlus className="h-4 w-4 text-ink-mute" />
          添加商品参考图
          <span className="ml-1 text-[11px] font-normal text-ink-faint">有参考图时五图走图生图，商品外观保持一致</span>
        </div>
        <ReferenceUploader images={refs} onAdd={onAddRefs} onRemove={onRemoveRef} />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-ink-faint">没有参考图也可以：只填商品资料即可文生图。</p>
        <button type="button" onClick={onNext} className="btn-primary px-6 py-2.5 text-sm">
          下一步
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
