import { imageProxyUrl } from '../../api/client';
import { TYPE_DOT } from '../../lib/format';
import type { ImageSlotState } from '../../types';

/** 单图槽位卡：等待 / 运行（蓝色扫描）/ 完成（hover 操作）/ 失败（可重试） */
export function SlotCard({
  type,
  state,
  busy,
  editorOpen,
  onOpenWorkbench,
  onRegen,
  onEdit,
  onPreview,
}: {
  type: string;
  state?: ImageSlotState;
  busy: boolean;
  editorOpen: boolean;
  onOpenWorkbench: () => void;
  onRegen: () => void;
  onEdit: () => void;
  onPreview: () => void;
}) {
  const status = state?.status ?? 'pending';
  const hasImage = Boolean(state?.url);
  // 下载原图经同源代理带 Content-Disposition: attachment
  const downloadImage = () => {
    if (!state?.url || busy) return;
    const a = document.createElement('a');
    a.href = imageProxyUrl(state.url, true);
    a.download = `${type}.png`;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className={`group relative overflow-hidden rounded-xl border bg-mist transition ${editorOpen ? 'border-ink' : 'border-line'}`}>
      <div
        className={`relative aspect-square w-full ${hasImage && !busy ? 'cursor-zoom-in' : ''}`}
        onDoubleClick={() => { if (hasImage && !busy) onPreview(); }}
        onKeyDown={(e) => { if (e.key === 'Enter' && hasImage && !busy) { e.preventDefault(); onPreview(); } }}
        role={hasImage ? 'button' : undefined}
        tabIndex={hasImage && !busy ? 0 : undefined}
        title={hasImage && !busy ? '双击放大预览；右上角可下载原图' : undefined}
      >
        {hasImage && <img src={state?.url} alt={type} className={`h-full w-full object-cover transition ${busy ? 'opacity-40' : ''}`} loading="lazy" />}

        {!hasImage && (
          <div className="flex h-full flex-col items-center justify-center gap-1.5 px-2 text-center">
            {status === 'running' ? (
              <>
                <span className="slot-shimmer h-1 w-3/5 rounded-full bg-line" />
                <span className="slot-shimmer h-1 w-4/5 rounded-full bg-line-strong" style={{ animationDelay: '0.15s' }} />
                <span className="slot-shimmer h-1 w-2/5 rounded-full bg-line" style={{ animationDelay: '0.3s' }} />
              </>
            ) : (
              <>
                <span className={`flex items-center gap-1.5 text-xs font-semibold ${status === 'failed' ? 'text-bad' : 'text-ink-mid'}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${TYPE_DOT[type] ?? 'bg-ink-faint'}`} />
                  {type}
                </span>
                <span className="text-[10px] text-ink-faint">{status === 'failed' ? '生成失败' : '等待中'}</span>
              </>
            )}
          </div>
        )}

        {hasImage && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-4">
            <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle ${TYPE_DOT[type] ?? 'bg-white/60'}`} />
            <span className="text-[11px] font-semibold text-white">{type}</span>
            <span className="ml-1.5 text-[9px] text-white/70">{state?.size}</span>
          </div>
        )}

        {status === 'failed' && <span className="absolute left-1.5 top-1.5 rounded-full bg-bad px-1.5 py-0.5 text-[9px] font-bold text-white">{hasImage ? '上次失败' : '失败'}</span>}

        {hasImage && !busy && (
          <div onDoubleClick={(e) => e.stopPropagation()} className={`absolute right-1.5 top-1.5 flex flex-col gap-1 transition ${editorOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'}`}>
            {([
              ['下载', downloadImage],
              ['工作台', onOpenWorkbench],
              ['重新生成', onRegen],
              ['修改', onEdit],
            ] as const).map(([label, handler]) => (
              <button key={label} type="button" onClick={(e) => { e.stopPropagation(); handler(); }}
                className="rounded-lg bg-white/90 px-2 py-1 text-[10px] font-semibold text-ink shadow-sm backdrop-blur transition hover:bg-ink hover:text-white">
                {label}
              </button>
            ))}
          </div>
        )}

        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/25">
            <span className="slot-shimmer h-2 w-3/5 rounded-full bg-white/50" role="status" aria-label="生成中" />
          </div>
        )}
        {status === 'running' && !hasImage && (
          <span className="absolute bottom-1.5 left-0 right-0 truncate px-2 text-center text-[9px] text-ink-mute">网关生成中，通常 20–60 秒</span>
        )}
      </div>

      {status === 'failed' && !hasImage && (
        <div className="border-t border-line p-2">
          <p className="mb-2 break-words text-xs text-bad">{state?.error || '生成失败，请重试'}</p>
          <button type="button" onClick={onRegen} className="btn-ghost px-3 py-1.5 text-xs">重试此图</button>
        </div>
      )}
    </div>
  );
}
