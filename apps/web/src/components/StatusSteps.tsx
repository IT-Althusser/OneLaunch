/**
 * 处理流程面板 — 流水线步骤状态 + 商品画像
 * 展示六步流水线的执行结果与降级路径
 */
import { IMAGE_TYPES, type StepRecord } from '../types';

const STEP_LABELS: Record<string, string> = {
  profile: '商品图理解',
  prompts: '提示词设计',
  generation: '五图生成',
  qa: '质检闭环',
};

const STATUS_STYLE: Record<
  StepRecord['status'],
  { dot: string; text: string; label: string }
> = {
  done: { dot: 'bg-emerald-500', text: 'text-emerald-600', label: '完成' },
  failed: { dot: 'bg-red-400', text: 'text-red-500', label: '失败' },
  skipped: { dot: 'bg-slate-300', text: 'text-slate-400', label: '跳过' },
};

export function StatusSteps({
  steps,
  profile,
}: {
  steps: StepRecord[];
  profile?: string;
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* 步骤列表 */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <div className="text-[10px] font-bold tracking-[.14em] text-emerald-600">
            PIPELINE · 六步流水线
          </div>
          <h2 className="mt-0.5 text-sm font-bold text-slate-800">执行状态</h2>
        </div>

        <div className="space-y-3">
          {/* 步骤 0：输入（始终完成） */}
          <StepRow num="00" label="输入解析" status="done" detail="商品名称 · 卖点 · 平台" />

          {steps.map((s, i) => {
            const style = STATUS_STYLE[s.status];
            return (
              <StepRow
                key={s.step}
                num={`0${i + 1}`}
                label={STEP_LABELS[s.step] ?? s.step}
                status={s.status}
                detail={s.detail}
              />
            );
          })}

          {/* 步骤 5：输出（始终完成） */}
          <StepRow num="05" label="结果输出" status="done" detail="多平台上架图包" />
        </div>
      </section>

      {/* 商品画像 */}
      {profile && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3">
            <div className="text-[10px] font-bold tracking-[.14em] text-emerald-600">
              PRODUCT PROFILE
            </div>
            <h2 className="mt-0.5 text-sm font-bold text-slate-800">
              结构化商品画像
            </h2>
          </div>
          <pre className="max-h-64 overflow-y-auto rounded-lg bg-slate-900 p-4 text-[11px] leading-relaxed text-slate-300">
            {profile}
          </pre>
        </section>
      )}

      {/* 图片类型说明 */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3">
          <div className="text-[10px] font-bold tracking-[.14em] text-emerald-600">
            IMAGE TYPES · 五图类型
          </div>
          <h2 className="mt-0.5 text-sm font-bold text-slate-800">生成图类型</h2>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {IMAGE_TYPES.map((t, i) => (
            <div
              key={t}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-center"
            >
              <div className="text-[10px] font-bold text-emerald-600">
                0{i + 1}
              </div>
              <div className="mt-0.5 text-xs font-semibold text-slate-700">
                {t}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function StepRow({
  num,
  label,
  status,
  detail,
}: {
  num: string;
  label: string;
  status: StepRecord['status'];
  detail?: string;
}) {
  const style = STATUS_STYLE[status];
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 px-3.5 py-2.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-900 text-[11px] font-bold text-emerald-400">
        {num}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-slate-800">{label}</div>
        {detail && (
          <div className="mt-0.5 truncate text-[11px] text-slate-400">
            {detail}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <span className={`h-2 w-2 rounded-full ${style.dot}`} />
        <span className={`text-[11px] font-medium ${style.text}`}>
          {style.label}
        </span>
      </div>
    </div>
  );
}
