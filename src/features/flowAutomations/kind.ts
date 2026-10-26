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

// Funis de mensagem tem UM título e UM subtítulo nas duas abas (Manual e
// Follow-up), 22/10/2026. Quem troca de aba muda a lista, não a página.
const FUNIS_DE_MENSAGEM_TITULO = 'Funis de mensagem';
const FUNIS_DE_MENSAGEM_DESCRICAO =
  'Sequências de mensagens prontas. As manuais você dispara numa conversa; o follow-up vai atrás do lead que parou de responder.';

export const FLOW_KIND_COPY: Record<FlowAutomationKind, FlowKindCopy> = {
  automation: {
    listPath: '/automations/flow-builder',
    title: 'Automações',
    description:
      'Cada fluxo começa quando algo acontece com o lead e segue os blocos: manda mensagem, avisa a equipe, espera a resposta e decide o que fazer em cada caso.',
    newButton: 'Nova automação',
    newName: 'Novo fluxo',
    emptyTitle: 'Nenhum fluxo ainda',
    emptyDescription:
      'Comece por um modelo: ele cria o fluxo desligado, você ajusta os textos e liga. Ou crie um fluxo do zero em Novo fluxo.',
    searchPlaceholder: 'Buscar fluxo...',
  },
  // Fase 3 (21/10/2026): a lista é a aba Follow-up de Funis de mensagem (lista
  // própria, ListaDeFollowups, em seções Da equipe · Meus · Dos corretores). O
  // endereço continua o mesmo: link salvo e redirecionamento antigo valem.
  followup: {
    listPath: '/automations/follow-ups',
    title: FUNIS_DE_MENSAGEM_TITULO,
    description: FUNIS_DE_MENSAGEM_DESCRICAO,
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
    title: FUNIS_DE_MENSAGEM_TITULO,
    description: FUNIS_DE_MENSAGEM_DESCRICAO,
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
