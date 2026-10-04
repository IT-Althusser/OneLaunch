import { useEffect, useState } from 'react';
import { fetchModelCatalog } from '../api/client';
import type { ModelCatalog, ModelSelection } from '../types';

const DEFAULT_SELECTION: ModelSelection = { imageModel: '', editModel: '', textModel: '', visionModel: '', editGateway: 'default' };

/** 清单可用时优先保留用户选择；否则回退到已验证项，再回退到第一项。 */
function pickModel(options: { id: string; verified: boolean }[], current: string): string {
  if (options.some((o) => o.id === current)) return current;
  const verified = options.find((o) => o.verified);
  return (verified ?? options[0])?.id ?? current;
}

/** 网关模型清单加载 + 选择校准（落地页期间预取，进入外壳即可用）。 */
export function useModelCatalog() {
  const [catalog, setCatalog] = useState<ModelCatalog | null>(null);
  const [selection, setSelection] = useState<ModelSelection>(DEFAULT_SELECTION);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchModelCatalog()
      .then((c) => {
        setCatalog(c);
        // 网关清单可用时，把选择校准到真实存在的模型（默认项优先已验证）
        // 图生图模型清单跟随当前路由档位：默认档校准主网关清单，自定义档校准独立网关清单
        setSelection((previous) => {
          const prev = c.defaults ?? previous;
          const editOptions = previous.editGateway === 'custom' && c.editToImage?.length ? c.editToImage : c.imageToImage;
          return ({
            imageModel: pickModel(c.textToImage, prev.imageModel),
            editModel: pickModel(editOptions, prev.editModel),
            textModel: pickModel(c.text, prev.textModel),
            visionModel: pickModel(c.vision, prev.visionModel),
            editGateway: previous.editGateway,
          });
        });
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  return { catalog, selection, setSelection, error };
}
