import { Palette, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/ds';
import BotaoMaisAcoes from '@/components/base/BotaoMaisAcoes';
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
            <BotaoMaisAcoes aria-label={`Mais ações: ${nome}`} title={`Mais ações: ${nome}`} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onTrocarCor && (
              <DropdownMenuItem onClick={() => onTrocarCor(label)}>
                <Palette className="h-4 w-4" /> Trocar cor
              </DropdownMenuItem>
            )}
            {!travada && onExcluir && (
              <>
                {onTrocarCor && <DropdownMenuSeparator />}
                <DropdownMenuItem variant="destructive" onClick={() => onExcluir(label)}>
                  <Trash2 className="h-4 w-4" /> Excluir
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      )}
    </div>
  );
}
