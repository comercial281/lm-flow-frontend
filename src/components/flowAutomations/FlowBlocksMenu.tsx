import { useMemo, useState, type ReactNode } from 'react';
import { Search } from 'lucide-react';
import { Input, Popover, PopoverContent, PopoverTrigger } from '@/components/ui/ds';
import EmptyState from '@/components/base/EmptyState';
import { nodeColor } from '@/lib/flowAutomationGraph';
import { paletteGroups, type PaletteItem } from '@/features/flowAutomations/palette';
import { blockDescription, blockIcon } from '@/features/flowAutomations/blockInfo';
import { cn } from '@/lib/utils';
import { INDISPONIVEL } from '@/features/flowAutomations/personal';

// Lista "Blocos" (spec 16/10/2026, peça 5): desce embaixo do botão Blocos, com
// busca e os grupos Mensagem · Lead · IA · Distribuição · Notificação · Controle
// (a composição continua em palette.ts). Clicar num bloco ou arrastá-lo pro
// canvas coloca o bloco no fluxo. Começa fechada e não lembra como ficou.

/** Tipo do arraste do painel pro canvas (o valor é a `key` do bloco). */
export const BLOCK_DRAG_TYPE = 'application/x-lmflow-bloco';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (item: PaletteItem) => void;
  /** Corretor: 'fora' some da lista, 'indisponivel' fica cinza e sem clique nem arraste. */
  estadoDoBloco?: (item: PaletteItem) => 'ok' | 'indisponivel' | 'fora';
  /** O botão que abre a lista (a lista desce embaixo dele). */
  trigger: ReactNode;
}

export function FlowBlocksMenu({ open, onOpenChange, onPick, estadoDoBloco, trigger }: Props) {
  const [query, setQuery] = useState('');
  const groups = useMemo(() => {
    const all = paletteGroups(query);
    if (!estadoDoBloco) return all;
    return all
      .map(g => ({ ...g, items: g.items.filter(i => estadoDoBloco(i) !== 'fora') }))
      .filter(g => g.items.length > 0);
  }, [query, estadoDoBloco]);

  return (
    <Popover
      open={open}
      onOpenChange={next => {
        if (!next) setQuery('');
        onOpenChange(next);
      }}
    >
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="start"
        role="region"
        aria-label="Blocos"
        data-testid="painel-blocos"
        className="flex max-h-[min(70dvh,32rem)] w-72 flex-col p-0"
      >
      <div className="p-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar blocos..."
            aria-label="Buscar blocos"
            className="pl-7 h-8 text-xs"
          />
        </div>
      </div>
      <div className="flex-1 overflow-auto overscroll-contain p-2 space-y-3" onWheel={ev => ev.stopPropagation()}>
        {groups.length === 0 && (
          <EmptyState tipo="semResultado" tamanho="compacto" title="Nenhum bloco com esse nome." className="p-3 text-xs" />
        )}
        {groups.map(({ group, label, items }) => (
          <section key={group} aria-label={label}>
            <h3 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-1 mb-1">
              {label}
            </h3>
            <div className="space-y-1">
              {items.map(item => {
                const Icon = blockIcon(item);
                const color = nodeColor(item.kind, item.group);
                if (estadoDoBloco?.(item) === 'indisponivel') {
                  return (
                    <button
                      key={item.key}
                      type="button"
                      disabled
                      draggable={false}
                      title={INDISPONIVEL}
                      className="flex w-full items-center gap-2 text-left text-xs rounded-md border border-border px-2 py-1.5 cursor-not-allowed"
                    >
                      <span
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-white opacity-50"
                        style={{ backgroundColor: color }}
                        aria-hidden="true"
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="truncate opacity-50">{item.label}</span>
                      <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{INDISPONIVEL}</span>
                    </button>
                  );
                }
                return (
                  <button
                    key={item.key}
                    type="button"
                    draggable
                    onDragStart={e => {
                      e.dataTransfer.setData(BLOCK_DRAG_TYPE, item.key);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    onClick={() => onPick(item)}
                    title={blockDescription(item) || item.label}
                    className={cn(
                      'flex w-full items-center gap-2 text-left text-xs rounded-md border border-border px-2 py-1.5',
                      'hover:border-primary hover:bg-accent transition-colors cursor-grab active:cursor-grabbing',
                    )}
                  >
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-white"
                      style={{ backgroundColor: color }}
                      aria-hidden="true"
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      </PopoverContent>
    </Popover>
  );
}
