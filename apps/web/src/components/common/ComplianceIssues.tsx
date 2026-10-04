import type { ComplianceIssue } from '../../types';

/** 合规问题清单：维度 · 严重度着色 + 详情 + 修改建议 */
export function ComplianceIssues({ issues }: { issues: ComplianceIssue[] }) {
  return (
    <div className="mt-2 space-y-2">
      {issues.map((issue, i) => (
        <div key={i} className="border-t border-line py-2 text-xs leading-relaxed">
          <span className={`font-semibold ${issue.severity === '高' ? 'text-bad' : issue.severity === '中' ? 'text-warn' : 'text-ink-mid'}`}>{issue.dimension} · {issue.severity}</span>
          <p className="mt-1 break-words text-ink-mid">{issue.detail}</p>
          <p className="mt-1 break-words text-ink-mute">建议：{issue.suggestion}</p>
        </div>
      ))}
    </div>
  );
}
