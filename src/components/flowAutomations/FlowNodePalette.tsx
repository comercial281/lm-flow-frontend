import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/ds';
import { FLOW_NODE_DEFS, type FlowNodeKind, type FlowNodeGroup } from '@/types/flowAutomations';
import { nodeColor } from '@/lib/flowAutomationGraph';
import { cn } from '@/lib/utils';

const GROUP_LABELS: Record<FlowNodeGroup, string> = {
  message: 'Falar com o lead',
  contact: 'Organizar o lead',
  control: 'Controlar o fluxo',
  notify: 'Avisar por dentro',
};

interface Props {
  onPick: (kind: FlowNodeKind) => void;
}

// Paleta de blocos — mirror da `Paleta` do CanvasDoFluxo do Hub: busca por
// nome, agrupada visualmente pela mesma cor do cartão no canvas.
export function FlowNodePalette({ onPick }: Props) {
  const [query, setQuery] = useState('');

  const groups = useMemo(() => {
    const filtered = FLOW_NODE_DEFS.filter(d => !query || d.label.toLowerCase().includes(query.toLowerCase()));
    const byGroup: Record<string, typeof FLOW_NODE_DEFS> = {};
    filtered.forEach(d => {
      byGroup[d.group] = byGroup[d.group] || [];
      byGroup[d.group].push(d);
    });
    return byGroup;
  }, [query]);

  return (
    <div className="w-64 shrink-0 border-r border-border bg-background flex flex-col h-full">
      <div className="p-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar bloco..."
            className="pl-7 h-8 text-xs"
          />
        </div>
      </div>
      <div className="flex-1 overflow-auto p-2 space-y-3">
        {Object.entries(groups).map(([group, defs]) => (
          <div key={group}>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-1 mb-1">
              {GROUP_LABELS[group as FlowNodeGroup] || group}
            </div>
            <div className="space-y-1">
              {defs.map(def => (
                <button
                  key={def.kind}
                  onClick={() => onPick(def.kind)}
                  className={cn(
                    'w-full text-left text-xs rounded-md border border-border px-2 py-1.5',
                    'hover:border-primary hover:bg-accent transition-colors'
                  )}
                >
                  <span
                    className="inline-block h-2 w-2 rounded-full mr-1.5 align-middle"
                    style={{ backgroundColor: nodeColor(def.kind, def.group) }}
                  />
                  {def.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
