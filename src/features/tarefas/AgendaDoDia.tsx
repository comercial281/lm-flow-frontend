import { useEffect, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, ListTodo, Moon } from 'lucide-react';
import { Button } from '@/components/ui/ds';
import { hora } from '@/lib/formato';
import { cn } from '@/lib/utils';
import { TEXTOS_DE_TAREFAS as T } from './textos';
import { EVENTO_TAREFAS_MUDARAM, tarefasService } from './tarefasService';
import type { ItemDaAgenda } from './tipos';

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** "2026-10-08" → Date local (meia-noite). */
function paraData(dia: string): Date {
  const [a, m, d] = dia.split('-').map(Number);
  return new Date(a, m - 1, d);
}

/** Soma dias a "AAAA-MM-DD" e devolve no mesmo formato. */
export function somarDias(dia: string, n: number): string {
  const x = paraData(dia);
  x.setDate(x.getDate() + n);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

/** "Quinta | 8 de out | 2026", como no cabeçalho da agenda. */
export function cabecalhoDoDia(dia: string): string {
  const x = paraData(dia);
  return `${DIAS[x.getDay()]} | ${x.getDate()} de ${MESES[x.getMonth()]} | ${x.getFullYear()}`;
}

function faixa(item: ItemDaAgenda): string {
  if (!item.due_at) return '';
  const inicio = hora(item.due_at);
  if (!item.duration_minutes) return inicio;
  return `${inicio} – ${hora(new Date(new Date(item.due_at).getTime() + item.duration_minutes * 60_000))}`;
}

const FEITA = new Set(['completed', 'no_show']);

interface Props {
  dia: string;
  aoMudarDia: (dia: string) => void;
  /** De quem é a agenda. Sem id: a equipe toda (gestor sem responsável escolhido). */
  responsavel: { id?: string; name?: string } | null;
  className?: string;
}

/**
 * Coluna direita da janela "Agendar tarefa" (08/10/2026): tarefas e visitas do
 * responsável no dia, por horário, pra não marcar duas coisas no mesmo horário.
 * As setas só mudam o dia que se vê; a data da tarefa continua a do campo.
 */
export default function AgendaDoDia({ dia, aoMudarDia, responsavel, className }: Props) {
  const [itens, setItens] = useState<ItemDaAgenda[] | null>(null);
  const [versao, setVersao] = useState(0);
  const id = responsavel?.id;

  useEffect(() => {
    if (!dia) return;
    let vivo = true;
    setItens(null);
    tarefasService
      .agendaDoDia(dia, id)
      .then(r => { if (vivo) setItens(r); })
      .catch(() => { if (vivo) setItens([]); });
    return () => { vivo = false; };
  }, [dia, id, versao]);

  useEffect(() => {
    const aoMudar = () => setVersao(v => v + 1);
    window.addEventListener(EVENTO_TAREFAS_MUDARAM, aoMudar);
    return () => window.removeEventListener(EVENTO_TAREFAS_MUDARAM, aoMudar);
  }, []);

  const titulo = id ? `${T.agendaDe} ${responsavel?.name ?? ''}`.trim() : T.agendaDaEquipe;

  return (
    <section aria-label={titulo} className={cn('flex min-h-0 flex-col gap-3', className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{dia ? cabecalhoDoDia(dia) : ''}</p>
          <p className="truncate text-xs text-muted-foreground">{titulo}</p>
        </div>
        <div className="flex shrink-0 overflow-hidden rounded-md border border-border">
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-none" aria-label={T.diaAnterior} onClick={() => aoMudarDia(somarDias(dia, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-none border-l border-border" aria-label={T.proximoDia} onClick={() => aoMudarDia(somarDias(dia, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="min-h-[16rem] flex-1 space-y-2 overflow-y-auto rounded-lg border border-border bg-muted/30 p-3">
        {itens === null ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : itens.length === 0 ? (
          <p className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            <Moon className="h-4 w-4" />
            {T.semTarefasNoDia}
          </p>
        ) : (
          <ul className="space-y-2">
            {itens.map(item => {
              const Icone = item.kind === 'visit' ? CalendarDays : ListTodo;
              const feita = FEITA.has(item.status);
              return (
                <li key={`${item.kind}-${item.id}`} className="flex gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm">
                  <Icone className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-label={item.kind === 'visit' ? T.visita : undefined} />
                  <div className="min-w-0 flex-1">
                    <p className={cn('truncate font-medium', feita && 'text-muted-foreground line-through')}>{item.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[faixa(item), item.contact?.name].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
