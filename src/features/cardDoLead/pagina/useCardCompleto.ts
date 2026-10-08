// src/features/cardDoLead/pagina/useCardCompleto.ts
// Carrega o card da página "card completo" pelo endereço (F5 e link colado
// funcionam). Recarregar em silêncio (depois de mover, arquivar, mudar a
// situação) mantém a tela; só a primeira carga mostra esqueleto ou erro.
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { PipelineItem, PipelineItemDetail } from '@/types/analytics';
import { buscarCardPeloId } from '../buscarCard';

export type EstadoDoCardCompleto =
  | { estado: 'carregando' }
  | { estado: 'sem-acesso' }
  | { estado: 'erro' }
  | { estado: 'pronto'; dados: PipelineItemDetail };

export function useCardCompleto(pipelineId: string | undefined, itemId: string | undefined) {
  const [estado, setEstado] = useState<EstadoDoCardCompleto>({ estado: 'carregando' });
  // Resposta de um pedido velho não sobrescreve a do novo.
  const pedido = useRef(0);

  const carregar = useCallback(async (silencioso: boolean) => {
    if (!pipelineId || !itemId) {
      setEstado({ estado: 'sem-acesso' });
      return;
    }
    const meu = ++pedido.current;
    if (!silencioso) setEstado({ estado: 'carregando' });
    const r = await buscarCardPeloId(pipelineId, itemId);
    if (meu !== pedido.current) return;
    if (r.tipo === 'achou') setEstado({ estado: 'pronto', dados: r.card });
    else if (r.tipo === 'sem-acesso') setEstado({ estado: 'sem-acesso' });
    else if (silencioso) toast.error('Não consegui atualizar o card. O que está na tela pode estar desatualizado.');
    else setEstado({ estado: 'erro' });
  }, [pipelineId, itemId]);

  useEffect(() => {
    void carregar(false);
  }, [carregar]);

  const tentarDeNovo = useCallback(() => carregar(false), [carregar]);
  const recarregar = useCallback(() => carregar(true), [carregar]);
  const atualizarItem = useCallback((campos: Partial<PipelineItem>) => {
    setEstado(e => (e.estado === 'pronto'
      ? { estado: 'pronto', dados: { ...e.dados, item: { ...e.dados.item, ...campos } } }
      : e));
  }, []);

  return { estado, tentarDeNovo, recarregar, atualizarItem };
}
