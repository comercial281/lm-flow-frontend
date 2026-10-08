// src/features/tarefas/LinhaDaVisita.tsx
import { CalendarClock } from 'lucide-react';
import { quandoAcontece } from '@/lib/formato';
import { VISIT_STATUS_LABELS } from '@/services/visits/visitsService';
import { TEXTOS_DE_TAREFAS as T } from './textos';
import type { VisitaAtividade } from './tipos';

export default function LinhaDaVisita({ visita, aoAbrir }: { visita: VisitaAtividade; aoAbrir: (v: VisitaAtividade) => void }) {
  return (
    <li className="flex items-start gap-2 py-2 text-sm">
      <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => aoAbrir(visita)}>
        <p className="truncate font-medium">{visita.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {[quandoAcontece(visita.due_at), visita.contact?.name, visita.assignee?.name, VISIT_STATUS_LABELS[visita.status] ?? visita.status]
            .filter(Boolean).join(' · ')}
          {visita.overdue && <span className="ml-1 font-semibold text-destructive">{T.atrasada}</span>}
        </p>
      </button>
    </li>
  );
}
