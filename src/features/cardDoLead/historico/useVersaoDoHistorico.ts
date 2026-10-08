// src/features/cardDoLead/historico/useVersaoDoHistorico.ts
//
// A chave que manda o HistoricoDoLead recarregar do começo. Muda quando:
//   - alguém pede (roleta, oferta aceita, visita criada, contato corrigido,
//     troca de responsável feita dentro do card — quem troca chama o
//     recarregarHistorico, porque ali o `assignee` do card não muda);
//   - a sessão de Tarefas avisa que uma tarefa mudou (EVENTO_TAREFAS_MUDARAM:
//     criar, concluir ou reabrir tarefa no bloco "Próximas tarefas");
//   - o card que chega muda de etapa, de situação (Ganho/Perdido/Reabrir) ou de
//     responsável (ex.: o card recarregado do servidor ou arrastado no quadro).
// A janela e a página usam a mesma.
import { useCallback, useEffect, useState } from 'react';
import { EVENTO_TAREFAS_MUDARAM } from '@/features/tarefas/tarefasService';
import type { PipelineItem } from '@/types/analytics';

type CardParaVersao = Pick<PipelineItem, 'stage_id' | 'status' | 'assignee'>;

export function useVersaoDoHistorico(item: CardParaVersao | null | undefined) {
  const [pedidos, setPedidos] = useState(0);
  const recarregarHistorico = useCallback(() => setPedidos(n => n + 1), []);

  useEffect(() => {
    const f = () => setPedidos(n => n + 1);
    window.addEventListener(EVENTO_TAREFAS_MUDARAM, f);
    return () => window.removeEventListener(EVENTO_TAREFAS_MUDARAM, f);
  }, []);

  const versaoHistorico = [pedidos, item?.stage_id ?? '', item?.status ?? '', item?.assignee?.id ?? ''].join('|');
  return { versaoHistorico, recarregarHistorico };
}
