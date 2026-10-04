import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/ds';
import IconActionButton from '@/components/base/IconActionButton';
import { nodeColor } from '@/lib/flowAutomationGraph';
import { paletteGroups, type PaletteItem } from '@/features/flowAutomations/palette';
import { blockDescription, blockIcon } from '@/features/flowAutomations/blockInfo';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';
import { MOBILE_QUERY } from './FlowSidePanel';

// Painel "Blocos" (sprint 4, spec 04/10/2026, A.2): abre e fecha pelo botão no
// canto do canvas, com busca e as seções Mensagem pro lead · Lead · Avisos ·
// Controle (a composição continua em palette.ts). Clicar num bloco ou
// arrastá-lo pro canvas coloca o bloco no fluxo. No celular, tela cheia.

/** Tipo do arraste do painel pro canvas (o valor é a `key` do bloco). */
export const BLOCK_DRAG_TYPE = 'application/x-lmflow-bloco';

interface Props {
  onPick: (item: PaletteItem) => void;
  onClose: () => void;
}

export function FlowBlocksPanel({ onPick, onClose }: Props) {
  const [query, setQuery] = useState('');
  const groups = useMemo(() => paletteGroups(query), [query]);
  const isMobile = useMediaQuery(MOBILE_QUERY);

  return (
    <div
      role="region"
      aria-label="Blocos"
      data-testid="painel-blocos"
      data-layout={isMobile ? 'tela-cheia' : 'lateral'}
      className={cn(
        'flex flex-col bg-background',
        isMobile ? 'fixed inset-0 z-50 w-full' : 'h-full w-64 shrink-0 border-r border-border',
      )}
    >
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span className="flex-1 text-sm font-semibold">Blocos</span>
        <IconActionButton
          label="Fechar os blocos"
          icon={<X className="h-4 w-4" />}
          variant="ghost"
          className="h-7 w-7"
          onClick={onClose}
        />
      </div>
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
      <div className="flex-1 overflow-auto p-2 space-y-3">
        {groups.length === 0 && <p className="text-xs text-muted-foreground px-1">Nenhum bloco com esse nome.</p>}
        {groups.map(({ group, label, items }) => (
          <section key={group} aria-label={label}>
            <h3 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-1 mb-1">
              {label}
            </h3>
            <div className="space-y-1">
              {items.map(item => {
                const Icon = blockIcon(item);
                const color = nodeColor(item.kind, item.group);
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
    </div>
  );
}
