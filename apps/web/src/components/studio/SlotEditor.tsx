import type { Editor } from './StudioView';

/** 槽位单图编辑条：重新生成（文生图/参考图）或基于当前图修改（图生图） */
export function SlotEditor({
  editor,
  busy,
  error,
  onChange,
  onCancel,
  onConfirm,
}: {
  editor: Editor;
  busy: boolean;
  error: string;
  onChange: (prompt: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="mt-3 rounded-xl border border-line bg-white px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-bold text-ink">
          {editor.mode === 'regen' ? `重新生成 · ${editor.type}（${editor.platform}）` : `基于当前图修改 · ${editor.type}（${editor.platform}）`}
        </span>
        <span className="text-[10px] text-ink-faint">{editor.mode === 'regen' ? '文生图 / 参考图生成' : '图生图 · 以当前结果为源图'}</span>
      </div>
      <textarea
        className="field min-h-[64px] resize-y text-xs"
        value={editor.prompt}
        onChange={(e) => onChange(e.target.value)}
        placeholder={editor.mode === 'regen' ? '编辑提示词后重新生成，例如：纯白背景，产品稍微倾斜 15 度，增加投影' : '描述要改什么，例如：把背景换成清晨的咖啡桌场景，保留商品不变'}
        disabled={busy}
      />
      {error && <p className="mt-1.5 text-xs text-bad">{error}</p>}
      <div className="mt-2 flex justify-end gap-2">
        <button type="button" onClick={onCancel} disabled={busy} className="btn-ghost px-3 py-1.5 text-xs">取消</button>
        <button type="button" onClick={onConfirm} disabled={busy || !editor.prompt.trim()} className="btn-primary px-3.5 py-1.5 text-xs">
          {busy ? '生成中…' : editor.mode === 'regen' ? '确认重新生成' : '确认修改'}
        </button>
      </div>
    </div>
  );
}
