import { useEffect, useRef, useState } from 'react';
import { streamImagePipeline, regenerateSingle, complianceCheck } from '../api/client';
import { imageTypesForPlatform, type GeneratedImage, type ImagePipelineInput, type ImagePipelineResult, type ImageSlotState, type ImageType, type ModelSelection, type QaRecord, type SlotBrief, type ThinkingLogLine } from '../types';
import { formatProfile, mergeQa, nowTime, str } from '../lib/format';

const slotKey = (platform: string, type: string) => `${platform}||${type}`;

/** 平台默认投放市场（与后端 ImagePipelineService.marketForPlatform 一致）：槽位重生成自动复检用 */
function marketForPlatform(platform: string): string {
  switch (platform) {
    case 'TikTok Shop': case 'Shopee': return '东南亚';
    case 'Temu': return '欧盟';
    default: return 'US';
  }
}

interface RegenTarget {
  platform: string;
  type: string;
  mode: 'regen' | 'edit';
}

/**
 * 五图流水线状态机（SSE）：槽位实时状态 + 思考日志 + QA + 单图重生成/修改与自动复检。
 * 从旧 StudioView 原样抽出，行为保持一致：
 * - 挂载即启动流式任务，StrictMode 下 ref 保证只启动一次
 * - onSlotIndex：把已完成槽位摘要上报给外壳（工具工作台据此带入当前图）
 * - slotUpdate：单图工具工作台「应用回槽位」的更新指令（seq 守卫）
 */
export function usePipeline({
  input,
  models,
  onSlotIndex,
  slotUpdate,
  onSlotUpdateConsumed,
  onRunningChange,
}: {
  input: ImagePipelineInput;
  models: ModelSelection;
  onSlotIndex?: (index: Record<string, SlotBrief>) => void;
  slotUpdate?: { key: string; image: GeneratedImage; prompt: string; seq: number } | null;
  onSlotUpdateConsumed?: () => void;
  onRunningChange?: (running: boolean) => void;
}) {
  const startedRef = useRef(false);
  const [logs, setLogs] = useState<ThinkingLogLine[]>([{ text: '任务已提交，等待网关响应…', time: nowTime() }]);
  const [profile, setProfile] = useState('');
  const [result, setResult] = useState<ImagePipelineResult | null>(null);
  const [fatal, setFatal] = useState('');
  const [running, setRunning] = useState(true);
  const [startedAt] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [imageWorkComplete, setImageWorkComplete] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [editorError, setEditorError] = useState('');

  const platforms = input.platforms.length > 0 ? input.platforms : ['Amazon'];
  const typeMap = imageTypesForPlatform(platforms);
  const refs = input.referenceImages ?? [];

  const [slots, setSlots] = useState<Record<string, ImageSlotState>>(() => {
    const initial: Record<string, ImageSlotState> = {};
    for (const platform of platforms) {
      for (const type of typeMap[platform]) initial[slotKey(platform, type)] = { status: 'pending' };
    }
    return initial;
  });

  const totalSlots = Object.keys(slots).length;
  const doneCount = Object.values(slots).filter((s) => s.status === 'done').length;

  useEffect(() => {
    // 任务结束（完成/失败/中断）即停表，避免「已完成」后耗时仍走动
    if (!running || imageWorkComplete) return;
    const timer = setInterval(() => setElapsed(Date.now() - startedAt), 1000);
    return () => clearInterval(timer);
  }, [running, imageWorkComplete, startedAt]);

  useEffect(() => {
    onRunningChange?.(running);
  }, [running, onRunningChange]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    streamImagePipeline(input, (event, data) => {
      const key = slotKey(str(data.platform, 'Amazon'), str(data.type));
      switch (event) {
        case 'log':
          setLogs((prev) => [...prev, { text: str(data.text, ''), time: nowTime() }]);
          break;
        case 'profile':
          setProfile(formatProfile(str(data.text)));
          break;
        case 'image_start':
          setSlots((prev) => ({ ...prev, [key]: { ...prev[key], status: 'running', prompt: str(data.prompt), error: undefined } }));
          break;
        case 'image_done':
          setSlots((prev) => ({
            ...prev,
            [key]: { ...prev[key], status: 'done', url: str(data.url), size: str(data.size), prompt: str(data.prompt, str(prev[key]?.prompt)), error: undefined },
          }));
          break;
        case 'image_fail':
          setSlots((prev) => ({ ...prev, [key]: { ...prev[key], status: 'failed', error: str(data.error, '生成失败') } }));
          break;
        case 'qa':
          setResult((prev) => {
            const record = data as unknown as QaRecord;
            const state = prev ?? { steps: [], images: [], qa: [] };
            return { ...state, qa: mergeQa([...state.qa, record]) };
          });
          break;
        case 'compliance_complete':
          {
            // 图片生产与逐图合规结束：停表并提示详情页转后台；结果留在本页查看
            setImageWorkComplete(true);
            setElapsed(Date.now() - startedAt);
            setLogs((prev) => [...prev, { text: '—— 图片生成与合规检测完成，详情页转入后台编排 ——', time: nowTime() }]);
          }
          break;
        case 'done':
          {
            const finalResult = data as unknown as ImagePipelineResult;
            setResult({ ...finalResult, qa: mergeQa(finalResult.qa ?? []) });
          }
          setRunning(false);
          setElapsed(Date.now() - startedAt);
          setLogs((prev) => [...prev, { text: '—— 任务完成 ——', time: nowTime() }]);
          break;
        case 'fatal':
          setFatal(str(data.error, '任务失败'));
          setRunning(false);
          setElapsed(Date.now() - startedAt);
          setLogs((prev) => [...prev, { text: `任务失败：${str(data.error, '')}`, time: nowTime() }]);
          break;
        default:
          break;
      }
    }).catch((e: unknown) => {
      setFatal((e as Error).message);
      setRunning(false);
      setElapsed(Date.now() - startedAt);
      setLogs((prev) => [...prev, { text: `连接失败：${(e as Error).message}`, time: nowTime() }]);
    });
    // 流式任务与挂载一一对应，input/models 均在挂载时固定
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 槽位重生成后的自动合规复检：与流水线 QA 同口径（同 prompt、P3 参考图、productFacts 拼接一致），结果按槽位覆盖 QA 记录 */
  async function recheckSlot(target: RegenTarget, imageUrl: string) {
    try {
      setLogs((prev) => [...prev, { text: `质检 Agent：正在复检 ${target.type}（${target.platform}）…`, time: nowTime() }]);
      const checked = await complianceCheck({
        imageUrl,
        imageType: target.type as ImageType,
        platform: target.platform,
        market: marketForPlatform(target.platform),
        visionModel: models.visionModel,
        productFacts: [input.productName, input.sellingPoints].filter(Boolean).join('；') || undefined,
        referenceImageUrl: input.referenceImages?.[0],
      });
      const record: QaRecord = {
        platform: target.platform,
        type: target.type as ImageType,
        url: imageUrl,
        passed: checked.passed,
        status: checked.passed ? 'passed' : 'failed',
        comment: checked.summary,
        issues: checked.issues,
        model: checked.model,
        suggestedPrompt: checked.suggestedPrompt,
        market: marketForPlatform(target.platform),
        complianceIssues: checked.complianceIssues,
        passReasons: checked.passReasons,
      };
      setResult((prev) => {
        const state = prev ?? { steps: [], images: [], qa: [] };
        return { ...state, qa: mergeQa([...state.qa, record]) };
      });
      setLogs((prev) => [...prev, { text: checked.passed
        ? `✓ 复检通过（${target.platform} · ${target.type}）：${checked.summary}`
        : `△ 复检未通过（${target.platform} · ${target.type}），可在质检摘要按修复指令处理`, time: nowTime() }]);
    } catch (e) {
      setLogs((prev) => [...prev, { text: `✗ 复检失败：${(e as Error).message}`, time: nowTime() }]);
    }
  }

  async function runSingle(target: RegenTarget, prompt: string, sourceUrl?: string) {
    const key = slotKey(target.platform, target.type);
    setBusyKey(key);
    setEditorError('');
    setLogs((prev) => [...prev, { text: sourceUrl ? `正在基于当前图修改：${target.type}（${target.platform}）…` : `正在重新生成：${target.type}（${target.platform}）…`, time: nowTime() }]);
    try {
      const image = await regenerateSingle({
        type: target.type as ImageType,
        prompt,
        platform: target.platform,
        referenceImages: sourceUrl ? undefined : (refs.length > 0 ? refs : undefined),
        sourceUrl,
        model: sourceUrl ? models.editModel : (refs.length > 0 ? models.editModel : models.imageModel),
        editGateway: models.editGateway,
      });
      setSlots((prev) => ({ ...prev, [key]: { ...prev[key], status: 'done', url: image.url, size: image.size, prompt, error: undefined } }));
      setLogs((prev) => [...prev, { text: `✓ ${target.type}（${target.platform}）已更新 · ${image.size}`, time: nowTime() }]);
      // 生成完毕自动复检（含 P3 本体一致性检验）：与流水线 QA 同一判定口径
      void recheckSlot(target, image.url);
    } catch (e) {
      const message = (e as Error).message;
      setEditorError(message);
      setLogs((prev) => [...prev, { text: `✗ ${target.type} 更新失败：${message}`, time: nowTime() }]);
    } finally {
      setBusyKey(null);
    }
  }

  // 已完成槽位摘要上报（外壳的单图工具工作台据此带入当前图）
  const slotIndexRef = useRef(onSlotIndex);
  slotIndexRef.current = onSlotIndex;
  useEffect(() => {
    const index: Record<string, SlotBrief> = {};
    for (const [key, s] of Object.entries(slots)) {
      if (s.status === 'done' && s.url) {
        const [platform, type] = key.split('||');
        index[key] = { key, type: type as ImageType, platform, url: s.url, size: s.size ?? '', prompt: s.prompt ?? '' };
      }
    }
    slotIndexRef.current?.(index);
  }, [slots]);

  // 单图工具工作台「应用回槽位」指令
  const lastUpdateSeq = useRef(0);
  useEffect(() => {
    if (!slotUpdate || slotUpdate.seq === lastUpdateSeq.current) return;
    lastUpdateSeq.current = slotUpdate.seq;
    const { key, image, prompt } = slotUpdate;
    setSlots((prev) => ({ ...prev, [key]: { ...prev[key], status: 'done', url: image.url, size: image.size, prompt, error: undefined } }));
    setLogs((prev) => [...prev, { text: `✓ ${image.type}（${image.platform}）已在工作台更新 · ${image.size}`, time: nowTime() }]);
    onSlotUpdateConsumed?.();
    // 仅响应应用指令序号变化
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotUpdate?.seq]);

  return {
    platforms, typeMap, refs, slots, totalSlots, doneCount,
    logs, profile, result, fatal, running, elapsed, imageWorkComplete,
    busyKey, editorError, setEditorError, runSingle,
    currentQa: (result?.qa ?? []).filter((q) => Object.values(slots).some((s) => s.url === q.url)),
    currentImages: Object.entries(slots)
      .filter(([, s]) => s.url)
      .map(([key, s]) => ({ platform: key.split('||')[0], type: key.split('||')[1] as ImageType, url: s.url!, size: s.size ?? '' })),
  };
}
