import type { ComplianceIssue } from '../types';

export function ComplianceIssues({ issues }: { issues: ComplianceIssue[] }) {
  return <div className="mt-2 space-y-2">{issues.map((issue, i) => <div key={i} className="border-t border-[#e8e2d9] py-2 text-xs leading-relaxed">
    <span className={`font-semibold ${issue.severity === '高' ? 'text-[#a44836]' : issue.severity === '中' ? 'text-[#9a6b2f]' : 'text-[#6f685e]'}`}>{issue.dimension} · {issue.severity}</span>
    <p className="mt-1 break-words text-[#514b43]">{issue.detail}</p>
    <p className="mt-1 break-words text-[#6f685e]">建议：{issue.suggestion}</p>
  </div>)}</div>;
}
