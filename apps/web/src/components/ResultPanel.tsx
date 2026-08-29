/**
 * 结果面板 — 按平台分组展示生成图片 + 质检标记
 * 白底图标注质检通过/未通过
 */
import {
  IMAGE_TYPES,
  type GeneratedImage,
  type ImagePipelineResult,
  type QaRecord,
} from '../types';

export function ResultPanel({ result }: { result: ImagePipelineResult }) {
  const platforms = [...new Set(result.images.map((img) => img.platform))];

  if (result.images.length === 0) {
    return (
      <div className="flex h-full min-h-[300px] items-center justify-center">
        <p className="text-sm text-slate-400">本次未生成图片</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="eyebrow mb-1">生成完成</div><h2 className="text-2xl font-semibold tracking-[-0.04em] text-[#17202b]">你的上架图包</h2><p className="mt-1 text-sm text-[#8d867c]">{result.images.length} 张图片 · {result.detailPages?.length ?? 0} 个详情页版本</p></div><button type="button" onClick={() => window.print()} className="rounded-xl border border-[#d9d3c9] bg-[#fffdf9] px-4 py-2 text-xs font-semibold text-[#5e584f] hover:border-[#ef6a4c] hover:text-[#c84f36]">打印 / 导出</button></div>
      {/* 质检摘要 */}
      {result.qa.length > 0 && <QaSummary qa={result.qa} />}

      {/* 按平台分组展示 */}
      {platforms.map((platform) => {
        const imgs = result.images.filter((img) => img.platform === platform);
        return (
          <section
            key={platform}
            className="panel p-5"
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold tracking-[.14em] text-emerald-600">
                  {platform.toUpperCase()}
                </div>
                <h2 className="mt-0.5 text-sm font-bold text-slate-800">
                  {platform}
                </h2>
              </div>
              <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                {imgs.length} 张
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
              {IMAGE_TYPES.map((type) => {
                const img = imgs.find((i) => i.type === type);
                return (
                  <ImageCard
                    key={type}
                    image={img}
                    type={type}
                    qa={result.qa.find((q) => q.type === type)}
                  />
                );
              })}
            </div>
          </section>
        );
      })}
      {result.detailPages && result.detailPages.length > 0 && <DetailPages pages={result.detailPages} />}
    </div>
  );
}

function DetailPages({ pages }: { pages: NonNullable<ImagePipelineResult['detailPages']> }) {
  return <section className="panel p-5"><div className="mb-4"><div className="eyebrow mb-1">Detail page</div><h2 className="text-lg font-semibold text-[#17202b]">多平台详情页草稿</h2><p className="mt-1 text-xs text-[#8d867c]">文案、卖点和图片顺序已按平台生成，可直接复制到后台继续编辑。</p></div><div className="space-y-3">{pages.map((page) => <details key={page.platform} className="rounded-xl border border-[#e2ddd5] bg-[#fffdf9] px-4 py-3"><summary className="cursor-pointer list-none text-sm font-semibold text-[#39342e]"><span className="mr-2 text-[#ef6a4c]">●</span>{page.platform} · {page.title}</summary><div className="mt-4 space-y-3 border-t border-[#eee8df] pt-4"><p className="text-sm font-medium text-[#514b43]">{page.subtitle}</p><ul className="list-disc space-y-1 pl-5 text-xs text-[#6f685e]">{page.sellingPoints.map((point) => <li key={point}>{point}</li>)}</ul>{page.sections.map((section) => <div key={section.type} className="rounded-lg bg-[#f4f1eb] p-3"><div className="text-xs font-semibold text-[#39342e]">{section.title}</div><p className="mt-1 text-xs leading-relaxed text-[#777168]">{section.body}</p></div>)}</div></details>)}</div></section>;
}

function ImageCard({
  image,
  type,
  qa,
}: {
  image?: GeneratedImage;
  type: string;
  qa?: QaRecord;
}) {
  if (!image) {
    return (
      <div className="aspect-square rounded-lg border border-dashed border-slate-200 bg-slate-50">
        <div className="flex h-full flex-col items-center justify-center">
          <span className="text-[10px] text-slate-300">{type}</span>
          <span className="mt-1 text-[9px] text-slate-300">未生成</span>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
      <img
        src={image.url}
        alt={`${type} - ${image.platform}`}
        className="aspect-square w-full object-cover"
        loading="lazy"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
      {/* 类型标签 */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
        <span className="text-[11px] font-semibold text-white">{type}</span>
        <span className="ml-1.5 text-[9px] text-white/70">{image.size}</span>
      </div>
      {/* 质检标记 */}
      {qa && (
        <div
          className={`absolute right-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
            qa.passed
              ? 'bg-emerald-500 text-white'
              : 'bg-red-500 text-white'
          }`}
        >
          {qa.passed ? '质检通过' : '质检未过'}
        </div>
      )}
    </div>
  );
}

function QaSummary({ qa }: { qa: QaRecord[] }) {
  const passed = qa.filter((q) => q.passed).length;
  const failed = qa.length - passed;

  return (
    <section className="panel p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-[10px] font-bold tracking-[.14em] text-emerald-600">
            QUALITY CHECK · 质检结论
          </div>
          <h2 className="mt-0.5 text-sm font-bold text-slate-800">
            白底图质检摘要
          </h2>
        </div>
        <div className="flex gap-2">
          <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
            通过 {passed}
          </span>
          {failed > 0 && (
            <span className="rounded bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-500">
              未过 {failed}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        {qa.map((q, i) => (
          <div
            key={i}
            className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2"
          >
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${
                q.passed ? 'bg-emerald-500' : 'bg-red-400'
              }`}
            />
            <span className="text-xs font-semibold text-slate-700">
              {q.type}
            </span>
            <span className="ml-auto truncate text-[11px] text-slate-400">
              {q.comment}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
