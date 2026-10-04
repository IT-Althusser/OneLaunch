import type { ModelOption } from '../../types';

/** 模型下拉（已验证模型排前；清单不可用时保留现值）——从旧 RightPanel 抽出共用 */
export function ModelSelect({
  id,
  label,
  hint,
  options,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  options: ModelOption[];
  value: string;
  onChange: (id: string) => void;
}) {
  const sorted = [...options].sort((a, b) => Number(b.verified) - Number(a.verified));
  const known = sorted.some((o) => o.id === value);
  return (
    <div>
      <div className="mb-1.5 flex items-baseline gap-2">
        <label htmlFor={id} className="min-w-0 flex-1 truncate text-xs font-semibold text-ink-mid">{label}</label>
        <span className="shrink-0 text-[10px] text-ink-faint">{hint}</span>
      </div>
      <select
        id={id}
        className="field select-field !py-2.5 text-xs font-medium"
        value={known ? value : ''}
        onChange={(e) => onChange(e.target.value)}
      >
        {!known && <option value="">当前模型 {value}（网关清单不可用）</option>}
        {sorted.map((o) => (
          <option key={o.id} value={o.id}>{o.id}{o.verified ? ' · 已验证' : ''}</option>
        ))}
      </select>
    </div>
  );
}

/** 只读模型行（默认档展示网关解析结果） */
export function ModelReadout({ label, hint, value }: { label: string; hint: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2 rounded-[10px] border border-line bg-mist px-3.5 py-2.5">
      <span className="min-w-0 flex-1 truncate text-xs font-semibold text-ink-mid">{label}</span>
      <span className="min-w-0 truncate rounded-md bg-white px-2 py-0.5 font-mono text-[11px] text-ink-mid">{value || '—'}</span>
      <span className="shrink-0 text-[10px] text-ink-faint">{hint}</span>
    </div>
  );
}
