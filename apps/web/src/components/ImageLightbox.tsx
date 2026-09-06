import { useEffect, useRef } from 'react';
import { imageProxyUrl } from '../api/client';

/** 图片放大预览（各工作台共用）：Esc 或点击遮罩关闭，可直接下载原图。 */
export function ImageLightbox({
  image,
  onClose,
}: {
  image: { url: string; type: string; platform: string; size: string };
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    dialogRef.current?.querySelector<HTMLElement>('button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const targets = dialogRef.current?.querySelectorAll<HTMLElement>('a, button');
        if (!targets?.length) return;
        const first = targets[0], last = targets[targets.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${image.type}放大预览`}
      className="log-line fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/80 p-6"
      onClick={onClose}
    >
      <img
        src={image.url}
        alt={`${image.type} · ${image.platform}`}
        className="max-h-[78vh] max-w-[86vw] rounded-xl object-contain shadow-[0_18px_36px_rgba(0,0,0,.45)]"
        onClick={(e) => e.stopPropagation()}
      />
      <div className="flex flex-wrap items-center justify-center gap-4" onClick={(e) => e.stopPropagation()}>
        <span className="text-xs font-semibold text-white">{image.type} · {image.platform}{image.size ? ` · ${image.size}` : ''}</span>
        <div className="flex gap-2">
          <a href={imageProxyUrl(image.url, true)} download="product-image.png" className="rounded-lg bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#ef6a4c]">下载原图</a>
          <button type="button" onClick={onClose} className="rounded-lg bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-white/25">关闭</button>
        </div>
      </div>
    </div>
  );
}
