// AUTOMAÇÃO OU FOLLOW-UP (Automações · sprint 3, spec 03/10/2026).
//
// O follow-up usa o MESMO construtor das Automações, numa aba própria. O
// servidor guarda o tipo em `state.kind` (sem migration) e devolve `kind` no
// fluxo; fluxo sem tipo é automação. Tudo que muda entre as duas abas (título,
// endereço, botão de criar) sai daqui.

import type { FlowAutomation, FlowAutomationKind } from '@/types/flowAutomations';

export function kindOf(flow: Pick<FlowAutomation, 'kind' | 'state'> | null | undefined): FlowAutomationKind {
  const raw = flow?.kind ?? flow?.state?.kind;
  if (raw === 'followup' || raw === 'conversation') return raw;
  return 'automation';
}

export interface FlowKindCopy {
  /** Endereço da lista (o canvas fica em `${listPath}/:id`). */
  listPath: string;
  title: string;
  description: string;
  newButton: string;
  newName: string;
  emptyTitle: string;
  emptyDescription: string;
  searchPlaceholder: string;
}

export const FLOW_KIND_COPY: Record<FlowAutomationKind, FlowKindCopy> = {
  automation: {
    listPath: '/automations/flow-builder',
    title: 'Automações',
    description:
      'Cada fluxo começa quando algo acontece com o lead e segue os blocos: manda mensagem, avisa a equipe, espera a resposta e decide o que fazer em cada caso.',
    newButton: 'Novo fluxo',
    newName: 'Novo fluxo',
    emptyTitle: 'Nenhum fluxo ainda',
    emptyDescription:
      'Comece por um modelo: ele cria o fluxo desligado, você ajusta os textos e liga. Ou crie um fluxo do zero em Novo fluxo.',
    searchPlaceholder: 'Buscar fluxo...',
  },
  followup: {
    listPath: '/automations/follow-ups',
    title: 'Follow-up',
    description:
      'Mensagens que vão atrás do lead que parou de responder. Cada follow-up é um fluxo: começa pelo gatilho, manda as mensagens com o tempo entre elas e, quando o lead responde, faz o que você escolher.',
    newButton: 'Novo follow-up',
    newName: 'Novo follow-up',
    emptyTitle: 'Nenhum follow-up ainda',
    emptyDescription:
      'O follow-up novo já vem montado com o modelo "Follow-up padrão": 4 mensagens, a espera da resposta entre elas e o que fazer quando o lead responde. Você troca os textos, os tempos e a coluna, escolhe o gatilho e liga.',
    searchPlaceholder: 'Buscar follow-up...',
  },
  // Sprint 4: o funil de conversa do corretor (página Funis de mensagem). A lista
  // é própria (Meus funis / Da equipe); daqui sai o endereço e os nomes.
  conversation: {
    listPath: '/automations/message-funnels',
    title: 'Funis de mensagem',
    description:
      'Sequências de mensagens que você dispara numa conversa, pelo botão de funil do campo de mensagem. As mensagens saem uma depois da outra, com o tempo de espera entre elas, mesmo com a tela fechada.',
    newButton: 'Novo funil',
    newName: 'Novo funil',
    emptyTitle: 'Nenhum funil ainda',
    emptyDescription: 'Escolha um modelo pronto em "Novo funil": você ajusta os textos com o passo a passo e já pode disparar.',
    searchPlaceholder: 'Buscar funil...',
  },
};

export function flowPath(flow: Pick<FlowAutomation, 'id' | 'kind' | 'state'>): string {
  return `${FLOW_KIND_COPY[kindOf(flow)].listPath}/${flow.id}`;
}
