import { useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { TaskForm } from './components/TaskForm';
import { RightPanel } from './components/RightPanel';
import { StatusSteps } from './components/StatusSteps';
import { ResultPanel } from './components/ResultPanel';
import { runImagePipeline } from './api/client';
import type { ImagePipelineInput, ImagePipelineResult } from './types';

type Tab = 'create' | 'results' | 'process';

export default function App() {
  const [tab, setTab] = useState<Tab>('create'); const [loading, setLoading] = useState(false); const [result, setResult] = useState<ImagePipelineResult | null>(null); const [error, setError] = useState(''); const [apiOk, setApiOk] = useState<boolean | null>(null);
  useEffect(() => { fetch('/api/health').then((r) => setApiOk(r.ok)).catch(() => setApiOk(false)); }, []);
  async function handleSubmit(input: ImagePipelineInput) { setLoading(true); setError(''); setResult(null); try { const res = await runImagePipeline(input); setResult(res); setTab('results'); } catch (e) { setError((e as Error).message); } finally { setLoading(false); } }
  return <div className="flex min-h-screen bg-[#f4f1eb] text-[#17202b]"><Sidebar apiOk={apiOk} /><main className="flex min-w-0 flex-1 flex-col"><header className="flex min-h-[88px] shrink-0 items-center justify-between gap-6 border-b border-[#e2ddd5] bg-[#fffdf9] px-6 py-5 lg:px-10"><div><div className="eyebrow mb-2">OneLaunch / Image studio</div><h1 className="text-[24px] font-semibold tracking-[-0.045em] text-[#17202b] sm:text-[30px]">把新品，做成一套能上架的图。</h1><p className="mt-1.5 hidden text-sm text-[#8d867c] md:block">从商品信息到多平台套图，一次输入，五种必备图片。</p></div><nav className="flex shrink-0 rounded-xl border border-[#e2ddd5] bg-[#f4f1eb] p-1">{(['create', 'results', 'process'] as Tab[]).map((t) => <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-3 py-2 text-xs font-semibold transition sm:px-4 ${tab === t ? 'bg-[#19232b] text-white shadow-sm' : 'text-[#777168] hover:text-[#17202b]'}`}>{t === 'create' ? '开始创作' : t === 'results' ? '查看结果' : '处理流程'}</button>)}</nav></header><div className="flex flex-1 overflow-hidden"><div className="flex-1 overflow-y-auto px-5 py-7 lg:px-10 lg:py-9">{tab === 'create' && <TaskForm loading={loading} error={error} onSubmit={handleSubmit} />}{tab === 'results' && (result ? <ResultPanel result={result} /> : <EmptyResults />)}{tab === 'process' && (result ? <StatusSteps steps={result.steps} profile={result.profile} /> : <EmptyResults />)}</div><RightPanel /></div></main></div>;
}

function EmptyResults() { return <div className="flex min-h-[420px] items-center justify-center"><div className="max-w-sm text-center"><div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[20px] bg-[#e8e2d9] text-2xl text-[#8d867c]">✦</div><h2 className="text-lg font-semibold text-[#39342e]">这里会出现你的五图套图</h2><p className="mt-2 text-sm leading-relaxed text-[#8d867c]">先完成商品信息和销售平台选择，生成后可在这里预览、质检和下载。</p></div></div>; }
