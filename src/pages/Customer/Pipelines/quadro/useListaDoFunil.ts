// A Lista do funil em lotes (spec 2026-10-15): todas as colunas, por ordem de
// chegada, 30 por vez. Recarga do quadro (versao) relê até onde a pessoa foi.
import { useCallback, useEffect, useRef, useState } from 'react';
import { pipelinesService } from '@/services/pipelines';
import type { BoardQueryParams, PipelineItem } from '@/types/analytics';
import { POR_COLUNA, TETO_DA_RECARGA, juntarSemRepetir } from './paramsDoQuadro';

interface Opcoes {
  pipelineId: string | undefined;
  params: BoardQueryParams;
  assinatura: string;
  ordem: 'asc' | 'desc';
  ativo: boolean;
  versao: number;
}

export function useListaDoFunil({ pipelineId, params, assinatura, ordem, ativo, versao }: Opcoes) {
  const [itens, setItens] = useState<PipelineItem[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(false);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const pedido = useRef(0);
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const itensRef = useRef(itens);
  itensRef.current = itens;
  const sort = ordem === 'asc' ? 'arrival_asc' : 'arrival_desc';
  const chave = `${assinatura}|${sort}`;
  const chaveRef = useRef(chave);

  useEffect(() => {
    if (!ativo || !pipelineId) return;
    const meu = ++pedido.current;
    const mesmaLista = chaveRef.current === chave;
    chaveRef.current = chave;
    const limite = mesmaLista ? Math.min(TETO_DA_RECARGA, Math.max(POR_COLUNA, itensRef.current.length)) : POR_COLUNA;
    if (!mesmaLista) setItens([]);
    setCarregando(!mesmaLista || itensRef.current.length === 0);
    setErro(false);
    pipelinesService.getBoardItems(pipelineId, paramsRef.current, { offset: 0, limit: limite, sort })
      .then(p => { if (meu === pedido.current) { setItens(p.items); setTotal(p.total); } })
      .catch(() => { if (meu === pedido.current) setErro(true); })
      .finally(() => { if (meu === pedido.current) setCarregando(false); });
  }, [pipelineId, chave, sort, ativo, versao, tentativa]);

  const carregarMais = useCallback(() => {
    if (!pipelineId || carregandoMais || itensRef.current.length >= total) return;
    const meu = pedido.current;
    setCarregandoMais(true);
    pipelinesService.getBoardItems(pipelineId, paramsRef.current, { offset: itensRef.current.length, limit: POR_COLUNA, sort })
      .then(p => { if (meu === pedido.current) { setItens(atual => juntarSemRepetir(atual, p.items)); setTotal(p.total); } })
      .catch(() => { if (meu === pedido.current) setErro(true); })
      .finally(() => setCarregandoMais(false));
  }, [pipelineId, carregandoMais, total, sort]);

  const tentarDeNovo = useCallback(() => setTentativa(n => n + 1), []);
  return { itens, total, carregando, carregandoMais, erro, temMais: itens.length < total, carregarMais, tentarDeNovo };
}
