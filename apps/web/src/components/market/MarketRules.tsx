import { useEffect, useState } from 'react';
import { fetchComplianceRules } from '../../api/client';
import type { ComplianceRulesSnapshot } from '../../types';

/**
 * 市场规范：平台规范与目标市场广告法的规则浏览器（GET /api/compliance-rules）。
 * 规则与生成端、质检端同源（compliance-rules/*.md），硬性条款两端共用、风格条款仅生成端。
 */
export function MarketRules() {
  const [snapshot, setSnapshot] = useState<ComplianceRulesSnapshot | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'platform' | 'market'>('platform');
  const [selected, setSelected] = useState<Record<'platform' | 'market', string>>({ platform: '', market: '' });

  useEffect(() => {
    fetchComplianceRules()
      .then((data) => {
        setSnapshot(data);
        setSelected({ platform: data.platforms[0]?.key ?? '', market: data.markets[0]?.key ?? '' });
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const docs = snapshot ? (tab === 'platform' ? snapshot.platforms : snapshot.markets) : [];
  const current = docs.find((d) => d.key === selected[tab]) ?? docs[0];

  return (
    <div className="mx-auto max-w-[900px]">
      <div className="mb-5">
        <h1 className="text-xl font-bold tracking-[-0.02em] text-ink">市场规范</h1>
        <p className="mt-1 text-xs text-ink-mute">生成与质检共用的平台规范 / 市场广告法规则库；「硬性」条款同时约束出图与判定，「风格」条款只影响出图。</p>
      </div>

      {/* 页签 + 文档选择 */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-full border border-line bg-white p-1 shadow-card">
          {([['platform', '平台规范'], ['market', '市场广告法']] as const).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setTab(id)} aria-pressed={tab === id}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${tab === id ? 'bg-ink text-white' : 'text-ink-mid hover:text-ink'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {docs.map((d) => (
            <button key={d.key} type="button" onClick={() => setSelected((prev) => ({ ...prev, [tab]: d.key }))} aria-pressed={current?.key === d.key}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${current?.key === d.key ? 'border-ink bg-mist text-ink' : 'border-line bg-white text-ink-mid hover:border-ink-faint'}`}>
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="rounded-xl border border-bad/30 bg-bad/5 px-4 py-3 text-sm text-bad">规则库读取失败：{error}</div>}
      {!snapshot && !error && (
        <div className="space-y-3" aria-hidden>
          {[0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-mist" />)}
        </div>
      )}

      {current && (
        <div className="space-y-4">
          {current.sections.length === 0 && <p className="card px-5 py-8 text-center text-xs text-ink-faint">该文档暂无结构化规则。</p>}
          {current.sections.map((section) => (
            <section key={section.name} className="card px-5 py-4">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-ink">
                {section.name}
                <span className="rounded-full bg-mist px-2 py-0.5 text-[10px] font-semibold text-ink-mute">{section.rules.length} 条</span>
              </h2>
              <ul className="space-y-2.5">
                {section.rules.map((rule, i) => (
                  <li key={i} className="flex gap-2.5 text-xs leading-relaxed">
                    {rule.id && <span className="mt-0.5 h-fit shrink-0 rounded-md bg-mist px-1.5 py-0.5 font-mono text-[10px] font-semibold text-ink-mute">{rule.id}</span>}
                    <span className={`mt-0.5 h-fit shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${rule.hard ? 'bg-ink text-white' : 'border border-dashed border-line-strong text-ink-mute'}`}>
                      {rule.hard ? '硬性' : '风格'}
                    </span>
                    <span className="min-w-0 text-ink-mid">{rule.text}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
