// src/pages/Customer/Pipelines/quadro/useFacetasDoQuadro.ts
// Opções de Origem e Responsável do painel de filtros: a aba inteira, do
// servidor (com os cards em lotes, os carregados não bastam). Só pede com o
// painel aberto; erro nunca vira lista vazia.
import { useCallback, useEffect, useState } from 'react';
import { pipelinesService } from '@/services/pipelines';
import type { BoardFacets, PipelineBoardStatus } from '@/types/analytics';

export function useFacetasDoQuadro(pipelineId: string | undefined, status: PipelineBoardStatus, ativo: boolean) {
  const [facetas, setFacetas] = useState<BoardFacets | null>(null);
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    if (!ativo || !pipelineId) return;
    let vivo = true;
    setFacetas(null);
    setErro(false);
    pipelinesService.getBoardFacets(pipelineId, status)
      .then(f => { if (vivo) setFacetas(f); })
      .catch(() => { if (vivo) setErro(true); });
    return () => { vivo = false; };
  }, [pipelineId, status, ativo, tentativa]);

  const tentarDeNovo = useCallback(() => setTentativa(n => n + 1), []);
  return { facetas, erro, tentarDeNovo };
}
