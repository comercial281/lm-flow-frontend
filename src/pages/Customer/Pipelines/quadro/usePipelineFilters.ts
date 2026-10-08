// src/pages/Customer/Pipelines/quadro/usePipelineFilters.ts
// A aba e os filtros do quadro, lidos e gravados no ENDEREÇO (spec funil
// §4.3): F5 mantém, link mandado abre igual, ?card= e ?etapa= passam intactos.
// Trocar de aba entra no histórico (o Voltar volta de aba); filtro não. A busca
// fica só na tela.
import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { PipelineStage } from '@/types/analytics';
import { FILTROS_VAZIOS, escreverNoEndereco, lerAba, lerFiltros, type AbaDoQuadro, type FiltrosDoFunil } from './enderecoDoQuadro';
import { contarFiltros, filtrarEtapas } from './filtrosDoFunil';

export function usePipelineFilters(stages: PipelineStage[]) {
  const [params, setParams] = useSearchParams();
  const aba = useMemo(() => lerAba(params), [params]);
  const filtros = useMemo(() => lerFiltros(params), [params]);
  const [busca, setBusca] = useState('');

  const setAba = useCallback((nova: AbaDoQuadro) => {
    setParams(atual => escreverNoEndereco(atual, nova, lerFiltros(atual)));
  }, [setParams]);

  const aplicar = useCallback((novos: FiltrosDoFunil) => {
    setParams(atual => escreverNoEndereco(atual, lerAba(atual), novos), { replace: true });
  }, [setParams]);

  const limpar = useCallback(() => aplicar(FILTROS_VAZIOS), [aplicar]);

  const filteredStages = useMemo(() => filtrarEtapas(stages, filtros, busca, aba), [stages, filtros, busca, aba]);
  const totalVisivel = useMemo(() => filteredStages.reduce((n, s) => n + (s.items?.length ?? 0), 0), [filteredStages]);

  return {
    aba,
    setAba,
    filtros,
    aplicar,
    limpar,
    busca,
    setBusca,
    filteredStages,
    totalVisivel,
    quantosFiltros: contarFiltros(filtros, aba),
  };
}
