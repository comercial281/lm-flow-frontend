// src/features/cardDoLead/pagina/useCardCompleto.ts
// Carrega o card da página "card completo" pelo endereço (F5 e link colado
// funcionam). Recarregar em silêncio (depois de mover, arquivar, mudar a
// situação) mantém a tela; só a primeira carga mostra esqueleto ou erro.
// Voltar para a guia recarrega em silêncio: o card pode ter mudado no quadro,
// em outra guia (selo, faixa e rodapé velhos até o F5).
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

  const carregar = useCallback(async (silencioso: boolean, avisarFalha = true) => {
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
    else if (silencioso) {
      if (avisarFalha) toast.error('Não consegui atualizar o card. O que está na tela pode estar desatualizado.');
    }
    else setEstado({ estado: 'erro' });
  }, [pipelineId, itemId]);

  useEffect(() => {
    void carregar(false);
  }, [carregar]);

  // Só recarrega o card já na tela (a primeira carga e o erro têm o próprio caminho).
  const pronto = estado.estado === 'pronto';
  useEffect(() => {
    if (!pronto) return;
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') void carregar(true, false);
    };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => document.removeEventListener('visibilitychange', aoVoltar);
  }, [pronto, carregar]);

  const tentarDeNovo = useCallback(() => carregar(false), [carregar]);
  const recarregar = useCallback(() => carregar(true), [carregar]);
  const atualizarItem = useCallback((campos: Partial<PipelineItem>) => {
    setEstado(e => (e.estado === 'pronto'
      ? { estado: 'pronto', dados: { ...e.dados, item: { ...e.dados.item, ...campos } } }
      : e));
  }, []);

  return { estado, tentarDeNovo, recarregar, atualizarItem };
}
