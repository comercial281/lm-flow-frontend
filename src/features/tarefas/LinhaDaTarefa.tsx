import { Pencil, Trash2 } from 'lucide-react';
import { Checkbox, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/ds';
import BotaoMaisAcoes from '@/components/base/BotaoMaisAcoes';
import { cn } from '@/lib/utils';
import { linkDoCardCompleto } from '@/features/pipelines/linkDoCard';
import { iconeDaCategoria } from './iconeDaCategoria';
import { prazoDaTarefa } from './prazos';
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
  /** Tela Tarefas: o texto vira link pra página do card, em outra guia (14/10/2026). */
  abrirCard?: boolean;
}

const mesmoNome = (a?: string | null, b?: string | null) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Cartão da tarefa (opção C escolhida pelo dono em 14/10/2026): bolinha de
 * concluir, quadradinho com o ícone do tipo (o mesmo da janela "Agendar
 * tarefa"), título e, embaixo, o lead em destaque; prazo alinhado à direita.
 * Serve a tela Tarefas e o bloco de tarefas do card.
 */
export default function LinhaDaTarefa({ tarefa, aoConcluir, aoReabrir, aoEditar, aoExcluir, mostrarLead, abrirCard }: Props) {
  const feita = tarefa.status === 'completed';
  const prazo = prazoDaTarefa(tarefa.due_at);
  const atrasada = tarefa.overdue && !feita;
  const Icone = iconeDaCategoria(tarefa.category ?? tarefa.title);
  const mostrarAlta = !feita && (tarefa.priority === 'high' || tarefa.priority === 'urgent');
  // A tarefa nasce com o nome do tipo como título: aí o tipo não se repete embaixo.
  const detalhes = [
    mesmoNome(tarefa.category, tarefa.title) ? null : tarefa.category,
    tarefa.property?.code,
    tarefa.assignee?.name,
  ].filter(Boolean).join(' · ');
  const lead = mostrarLead ? tarefa.contact?.name : null;
  const link = abrirCard && tarefa.pipeline_id ? linkDoCardCompleto(tarefa.pipeline_id, tarefa.pipeline_item_id) : null;
  const texto = (
    <>
      {/* Título em até duas linhas: na lateral da Conversa a coluna é estreita. */}
      <span className={cn('line-clamp-2 break-words font-semibold', feita && 'text-muted-foreground line-through')}>{tarefa.title}</span>
      {(mostrarAlta || lead || detalhes) && (
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {/* No começo da linha: o corte do fim nunca esconde a prioridade. */}
          {mostrarAlta && (
            <span className="mr-1.5 inline-block rounded-full bg-amber-500/15 px-2 py-px text-[11px] font-medium text-amber-700 dark:text-amber-400">{T.alta}</span>
          )}
          {lead && <span className="font-medium text-foreground">{lead}</span>}
          {lead && detalhes && ' · '}
          {detalhes}
        </span>
      )}
    </>
  );

  return (
    <li className="flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-sm transition-colors hover:bg-muted/60">
      <Checkbox
        className="size-5 rounded-full border-muted-foreground/50 hover:border-primary"
        checked={feita}
        disabled={!tarefa.can_edit}
        aria-label={`${feita ? T.reabrir : T.concluir} ${tarefa.title}`}
        onCheckedChange={() => (feita ? aoReabrir(tarefa) : aoConcluir(tarefa))}
      />
      <span
        className={cn(
          'grid size-8 shrink-0 place-items-center rounded-[10px] sm:size-9',
          feita ? 'bg-muted text-muted-foreground' : atrasada ? 'bg-destructive/10 text-destructive' : 'bg-accent text-accent-foreground',
        )}
        title={tarefa.category ?? undefined}
        aria-hidden
      >
        <Icone className="h-4 w-4" />
      </span>
      {link ? (
        <a href={link} target="_blank" rel="noopener" title="Abrir o card em outra guia" className="min-w-0 flex-1 text-left">{texto}</a>
      ) : (
        <div className="min-w-0 flex-1">{texto}</div>
      )}
      <span className="flex shrink-0 flex-col items-end gap-0.5 text-right">
        {prazo.hora && (
          <span className={cn('font-mono text-[13px] font-medium tabular-nums', atrasada && 'text-destructive')}>{prazo.hora}</span>
        )}
        {atrasada ? (
          <span className="whitespace-nowrap rounded-full bg-destructive/10 px-2 py-px text-[11px] font-medium text-destructive">
            {prazo.atraso ? `${T.atrasada} ${prazo.atraso}` : T.atrasada}
          </span>
        ) : (
          <span className="whitespace-nowrap text-xs text-muted-foreground">{prazo.dia}</span>
        )}
      </span>
      {/* Sem menu, guarda o lugar dele: o prazo fica na mesma coluna das outras. */}
      {!(tarefa.can_edit || tarefa.can_delete) && <span className="size-8 shrink-0" aria-hidden />}
      {(tarefa.can_edit || tarefa.can_delete) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <BotaoMaisAcoes compacto aria-label={`Opções de ${tarefa.title}`} className="shrink-0 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {tarefa.can_edit && !feita && <DropdownMenuItem onSelect={() => aoEditar(tarefa)}><Pencil className="h-4 w-4" />{T.editar}</DropdownMenuItem>}
            {tarefa.can_delete && (
              <>
                {tarefa.can_edit && !feita && <DropdownMenuSeparator />}
                <DropdownMenuItem variant="destructive" onSelect={() => aoExcluir(tarefa)}><Trash2 className="h-4 w-4" />{T.excluir}</DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </li>
  );
}
