import { MoreHorizontal, Palette, Trash2 } from 'lucide-react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/ds';
import { plural } from '@/lib/formato';
import type { Label } from '@/types/settings';

interface LinhaEtiquetaProps {
  label: Label;
  /** Etiqueta do sistema: sem edição e sem exclusão, só a cor muda. */
  travada?: boolean;
  onEditar?: (label: Label) => void;
  onTrocarCor?: (label: Label) => void;
  onExcluir?: (label: Label) => void;
}

export default function LinhaEtiqueta({ label, travada, onEditar, onTrocarCor, onExcluir }: LinhaEtiquetaProps) {
  const nome = label.display_name ?? label.title;
  const editavel = !travada && !!onEditar;

  return (
    <div
      data-linha-etiqueta
      className={`flex items-center gap-3 px-3 py-2 border-b last:border-b-0 ${editavel ? 'cursor-pointer hover:bg-muted/40' : ''}`}
      onClick={editavel ? () => onEditar?.(label) : undefined}
    >
      <span
        data-testid="bolinha"
        className="h-3 w-3 shrink-0 rounded-full"
        style={{ backgroundColor: label.color }}
      />
      {editavel ? (
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            onEditar?.(label);
          }}
          className="flex-1 truncate bg-transparent p-0 text-left text-sm font-medium"
        >
          {nome}
        </button>
      ) : (
        <span className="flex-1 truncate text-sm font-medium">{nome}</span>
      )}
      {typeof label.contacts_count === 'number' && (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          em {plural(label.contacts_count, 'lead', 'leads')}
        </span>
      )}
      {(onTrocarCor || (!travada && onExcluir)) && (
      <div onClick={e => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {/* Igual à tela de Lembretes: o IconActionButton não repassa as props do gatilho do menu. */}
            <Button size="icon" variant="ghost" aria-label={`Mais ações: ${nome}`} title={`Mais ações: ${nome}`}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onTrocarCor && (
              <DropdownMenuItem onClick={() => onTrocarCor(label)}>
                <Palette className="w-4 h-4 mr-2" /> Trocar cor
              </DropdownMenuItem>
            )}
            {!travada && onExcluir && (
              <DropdownMenuItem onClick={() => onExcluir(label)} className="text-destructive">
                <Trash2 className="w-4 h-4 mr-2" /> Excluir
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      )}
    </div>
  );
}
