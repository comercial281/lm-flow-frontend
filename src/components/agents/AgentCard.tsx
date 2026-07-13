import { Button, Card, Badge } from '@/components/ui/ds';
import { MoreHorizontal, Bot } from 'lucide-react';
import { Agent } from '@/types/agents';
import AgentActionsDropdown from './AgentActionsDropdown';

type AgentCardProps = {
  agent: Agent;
  onEdit: (agent: Agent) => void;
  onDelete: (agent: Agent) => void;
  onExportAsJSON?: (agent: Agent) => void;
  onShare?: (agent: Agent) => void;
};

// Cada tipo de agente tem sua cor — usada no badge e no glow do ícone.
const TYPE_STYLES: Record<string, { badge: string; glow: string }> = {
  llm: { badge: 'border-green-500/40 text-green-400 bg-green-500/10', glow: 'rgba(34,197,94,0.16)' },
  a2a: { badge: 'border-blue-500/40 text-blue-400 bg-blue-500/10', glow: 'rgba(59,130,246,0.16)' },
  sequential: { badge: 'border-orange-500/40 text-orange-400 bg-orange-500/10', glow: 'rgba(249,115,22,0.16)' },
  parallel: { badge: 'border-violet-500/40 text-violet-400 bg-violet-500/10', glow: 'rgba(124,58,237,0.16)' },
  loop: { badge: 'border-indigo-500/40 text-indigo-400 bg-indigo-500/10', glow: 'rgba(99,102,241,0.16)' },
  default: { badge: 'border-slate-500/40 text-slate-300 bg-slate-500/10', glow: 'rgba(124,58,237,0.16)' },
};

export default function AgentCard({
  agent,
  onEdit,
  onDelete,
  onExportAsJSON,
  onShare,
}: AgentCardProps) {
  const style = TYPE_STYLES[agent.type as keyof typeof TYPE_STYLES] || TYPE_STYLES.default;

  return (
    <Card className="group relative flex flex-col gap-3 p-5 bg-sidebar border-sidebar-border overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-black/10">
      {/* Glow no hover, na cor do tipo */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-10 -right-10 h-28 w-28 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: style.glow }}
      />

      {/* Ícone em quadrado violeta (estilo protótipo) */}
      <div
        className="w-11 h-11 rounded-xl grid place-items-center shrink-0 text-primary relative"
        style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.20), rgba(147,51,234,0.10))' }}
      >
        <Bot className="h-5 w-5" />
      </div>

      {/* Nome + descrição */}
      <div className="relative min-w-0">
        <h4 className="font-semibold text-base truncate text-sidebar-foreground">{agent.name}</h4>
        {agent.description ? (
          <p className="text-xs text-sidebar-foreground/60 line-clamp-2 mt-0.5">{agent.description}</p>
        ) : (
          <p className="text-xs text-sidebar-foreground/40 mt-0.5 italic">Sem descrição</p>
        )}
      </div>

      {/* Rodapé: badge do tipo + Configurar + ações */}
      <div className="relative flex items-center justify-between gap-2 mt-auto pt-1">
        {agent.type ? (
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 ${style.badge}`}>
            {agent.type}
          </Badge>
        ) : <span />}

        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs bg-sidebar border-sidebar-border hover:bg-sidebar-accent"
            onClick={() => onEdit(agent)}
          >
            Configurar
          </Button>
          <AgentActionsDropdown
            agent={agent}
            trigger={
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            }
            onEdit={onEdit}
            onExportAsJSON={onExportAsJSON}
            onShare={onShare}
            onDelete={onDelete}
          />
        </div>
      </div>
    </Card>
  );
}
