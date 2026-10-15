// src/pages/Customer/Pipelines/quadro/usePipelineFilters.ts
// A aba e os filtros do quadro, lidos e gravados no ENDEREÇO (spec funil
// §4.3): F5 mantém, link mandado abre igual, ?card= e ?etapa= passam intactos.
// Trocar de aba entra no histórico (o Voltar volta de aba); filtro não. A busca
// fica só na tela.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { PipelineStage } from '@/types/analytics';
import { FILTROS_VAZIOS, escreverNoEndereco, lerAba, lerFiltros, type AbaDoQuadro, type FiltrosDoFunil } from './enderecoDoQuadro';
import { colunasVisiveis, contarFiltros } from './filtrosDoFunil';

/** A busca só vai pro servidor depois que a pessoa para de digitar. */
export const ESPERA_DA_BUSCA_MS = 400;

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

  const [buscaAplicada, setBuscaAplicada] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setBuscaAplicada(busca.trim()), ESPERA_DA_BUSCA_MS);
    return () => clearTimeout(t);
  }, [busca]);

  const filteredStages = useMemo(() => colunasVisiveis(stages, filtros.colunas), [stages, filtros.colunas]);
  const totalVisivel = useMemo(
    () => filteredStages.reduce((n, s) => n + (s.items_total ?? s.items?.length ?? 0), 0),
    [filteredStages],
  );

  return {
    aba,
    setAba,
    filtros,
    aplicar,
    limpar,
    busca,
    setBusca,
    buscaAplicada,
    filteredStages,
    totalVisivel,
    quantosFiltros: contarFiltros(filtros, aba),
  };
}
