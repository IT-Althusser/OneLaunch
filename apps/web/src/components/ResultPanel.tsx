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
      {/* 质检摘要 */}
      {result.qa.length > 0 && <QaSummary qa={result.qa} />}

      {/* 按平台分组展示 */}
      {platforms.map((platform) => {
        const imgs = result.images.filter((img) => img.platform === platform);
        return (
          <section
            key={platform}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
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
    </div>
  );
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
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
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
