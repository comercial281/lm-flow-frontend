import { Bot, BotOff, UserCheck } from 'lucide-react';

import type { SalesAgentCardState, SalesAgentCardStatus } from '@/types/analytics/pipelines';

// Robozinho do card: responde "a IA está cuidando deste lead?" de relance.
//
// Antes não havia resposta nenhuma na tela — olhando o kanban, o corretor não
// distinguia o lead que a IA atende do que está parado esperando alguém. O estado
// vem pronto do backend (SalesAgents::ConversationState), a mesma fonte que o
// runner usa pra decidir se responde: se a bolinha discordasse do comportamento
// real, ela seria pior do que não existir.
//
// `idle` e `none` não pintam nada: "tem IA no canal mas o gatilho não bateu" é o
// estado da maioria dos cards num board saudável, e um ícone cinza em tudo vira
// ruído que ninguém lê.

const STYLE: Record<
  Exclude<SalesAgentCardStatus, 'idle' | 'none'>,
  { icon: typeof Bot; className: string }
> = {
  active: { icon: Bot, className: 'text-emerald-600 bg-emerald-500/10' },
  paused: { icon: BotOff, className: 'text-muted-foreground bg-muted' },
  handoff: { icon: UserCheck, className: 'text-blue-600 bg-blue-500/10' },
};

interface Props {
  state?: SalesAgentCardState | null;
  /** `sm` no card do kanban (só o ícone), `md` onde cabe o texto. */
  size?: 'sm' | 'md';
}

export default function SalesAgentBadge({ state, size = 'sm' }: Props) {
  if (!state || state.status === 'idle' || state.status === 'none') return null;

  const style = STYLE[state.status];
  if (!style) return null;

  const Icon = style.icon;

  if (size === 'sm') {
    return (
      <span
        title={state.label}
        aria-label={state.label}
        className={`inline-flex items-center justify-center rounded p-0.5 ${style.className}`}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium ${style.className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {state.label}
    </span>
  );
}
