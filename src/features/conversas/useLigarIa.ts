import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { chatService } from '@/services/chat/chatService';
import { salesAgentsService, type SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { apiErrorMessage } from '@/utils/apiHelpers';
import type { SalesAgentCardState } from '@/types/analytics/pipelines';
import type { Conversation } from '@/types/chat/api';

// Ligar a IA num lead (fase 2, C81), igual no menu da conversa, no robô do topo e no
// cartão do funil: lista os agentes do NÚMERO da conversa (o servidor decide e ordena);
// com mais de um, a pessoa escolhe qual volta a atender; com um, liga direto.

export interface JanelaDeLigarIa {
  agentes: SalesAgent[];
  open: boolean;
  /** O agente que já está na conversa, vem marcado. */
  atual: string | null;
  salvando: boolean;
  /** A recusa do servidor, como veio. */
  erro: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirmar: (agenteId: string) => void;
}

interface Opcoes {
  /** O estado novo da IA depois de ligar (cada tela atualiza o que é dela). */
  aoLigar: (conversationId: string, state: SalesAgentCardState) => void;
  /** A frase de quando o servidor não explica o erro. */
  erroPadrao?: string;
}

export function useLigarIa({ aoLigar, erroPadrao = 'Não consegui mudar a IA neste lead.' }: Opcoes) {
  const [procurando, setProcurando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [escolha, setEscolha] = useState<{ id: string; agentes: SalesAgent[]; atual: string | null } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  /** Liga a IA na conversa; `conversa` poupa a busca quando a tela já a tem. */
  const pedirLigar = useCallback(async (conversationId: string, conversa?: Pick<Conversation, 'inbox_id' | 'additional_attributes'> | null) => {
    setProcurando(true);
    try {
      const c = conversa ?? (await Promise.resolve().then(() => chatService.getConversation(conversationId)).then(r => r.data).catch(() => null));
      const agentes = c?.inbox_id ? await salesAgentsService.listForInbox(String(c.inbox_id)).catch(() => []) : [];
      if (agentes.length > 1) {
        const grudado = c?.additional_attributes?.sales_agent_id;
        setErro(null);
        setEscolha({ id: conversationId, agentes, atual: grudado != null ? String(grudado) : null });
        return;
      }
      aoLigar(conversationId, await chatService.toggleSalesAgent(conversationId, true));
    } catch (e) {
      toast.error(apiErrorMessage(e, erroPadrao));
    } finally {
      setProcurando(false);
    }
  }, [aoLigar, erroPadrao]);

  const confirmar = useCallback(async (agenteId: string) => {
    if (!escolha) return;
    setSalvando(true);
    setErro(null);
    try {
      const state = await chatService.toggleSalesAgent(escolha.id, true, agenteId);
      setEscolha(null);
      aoLigar(escolha.id, state);
    } catch (e) {
      setErro(apiErrorMessage(e, erroPadrao));
    } finally {
      setSalvando(false);
    }
  }, [escolha, aoLigar, erroPadrao]);

  const janela: JanelaDeLigarIa = {
    agentes: escolha?.agentes ?? [],
    open: escolha !== null,
    atual: escolha?.atual ?? null,
    salvando,
    erro,
    onOpenChange: v => { if (!v) { setEscolha(null); setErro(null); } },
    onConfirmar: id => void confirmar(id),
  };
  return { pedirLigar, procurando, janela };
}
