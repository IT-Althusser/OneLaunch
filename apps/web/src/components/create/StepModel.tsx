import { useState } from 'react';
import { ArrowLeft, Rocket } from 'lucide-react';
import { ModelReadout, ModelSelect } from './ModelSelect';
import type { ModelCatalog, ModelSelection } from '../../types';

/** 第 3 步 · 模型调用：默认（只读网关解析）/ 自定义（全量选择 + 网关路由）+ 生成go!（对应草图 #3） */
export function StepModel({
  catalog,
  selection,
  catalogError,
  platforms,
  hasRefs,
  productName,
  qaScope,
  onSelectionChange,
  onBack,
  onSubmit,
}: {
  catalog: ModelCatalog | null;
  selection: ModelSelection;
  catalogError: string;
  platforms: string[];
  hasRefs: boolean;
  productName: string;
  qaScope?: 'all' | 'white';
  onSelectionChange: (next: ModelSelection) => void;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const [tab, setTab] = useState<'default' | 'custom'>('default');
  const [localError, setLocalError] = useState('');
  const editMode = selection.editGateway ?? 'default';
  const editOptions = editMode === 'custom' ? (catalog?.editToImage ?? []) : (catalog?.imageToImage ?? []);

  /** 图生图路由双档切换：默认（Token Plan，比赛口径）/ 自定义（服务端预配置网关，诊断用） */
  function switchGateway(mode: 'default' | 'custom') {
    if (mode === editMode) return;
    const options = mode === 'custom' ? (catalog?.editToImage ?? []) : (catalog?.imageToImage ?? []);
    const preferred = options.find((o) => o.verified) ?? options[0];
    onSelectionChange({ ...selection, editGateway: mode, editModel: preferred ? preferred.id : selection.editModel });
  }

  function submit() {
    if (!productName.trim() && !hasRefs) { setLocalError('请填写商品名称，或回到第 1 步添加商品参考图'); return; }
    if (platforms.length === 0) { setLocalError('请至少选择一个发布平台（第 2 步「发布到哪里？」）'); return; }
    setLocalError('');
    onSubmit();
  }

  const ready = (productName.trim() !== '' || hasRefs) && platforms.length > 0;
  const statusText = catalog?.editError || catalog?.error || catalogError
    || (catalog ? `网关在线 · ${catalog.textToImage.length + (editMode === 'custom' ? editOptions.length : catalog.imageToImage.length)} 个图片模型可用` : '正在读取网关模型清单…');

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-4">
        {/* 默认 / 自定义 分段 */}
        <div className="grid max-w-[420px] grid-cols-2 gap-2">
          {([['default', '默认'], ['custom', '自定义']] as const).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setTab(id)} aria-pressed={tab === id}
              className={`rounded-[10px] border px-3 py-2.5 text-sm font-semibold transition ${tab === id ? 'border-ink bg-mist text-ink' : 'border-line bg-white text-ink-mid hover:border-ink-faint'}`}>
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-faint">{statusText}</p>

        {tab === 'default' ? (
          <div className="space-y-2.5">
            <ModelReadout label="图片生成 · 文生图" hint="通义万相" value={selection.imageModel} />
            <ModelReadout label="参考图 / 编辑 · 图生图" hint="Qwen-Image" value={selection.editModel} />
            <ModelReadout label="文案生成 · 画像 / 提示词" hint="Qwen 系列" value={selection.textModel} />
            <ModelReadout label="质检与合规 · 视觉模型" hint="内容理解" value={selection.visionModel} />
            <p className="text-[11px] leading-relaxed text-ink-faint">
              使用网关当前清单的默认模型，可直接生成；需要指定模型或切换图生图网关时切到「自定义」。
              {catalog && !catalog.visionAvailable ? ' 网关暂无可用视觉模型，质检降级为人工复检提醒。' : ''}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <ModelSelect id="model-image" label="图片生成 · 通义万相" hint="文生图" options={catalog?.textToImage ?? []} value={selection.imageModel} onChange={(id) => onSelectionChange({ ...selection, imageModel: id })} />
            <div>
              <div className="mb-1.5 flex items-baseline gap-2">
                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-ink-mid">图生图网关</span>
                <span className="shrink-0 text-[10px] text-ink-faint">{editMode === 'custom' ? '诊断用' : '比赛口径'}</span>
              </div>
              <div className="mb-2 flex gap-1 rounded-[10px] bg-mist p-1">
                {([['default', '默认（比赛）'], ['custom', '自定义']] as const).map(([id, label]) => (
                  <button key={id} type="button" onClick={() => switchGateway(id)} disabled={id === 'custom' && !catalog?.editGateway}
                    title={id === 'custom' && !catalog?.editGateway ? '未配置：需在服务端 .env 设置 MODEL_ROUTER_EDIT_BASE_URL / MODEL_ROUTER_EDIT_API_KEY' : undefined}
                    className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${editMode === id ? 'bg-white text-ink shadow-sm' : 'text-ink-mute hover:text-ink-mid'}`}>
                    {label}
                  </button>
                ))}
              </div>
              <ModelSelect id="model-edit" label={editMode === 'custom' ? '参考图 / 编辑 · 自定义网关' : '参考图 / 编辑 · Qwen-Image'} hint="图生图" options={editOptions} value={selection.editModel} onChange={(id) => onSelectionChange({ ...selection, editModel: id })} />
            </div>
            <ModelSelect id="model-text" label="文案生成 · Qwen 系列" hint="画像 / 提示词" options={catalog?.text ?? []} value={selection.textModel} onChange={(id) => onSelectionChange({ ...selection, textModel: id })} />
            {catalog?.visionAvailable && catalog.vision.length > 0 ? (
              <ModelSelect id="model-vision" label="质检与合规检测 · 视觉模型" hint="内容理解与合规" options={catalog.vision} value={selection.visionModel} onChange={(id) => onSelectionChange({ ...selection, visionModel: id })} />
            ) : (
              <div className="rounded-[10px] border border-line bg-mist px-3.5 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-ink-mid">视觉模型 · 内容理解与合规检测</span>
                  <span className="rounded-full bg-warn/10 px-2 py-0.5 text-[9px] font-bold text-warn">不可用</span>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-mute">网关清单暂无可用视觉模型，合规检测降级为人工复检提醒。</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 右列：任务摘要 + 生成go! */}
      <div className="flex flex-col gap-4 lg:sticky lg:top-2">
        <div className="rounded-2xl border border-line bg-mist px-5 py-4">
          <div className="eyebrow mb-2.5">任务摘要</div>
          <ul className="space-y-1.5 text-xs text-ink-mid">
            <li className="flex justify-between"><span>发布平台</span><span className="font-semibold text-ink">{platforms.length} 个</span></li>
            <li className="flex justify-between"><span>生成图片</span><span className="font-semibold text-ink">{platforms.length * 5} 张</span></li>
            <li className="flex justify-between"><span>参考图</span><span className="font-semibold text-ink">{hasRefs ? '已添加 · 图生图' : '无 · 文生图'}</span></li>
            <li className="flex justify-between"><span>质检范围</span><span className="font-semibold text-ink">{qaScope === 'white' ? '白底图质检' : '全图合规检测'}</span></li>
          </ul>
        </div>
        {(localError || catalogError) && <p className="text-xs leading-relaxed text-bad">{localError || catalogError}</p>}
        <button type="button" onClick={submit} disabled={!ready} className="btn-primary w-full px-6 py-4 text-base">
          <Rocket className="h-5 w-5" />
          生成go！
        </button>
        <button type="button" onClick={onBack} className="btn-ghost w-full px-5 py-2.5 text-sm">
          <ArrowLeft className="h-4 w-4" />
          上一步
        </button>
      </div>
    </div>
  );
}
