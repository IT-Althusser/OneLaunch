import { useRef, useState, type ChangeEvent } from 'react';
import type { ReferenceImage } from '../types';

/** 与后端 ModelRouterImageClient.MAX_REFERENCE_IMAGES 保持一致 */
const MAX_IMAGES = 6;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const ACCEPT = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * 01 · 商品参考图：本地上传（转 base64 直传网关）+ 粘贴公网图片链接。
 * 有参考图时五图走图生图，保持商品外观一致。
 */
export function ReferenceUploader({
  images,
  onAdd,
  onRemove,
}: {
  images: ReferenceImage[];
  onAdd: (items: ReferenceImage[]) => void;
  onRemove: (id: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [urlValue, setUrlValue] = useState('');
  const [error, setError] = useState('');
  const full = images.length >= MAX_IMAGES;

  function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError('');
    const accepted: File[] = [];
    for (const file of Array.from(files)) {
      if (!ACCEPT.includes(file.type)) { setError(`不支持的格式：${file.name}（仅 JPEG / PNG / WebP）`); continue; }
      if (file.size > MAX_FILE_BYTES) { setError(`文件过大：${file.name}（单张不超过 8MB）`); continue; }
      if (images.length + accepted.length >= MAX_IMAGES) { setError(`最多 ${MAX_IMAGES} 张参考图`); break; }
      accepted.push(file);
    }
    if (accepted.length === 0) return;
    let loaded = 0;
    const items: ReferenceImage[] = [];
    accepted.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        items.push({ id: crypto.randomUUID(), src: String(reader.result), name: file.name, kind: 'upload' });
        loaded += 1;
        if (loaded === accepted.length) onAdd(items);
      };
      reader.onerror = () => {
        loaded += 1;
        setError(`读取失败：${file.name}`);
        if (loaded === accepted.length && items.length > 0) onAdd(items);
      };
      reader.readAsDataURL(file);
    });
  }

  function addUrl() {
    const url = urlValue.trim();
    setError('');
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) { setError('请粘贴以 http(s):// 开头的公网图片链接'); return; }
    if (full) { setError(`最多 ${MAX_IMAGES} 张参考图`); return; }
    onAdd([{ id: crypto.randomUUID(), src: url, name: url.split('/').pop() || '参考图', kind: 'url' }]);
    setUrlValue('');
  }

  return (
    <div className="flex h-full flex-col">
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT.join(',')}
        multiple
        className="hidden"
        onChange={(e: ChangeEvent<HTMLInputElement>) => { addFiles(e.target.files); e.target.value = ''; }}
      />
      <button
        type="button"
        disabled={full}
        onClick={() => fileRef.current?.click()}
        className={`flex min-h-[150px] w-full flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed px-4 py-6 transition ${
          full
            ? 'cursor-not-allowed border-[#d9d3c9] bg-[#f4f1eb] text-[#a49d92]'
            : 'border-[#c8c2b8] bg-[#f8f5ef] text-[#6f685e] hover:border-[#ef6a4c] hover:bg-[#fff1ed] hover:text-[#c84f36]'
        }`}
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-current text-lg leading-none">+</span>
        <span className="text-sm font-semibold">{full ? `已达 ${MAX_IMAGES} 张上限` : '添加商品图'}</span>
        <span className="text-[11px] text-[#9a9389]">JPEG / PNG / WebP · 最多 {MAX_IMAGES} 张 · 单张 ≤ 8MB</span>
      </button>

      {images.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {images.map((img) => (
            <div key={img.id} className="group relative overflow-hidden rounded-xl border border-[#e2ddd5] bg-white">
              <img src={img.src} alt={img.name} className="aspect-square w-full object-cover" />
              <button
                type="button"
                onClick={() => onRemove(img.id)}
                aria-label={`移除 ${img.name}`}
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-[11px] font-bold text-white opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
              >
                ×
              </button>
              {img.kind === 'url' && (
                <span className="absolute bottom-0 left-0 right-0 truncate bg-black/55 px-1.5 py-0.5 text-[9px] text-white">链接</span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <input
          className="field min-w-0 flex-1 !py-2.5 text-xs"
          value={urlValue}
          onChange={(e) => setUrlValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addUrl(); } }}
          placeholder="或粘贴公网图片链接后回车"
          aria-label="粘贴图片链接"
        />
        <button
          type="button"
          onClick={addUrl}
          disabled={full}
          className="shrink-0 rounded-xl border border-[#d9d3c9] bg-[#fffdf9] px-3.5 text-xs font-semibold text-[#5e584f] transition hover:border-[#ef6a4c] hover:text-[#c84f36] disabled:cursor-not-allowed disabled:opacity-50"
        >
          添加
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-[#c84f36]">{error}</p>}
      <p className="mt-2 text-[11px] leading-relaxed text-[#9a9389]">
        可多选同一商品的不同角度。有参考图时走图生图，五图与商品外观保持一致。
      </p>
    </div>
  );
}
