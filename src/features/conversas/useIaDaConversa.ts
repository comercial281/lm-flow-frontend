import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { chatService } from '@/services/chat/chatService';
import { apiErrorMessage } from '@/utils/apiHelpers';
import type { SalesAgentCardState } from '@/types/analytics/pipelines';

import { EVENTO_IA_MUDOU, avisarIaMudou, iaLigada, type IaMudouDetalhe } from './atalhosDoLead';

/**
 * A IA Vendedora NESTA conversa: o estado e o liga/desliga. Usado pelo robô do
 * topo da conversa e pelo dos atalhos do painel do lead; quem troca avisa o
 * outro (`lmflow:ia-mudou`).
 *
 * Liga/desliga pelo POST /conversations/:id/sales_agent (pedido do Giovani,
 * 19/08) em vez de escrever additional_attributes na mão: o endpoint também
 * limpa sales_agent_handoff ao religar, senão uma conversa que a IA passou pra
 * um corretor ficaria travada mentindo que ainda está em transferência (ver
 * SalesAgents::ConversationState).
 */
export function useIaDaConversa(conversationId: string | number | null | undefined) {
  const id = conversationId != null ? String(conversationId) : null;
  // Cada estado guarda de qual conversa ele é: logo depois da troca, o da
  // anterior ainda está aqui e não pode aparecer nem por um quadro.
  const [atual, setAtual] = useState<{ de: string | null; state: SalesAgentCardState | null }>({
    de: null,
    state: null,
  });
  const [trocando, setTrocando] = useState(false);
  const idAtual = useRef(id);
  idAtual.current = id;

  useEffect(() => {
    if (!id) return;
    let vivo = true;
    chatService
      .getSalesAgentStatus(id)
      .then(r => { if (vivo) setAtual({ de: id, state: r.state }); })
      .catch(() => { if (vivo) setAtual({ de: id, state: null }); });
    return () => { vivo = false; };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const ouvir = (e: Event) => {
      const detalhe = (e as CustomEvent<IaMudouDetalhe>).detail;
      if (detalhe?.conversationId === id) setAtual({ de: id, state: detalhe.state });
    };
    window.addEventListener(EVENTO_IA_MUDOU, ouvir);
    return () => window.removeEventListener(EVENTO_IA_MUDOU, ouvir);
  }, [id]);

  const estado = atual.de === id ? atual.state : null;
  const ligada = iaLigada(estado);

  const trocar = useCallback(async () => {
    if (!id) return;
    const pedida = id;
    const proximo = !ligada;
    setTrocando(true);
    try {
      const state = await chatService.toggleSalesAgent(pedida, proximo);
      avisarIaMudou(pedida, state);
      if (pedida === idAtual.current) setAtual({ de: pedida, state });
      toast.success(proximo ? 'IA reativada nesta conversa' : 'IA desativada nesta conversa');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Não consegui mudar o status da IA'));
    } finally {
      setTrocando(false);
    }
  }, [id, ligada]);

  return { estado, ligada, trocando, trocar };
}
