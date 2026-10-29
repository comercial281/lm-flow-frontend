import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { chatService } from '@/services/chat/chatService';
import { apiErrorMessage } from '@/utils/apiHelpers';
import type { SalesAgentCardState } from '@/types/analytics/pipelines';

import {
  EVENTO_IA_MUDOU,
  EVENTO_IA_RECARREGAR,
  avisarIaMudou,
  iaLigada,
  type IaMudouDetalhe,
  type IaRecarregarDetalhe,
} from './atalhosDoLead';

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
  // Três escritas disputam `atual` (busca, recarga, troca/aviso do outro robô):
  // vale o pedido mais recente. Cada escrita incrementa; GET que volta depois
  // de outra escrita não aplica (senão o estado velho cobre o que acabou de mudar).
  const pedido = useRef(0);

  // Busca o estado e devolve o "desfazer" (conversa trocada = resposta atrasada descartada).
  const buscar = useCallback((alvo: string) => {
    let vivo = true;
    const meu = ++pedido.current;
    chatService
      .getSalesAgentStatus(alvo)
      .then(r => { if (vivo && meu === pedido.current) setAtual({ de: alvo, state: r.state }); })
      .catch(() => { if (vivo && meu === pedido.current) setAtual({ de: alvo, state: null }); });
    return () => { vivo = false; };
  }, []);

  useEffect(() => {
    if (!id) return;
    return buscar(id);
  }, [id, buscar]);

  // A linha de atividade da IA chegou no chat ao vivo: o estado mudou no servidor.
  useEffect(() => {
    if (!id) return;
    let desfazer: (() => void) | undefined;
    const ouvir = (e: Event) => {
      const detalhe = (e as CustomEvent<IaRecarregarDetalhe>).detail;
      if (detalhe?.conversationId !== id) return;
      desfazer?.();
      desfazer = buscar(id);
    };
    window.addEventListener(EVENTO_IA_RECARREGAR, ouvir);
    return () => {
      window.removeEventListener(EVENTO_IA_RECARREGAR, ouvir);
      desfazer?.();
    };
  }, [id, buscar]);

  useEffect(() => {
    if (!id) return;
    const ouvir = (e: Event) => {
      const detalhe = (e as CustomEvent<IaMudouDetalhe>).detail;
      if (detalhe?.conversationId !== id) return;
      pedido.current += 1;
      setAtual({ de: id, state: detalhe.state });
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
      // Só conta como escrita se ainda é a mesma conversa: senão derrubaria a busca da conversa nova.
      if (pedida === idAtual.current) {
        pedido.current += 1;
        setAtual({ de: pedida, state });
      }
      toast.success(proximo ? 'IA reativada nesta conversa' : 'IA desativada nesta conversa');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Não consegui mudar o status da IA'));
    } finally {
      setTrocando(false);
    }
  }, [id, ligada]);

  return { estado, ligada, trocando, trocar };
}
