import { MoreHorizontal } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/ds';
import { quandoAcontece } from '@/lib/formato';
import { cn } from '@/lib/utils';
import { TEXTOS_DE_TAREFAS as T } from './textos';
import type { TarefaAtividade } from './tipos';

interface Props {
  tarefa: TarefaAtividade;
  aoConcluir: (t: TarefaAtividade) => void;
  aoReabrir: (t: TarefaAtividade) => void;
  aoEditar: (t: TarefaAtividade) => void;
  aoExcluir: (t: TarefaAtividade) => void;
  /** Atividades mostra de quem é o lead; dentro do card não precisa. */
  mostrarLead?: boolean;
  aoAbrir?: (t: TarefaAtividade) => void;
}

export default function LinhaDaTarefa({ tarefa, aoConcluir, aoReabrir, aoEditar, aoExcluir, mostrarLead, aoAbrir }: Props) {
  const feita = tarefa.status === 'completed';
  return (
    <li className="flex items-start gap-2 py-2 text-sm">
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 accent-primary"
        checked={feita}
        disabled={!tarefa.can_edit}
        aria-label={`${feita ? T.reabrir : T.concluir} ${tarefa.title}`}
        onChange={() => (feita ? aoReabrir(tarefa) : aoConcluir(tarefa))}
      />
      <button
        type="button"
        className={cn('min-w-0 flex-1 text-left', !aoAbrir && 'cursor-default')}
        onClick={aoAbrir ? () => aoAbrir(tarefa) : undefined}
      >
        <p className={cn('truncate font-medium', feita && 'text-muted-foreground line-through')}>{tarefa.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {[
            tarefa.category,
            tarefa.due_at ? quandoAcontece(tarefa.due_at) : null,
            tarefa.priority === 'high' || tarefa.priority === 'urgent' ? T.prioridadeAlta : null,
            tarefa.property?.code,
            mostrarLead ? tarefa.contact?.name : null,
            tarefa.assignee?.name,
          ].filter(Boolean).join(' · ')}
          {tarefa.overdue && !feita && <span className="ml-1 font-semibold text-destructive">{T.atrasada}</span>}
        </p>
      </button>
      {(tarefa.can_edit || tarefa.can_delete) && (
        <DropdownMenu>
          <DropdownMenuTrigger aria-label={`Opções de ${tarefa.title}`} className="rounded p-1 text-muted-foreground hover:bg-muted">
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {tarefa.can_edit && !feita && <DropdownMenuItem onSelect={() => aoEditar(tarefa)}>{T.editar}</DropdownMenuItem>}
            {tarefa.can_delete && <DropdownMenuItem className="text-destructive" onSelect={() => aoExcluir(tarefa)}>{T.excluir}</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </li>
  );
}
