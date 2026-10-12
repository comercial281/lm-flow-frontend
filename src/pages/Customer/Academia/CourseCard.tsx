// Cartão de curso na home da Área de Membros.

import { Lock, Pencil, Trash2 } from 'lucide-react';
import type { LockCtaType } from '@/hooks/useKnowledge';
import { formatDuration } from '@/pages/Customer/Tutorials/_internal/lib';
import { LockCta } from './LockOverlay';
import CapaGerada from './CapaGerada';
import { Card } from '@/components/ui/ds';

interface Props {
  id: string;
  titulo: string;
  descricao?: string | null;
  capaUrl?: string | null;
  locked: boolean;
  restricted?: boolean;
  soGestores?: boolean;
  lock: { titulo: string; lock_cta_type: LockCtaType; lock_cta_label: string | null; lock_cta_value: string | null; lock_message: string | null };
  modulos: number;
  progress: { done: number; total: number; minutos: number };
  onOpen: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export default function CourseCard({ id, titulo, descricao, capaUrl, locked, restricted, soGestores, lock, modulos, progress, onOpen, onEdit, onDelete }: Props) {
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  const meta = [`${modulos} ${modulos === 1 ? 'módulo' : 'módulos'}`, `${progress.total} ${progress.total === 1 ? 'aula' : 'aulas'}`, formatDuration(progress.minutos)].filter(Boolean).join(' · ');

  return (
    <Card className="group relative gap-0 overflow-hidden py-0 transition-colors hover:border-primary/40">
      <button onClick={onOpen} className="w-full text-left" type="button">
        <div className="relative aspect-video max-w-full overflow-hidden bg-muted">
          {capaUrl ? (
            <img src={capaUrl} alt="" className={`h-full w-full object-cover ${locked ? 'opacity-40' : ''}`} />
          ) : (
            <CapaGerada titulo={titulo} semente={id} className={locked ? 'opacity-40' : ''} />
          )}
          {soGestores && (
            <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-amber-300 backdrop-blur">Gestores</span>
          )}
          {!soGestores && !locked && restricted && (
            <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-amber-300 backdrop-blur">
              <Lock className="h-3.5 w-3.5" /> Restrito
            </span>
          )}
          {locked && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/45">
              <Lock className="h-6 w-6 text-white" />
              <LockCta lock={lock} />
            </div>
          )}
        </div>
        <div className="grid gap-2 p-4">
          <p className="flex items-center gap-1.5 text-base font-semibold">
            {locked && <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />}
            <span className="truncate">{titulo}</span>
          </p>
          {descricao && <p className="line-clamp-2 text-sm text-muted-foreground">{descricao}</p>}
          {!locked && (
            <>
              <div className="flex justify-between gap-2 text-xs text-muted-foreground">
                <span>{meta}</span>
                <span>{progress.done ? `${pct}%` : 'Começar'}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
            </>
          )}
        </div>
      </button>
      {(onEdit || onDelete) && (
        <div className="absolute right-2 top-2 flex items-center gap-1 opacity-80 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          {onEdit && (
            <button onClick={onEdit} className="rounded-lg bg-black/45 p-1.5 text-white hover:text-primary" aria-label="Editar curso" title="Editar curso" type="button">
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          {onDelete && (
            <button onClick={onDelete} className="rounded-lg bg-black/45 p-1.5 text-white hover:text-red-400" aria-label="Excluir curso" title="Excluir curso" type="button">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </Card>
  );
}
