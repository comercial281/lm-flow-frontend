// src/features/cardDoLead/blocos/BlocoEtiquetas.tsx
// Etiquetas do lead: aplicar, tirar e criar na hora (grava sem Salvar).
import { Check, Loader2, Plus, X } from 'lucide-react';
import {
  Badge,
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/ds';
import type { CardDoLead } from '../useCardDoLead';

export default function BlocoEtiquetas({ card }: { card: CardDoLead }) {
  const e = card.etiquetas;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {e.ativas.map(l => (
        <Badge key={l} variant="secondary" className="gap-1 text-sm h-7 px-2.5 border-0 font-medium" style={e.estilo(l)}>
          {l}
          <button onClick={() => e.alternar(l)} aria-label="Remover etiqueta" title="Remover etiqueta" className="hover:opacity-60">
            <X className="h-3.5 w-3.5" />
          </button>
        </Badge>
      ))}
      {e.podeEtiquetar && (
        <Popover open={e.popoverAberto} onOpenChange={e.setPopoverAberto}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 px-3 text-sm gap-1.5 border-dashed">
              {(e.salvando || e.criando) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Adicionar etiqueta
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-52 p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar ou criar etiqueta..." value={e.busca} onValueChange={e.setBusca} />
              {/* onWheel stopPropagation: sem isso a roda do mouse não rolava a lista dentro do popover/modal. */}
              <CommandList className="max-h-56 overflow-y-auto overscroll-contain" onWheel={ev => ev.stopPropagation()}>
                <CommandEmpty>Digite o nome e clique em "Criar etiqueta".</CommandEmpty>
                <CommandGroup heading="Nova etiqueta">
                  <CommandItem
                    value={`__create__${e.buscaLimpa}`}
                    disabled={!e.podeCriar || e.criando}
                    onSelect={() => e.podeCriar && e.criarEAplicar(e.buscaLimpa)}
                  >
                    {e.criando ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-2 h-3.5 w-3.5" />}
                    {e.buscaLimpa ? `Criar etiqueta "${e.buscaLimpa}"` : 'Digite acima pra criar uma nova etiqueta'}
                  </CommandItem>
                </CommandGroup>
                <CommandGroup heading="Etiquetas existentes">
                  {e.filtradas.map(l => (
                    <CommandItem key={l.id} value={l.title} onSelect={() => { e.alternar(l.title); e.setPopoverAberto(false); e.setBusca(''); }}>
                      <Check className={`mr-2 h-3.5 w-3.5 ${e.ativas.includes(l.title) ? 'opacity-100' : 'opacity-0'}`} />
                      <span className="w-2.5 h-2.5 rounded-full mr-2 shrink-0 inline-block" style={{ backgroundColor: l.color }} />
                      {l.title}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
