import { useState } from 'react';
import { FileText, Languages, ShieldCheck, Sparkles } from 'lucide-react';
import { ImageLightbox } from '../common/ImageLightbox';
import { TYPE_DOT } from '../../lib/format';
import type { SlotBrief } from '../../types';

const HUB_TOOLS = [
  { type: '本地化', title: '图片本地化', desc: '背景场景 / 文字语言 / 模特形象，按目标市场改写已有图片', icon: Languages },
  { type: '合规检测', title: '合规检测', desc: '按平台规范与目标市场广告法核查图片风险，给出修复指令', icon: ShieldCheck },
  { type: '详情页', title: 'AI 详情页', desc: '按平台规范自动组合已生成配图与文案，输出完整详情页', icon: FileText },
] as const;

/** 工作台 hub：旧三工具入口 + 已生成图片库（对应侧边栏「工作台」） */
export function Workbench({
  slotIndex,
  onOpenTool,
  onOpenSlot,
}: {
  slotIndex: Record<string, SlotBrief>;
  onOpenTool: (tool: string) => void;
  onOpenSlot: (slotKey: string, type: string, platform: string) => void;
}) {
  const [preview, setPreview] = useState<{ url: string; type: string; platform: string; size: string } | null>(null);
  const images = Object.values(slotIndex);

  return (
    <div className="mx-auto max-w-[1080px] space-y-8">
      <section>
        <h2 className="mb-1 text-lg font-bold tracking-[-0.02em] text-ink">工具</h2>
        <p className="mb-4 text-xs text-ink-mute">五图流程之外的独立工具；运行中的任务切走后仍在后台继续。</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {HUB_TOOLS.map(({ type, title, desc, icon: Icon }) => (
            <button key={type} type="button" onClick={() => onOpenTool(type)}
              className="card group flex flex-col items-start px-5 py-5 text-left transition hover:border-ink-faint">
              <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-mist text-ink transition group-hover:bg-ink group-hover:text-white">
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-sm font-bold text-ink">{title}</span>
              <span className="mt-1 text-xs leading-relaxed text-ink-mute">{desc}</span>
              <span className="mt-3 text-[11px] font-semibold text-ink-faint transition group-hover:text-ink">打开 →</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-1 flex items-baseline justify-between">
          <h2 className="text-lg font-bold tracking-[-0.02em] text-ink">已生成图片</h2>
          <span className="text-xs text-ink-faint">{images.length > 0 ? `${images.length} 张 · 点击图放大，可带入对应工具细改` : ''}</span>
        </div>
        <p className="mb-4 text-xs text-ink-mute">最近一次五图任务的全部成品。</p>
        {images.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
            {images.map((slot) => (
              <div key={slot.key} className="group relative overflow-hidden rounded-xl border border-line bg-mist">
                <img
                  src={slot.url}
                  alt={`${slot.type} · ${slot.platform}`}
                  className="aspect-square w-full cursor-zoom-in object-cover"
                  onClick={() => setPreview({ url: slot.url, type: slot.type, platform: slot.platform, size: slot.size })}
                />
                <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-4">
                  <span className="flex items-center gap-1.5 text-[10px] font-semibold text-white">
                    <span className={`h-1.5 w-1.5 rounded-full ${TYPE_DOT[slot.type] ?? 'bg-white/60'}`} />
                    {slot.type} · {slot.platform}
                  </span>
                  <button type="button" onClick={() => onOpenSlot(slot.key, slot.type, slot.platform)}
                    className="rounded-md bg-white/90 px-1.5 py-0.5 text-[9px] font-semibold text-ink opacity-0 transition group-hover:opacity-100 hover:bg-ink hover:text-white">
                    去修改
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card flex min-h-[220px] flex-col items-center justify-center gap-2 px-6 py-10 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-mist text-ink-faint"><Sparkles className="h-5 w-5" /></span>
            <p className="text-sm font-semibold text-ink">还没有已生成的图片</p>
            <p className="max-w-sm text-xs leading-relaxed text-ink-mute">回到「五图一键生成」跑一次任务，成品会自动汇集到这里，并可带入各工具细改。</p>
          </div>
        )}
      </section>

      {preview && <ImageLightbox image={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}
