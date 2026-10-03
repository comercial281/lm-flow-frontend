import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/ds';
import type { FlowNodeKind } from '@/types/flowAutomations';
import { nodeColor } from '@/lib/flowAutomationGraph';
import { paletteGroups } from '@/features/flowAutomations/palette';
import { cn } from '@/lib/utils';

interface Props {
  onPick: (kind: FlowNodeKind) => void;
}

// Paleta de blocos: só os que o motor garante nesta versão (palette.ts), com
// busca por nome e a mesma cor do cartão no canvas.
export function FlowNodePalette({ onPick }: Props) {
  const [query, setQuery] = useState('');
  const groups = useMemo(() => paletteGroups(query), [query]);

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
        {groups.length === 0 && <p className="text-xs text-muted-foreground px-1">Nenhum bloco com esse nome.</p>}
        {groups.map(({ group, label, defs }) => (
          <div key={group}>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-1 mb-1">
              {label}
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
