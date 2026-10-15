// Mais cards de uma coluna ao rolar (quadro em lotes, spec 2026-10-15). Pede a
// partir do que já está carregado, junta sem repetir, e joga fora a página que
// chegar depois de a aba, a busca ou um filtro mudar.
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { pipelinesService } from '@/services/pipelines';
import type { BoardQueryParams, PipelineStage } from '@/types/analytics';
import { POR_COLUNA, juntarSemRepetir } from './paramsDoQuadro';

interface Opcoes {
  pipelineId: string | undefined;
  params: BoardQueryParams;
  assinatura: string;
  setStages: Dispatch<SetStateAction<PipelineStage[]>>;
}

export function useMaisCardsDaColuna({ pipelineId, params, assinatura, setStages }: Opcoes) {
  const [carregando, setCarregando] = useState<Record<string, boolean>>({});
  const [erro, setErro] = useState<Record<string, boolean>>({});
  const emVoo = useRef(new Set<string>());
  // Coluna cuja última página não trouxe card novo: id -> quantos cards tinha. Sem isto o
  // fim da coluna pediria a mesma página pra sempre. Só o clique da pessoa (manual) tenta de
  // novo; a marca também cai sozinha se a contagem da coluna mudar (recarga, arraste).
  const esgotadas = useRef(new Map<string, number>());
  const assinaturaRef = useRef(assinatura);
  const paramsRef = useRef(params);
  paramsRef.current = params;

  useEffect(() => {
    assinaturaRef.current = assinatura;
    emVoo.current.clear();
    esgotadas.current.clear();
    setCarregando({});
    setErro({});
  }, [assinatura]);

  const carregarMais = useCallback((stage: PipelineStage, opcoes?: { manual?: boolean }) => {
    const id = String(stage.id);
    const ja = stage.items?.length ?? 0;
    if (!pipelineId || emVoo.current.has(id) || ja >= (stage.items_total ?? 0)) return;
    if (opcoes?.manual) esgotadas.current.delete(id);
    else if (esgotadas.current.get(id) === ja) return;
    else esgotadas.current.delete(id);
    emVoo.current.add(id);
    const minha = assinaturaRef.current;
    setCarregando(c => ({ ...c, [id]: true }));
    setErro(e => ({ ...e, [id]: false }));
    pipelinesService.getBoardItems(pipelineId, paramsRef.current, { stageId: id, offset: ja, limit: POR_COLUNA })
      .then(pagina => {
        if (minha !== assinaturaRef.current) return;
        if (juntarSemRepetir(stage.items ?? [], pagina.items).length <= ja) esgotadas.current.set(id, ja);
        setStages(prev => prev.map(s => (String(s.id) !== id ? s : {
          ...s, items: juntarSemRepetir(s.items ?? [], pagina.items), items_total: pagina.total,
        })));
      })
      .catch(() => { if (minha === assinaturaRef.current) setErro(e => ({ ...e, [id]: true })); })
      .finally(() => {
        if (minha !== assinaturaRef.current) return;
        emVoo.current.delete(id);
        setCarregando(c => ({ ...c, [id]: false }));
      });
  }, [pipelineId, setStages]);

  return { carregando, erro, carregarMais };
}
