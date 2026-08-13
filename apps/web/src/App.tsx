import { useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { TaskForm } from './components/TaskForm';
import { RightPanel } from './components/RightPanel';
import { StatusSteps } from './components/StatusSteps';
import { ResultPanel } from './components/ResultPanel';
import { runImagePipeline } from './api/client';
import type { ImagePipelineInput, ImagePipelineResult } from './types';

type Tab = 'create' | 'results' | 'process';

const TAB_LABELS: Record<Tab, string> = {
  create: '创作',
  results: '结果',
  process: '处理流程',
};

export default function App() {
  const [tab, setTab] = useState<Tab>('create');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImagePipelineResult | null>(null);
  const [error, setError] = useState('');
  const [apiOk, setApiOk] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => setApiOk(r.ok))
      .catch(() => setApiOk(false));
  }, []);

  async function handleSubmit(input: ImagePipelineInput) {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await runImagePipeline(input);
      setResult(res);
      setTab('results');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 text-slate-800">
      {/* 左栏：深色侧边栏 */}
      <Sidebar apiOk={apiOk} />

      {/* 中栏：主内容区 */}
      <main className="flex min-w-0 flex-1 flex-col">
        {/* 顶栏 */}
        <header className="flex h-14 shrink-0 items-center gap-4 border-b border-slate-200 bg-white px-6">
          <div className="min-w-0">
            <div className="text-[10px] font-bold tracking-[.14em] text-emerald-600">
              CREATE · 01
            </div>
            <h1 className="text-sm font-bold leading-tight text-slate-800">
              五图套图生成
            </h1>
          </div>
          <p className="hidden max-w-md text-[11px] leading-relaxed text-slate-400 lg:block">
            输入商品名称、卖点与可选参考图，一键生成白底图、场景图、模特图、对比图、尺寸图，自动适配多平台尺寸与风格。
          </p>
          {/* 标签页 */}
          <nav className="ml-auto flex gap-1.5">
            {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  tab === t
                    ? 'bg-emerald-600 text-white'
                    : 'border border-slate-200 text-slate-500 hover:border-emerald-400 hover:text-emerald-600'
                }`}
              >
                {TAB_LABELS[t]}
              </button>
            ))}
          </nav>
        </header>

        {/* 内容区 + 右栏 */}
        <div className="flex flex-1 overflow-hidden">
          {/* 可滚动内容区 */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {tab === 'create' && (
              <TaskForm
                loading={loading}
                error={error}
                onSubmit={handleSubmit}
              />
            )}
            {tab === 'results' && (
              <>
                {result ? (
                  <ResultPanel result={result} />
                ) : (
                  <EmptyResults />
                )}
              </>
            )}
            {tab === 'process' && (
              <>
                {result ? (
                  <StatusSteps steps={result.steps} profile={result.profile} />
                ) : (
                  <EmptyResults />
                )}
              </>
            )}
          </div>

          {/* 右栏：输出配置 */}
          <RightPanel />
        </div>
      </main>
    </div>
  );
}

function EmptyResults() {
  return (
    <div className="flex h-full min-h-[300px] items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-200 text-xl text-slate-400">
          ?
        </div>
        <p className="text-sm text-slate-400">
          请先在「创作」标签页生成五图套图
        </p>
      </div>
    </div>
  );
}
