// src/features/followup/useColocarEmFollowup.tsx
// Quem abre a janela "Colocar em follow-up" (Fase 2, 20/10/2026). A porta chama
// `abrir(lead, { aoConfirmar, aoCancelar })` e põe `janela` na tela; a janela
// faz o pedido e avisa o fim. Cancelar (botão, X ou Esc) = nada foi pedido, e a
// porta desfaz o que mostrou (o card volta, a etapa volta).
import { useCallback, useState, type ReactNode } from 'react';
import type { RefDoLead } from '@/services/flowAutomations/flowAutomationInstancesService';
import JanelaColocarEmFollowup, { type ResultadoDoFollowup } from './JanelaColocarEmFollowup';

export interface OpcoesDaJanelaDeFollowup {
  /** O follow-up começou (ou o lead já estava nele): a porta recarrega. */
  aoConfirmar?: (resultado: ResultadoDoFollowup) => void;
  /** Fechou sem iniciar: a porta devolve o card/etapa ao que era. */
  aoCancelar?: () => void;
}

export function useColocarEmFollowup(): {
  abrir: (lead: RefDoLead, opcoes?: OpcoesDaJanelaDeFollowup) => void;
  janela: ReactNode;
} {
  const [pedido, setPedido] = useState<{ lead: RefDoLead; opcoes: OpcoesDaJanelaDeFollowup; chave: number } | null>(null);

  const abrir = useCallback((lead: RefDoLead, opcoes?: OpcoesDaJanelaDeFollowup) => {
    setPedido(p => ({ lead, opcoes: opcoes ?? {}, chave: (p?.chave ?? 0) + 1 }));
  }, []);

  const janela = pedido ? (
    <JanelaColocarEmFollowup
      key={pedido.chave}
      lead={pedido.lead}
      aoCancelar={() => {
        setPedido(null);
        pedido.opcoes.aoCancelar?.();
      }}
      aoConcluir={resultado => {
        setPedido(null);
        pedido.opcoes.aoConfirmar?.(resultado);
      }}
    />
  ) : null;

  return { abrir, janela };
}
