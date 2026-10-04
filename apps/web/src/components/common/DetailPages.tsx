import { useState } from 'react';
import { ImageLightbox } from './ImageLightbox';
import type { DetailPage, GeneratedImage } from '../../types';

/**
 * 详情页渲染：按模块组合已生成图片与 AI 文案（section.imageType → 对应平台的生成图）。
 * 生成工作台（流水线结果）与独立 AI 详情页工作台共用；找不到配图的模块自动降级为纯文案。
 */
export function DetailPages({ pages, images }: { pages: DetailPage[]; images: GeneratedImage[] }) {
  const [preview, setPreview] = useState<{ url: string; type: string; platform: string; size: string } | null>(null);
  return (
    <section className="card px-5 py-4">
      <h2 className="mb-1 text-sm font-bold text-ink">AI 详情页 · 图文自动编排</h2>
      <p className="mb-3 text-[11px] text-ink-mute">按平台规范自动组合配图与文案，模块配图引用本次生成图，可直接按模块复制使用。</p>
      <div className="space-y-2">
        {pages.map((page) => (
          <details key={page.platform} className="rounded-xl border border-line bg-white px-4 py-3">
            <summary className="cursor-pointer list-none text-xs font-semibold text-ink"><span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-ink align-middle" />{page.platform} · {page.title}</summary>
            <div className="mt-3 space-y-2 border-t border-line pt-3">
              <p className="text-xs font-medium text-ink-mid">{page.subtitle}</p>
              {page.sellingPoints.length > 0 && (
                <ul className="list-disc space-y-0.5 pl-5 text-[11px] text-ink-mid">{page.sellingPoints.map((point) => <li key={point}>{point}</li>)}</ul>
              )}
              {page.sections.map((section, i) => {
                const image = section.imageType
                  ? images.find((im) => im.platform === page.platform && im.type === section.imageType)
                  : undefined;
                const imageRight = i % 2 === 1;
                return (
                  <div key={`${section.type}-${i}`} className={`flex flex-col gap-3 border-t border-line py-3 ${image && imageRight ? 'sm:flex-row-reverse' : 'sm:flex-row'}`}>
                    {image && (
                      <div className="relative shrink-0">
                        <img
                          src={image.url}
                          alt={section.title}
                          loading="lazy"
                          className="h-24 w-24 cursor-zoom-in rounded-lg border border-line object-cover"
                          title="双击放大预览"
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPreview({ url: image.url, type: section.imageType ?? '', platform: page.platform, size: image.size }); } }}
                          onDoubleClick={() => setPreview({ url: image.url, type: section.imageType ?? '', platform: page.platform, size: image.size })}
                        />
                        <span className="absolute bottom-1 left-1 rounded bg-black/55 px-1 py-0.5 text-[8px] font-bold text-white">{section.imageType}</span>
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-semibold text-ink">{section.title}</div>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-ink-mid">{section.body}</p>
                      {section.bullets && section.bullets.length > 0 && (
                        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[10px] text-ink-mute">{section.bullets.map((b) => <li key={b}>{b}</li>)}</ul>
                      )}
                    </div>
                  </div>
                );
              })}
              {page.compliance.length > 0 && (
                <p className="text-[10px] leading-relaxed text-ink-faint">合规提示：{page.compliance.join(' · ')}</p>
              )}
            </div>
          </details>
        ))}
      </div>
      {preview && <ImageLightbox image={preview} onClose={() => setPreview(null)} />}
    </section>
  );
}
