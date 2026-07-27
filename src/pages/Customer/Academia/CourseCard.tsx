// Card de curso na home da área de membros (estilo Kiwify).

import { PlayCircle, Lock, Pencil, Trash2, GraduationCap } from 'lucide-react';
import type { LockCtaType } from '@/hooks/useKnowledge';
import { LockCta } from './LockOverlay';

interface Props {
  titulo: string;
  descricao?: string | null;
  capaUrl?: string | null;
  locked: boolean;
  lock: { titulo: string; lock_cta_type: LockCtaType; lock_cta_label: string | null; lock_cta_value: string | null; lock_message: string | null };
  progress?: { done: number; total: number };
  onOpen: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export default function CourseCard({
  titulo,
  descricao,
  capaUrl,
  locked,
  lock,
  progress,
  onOpen,
  onEdit,
  onDelete,
}: Props) {
  const pct = progress && progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="group relative bg-card border border-border hover:border-primary/40 rounded-xl overflow-hidden transition-colors">
      <button onClick={onOpen} className="w-full text-left" type="button">
        <div className="aspect-video bg-gradient-to-br from-primary/20 via-purple-500/10 to-muted flex items-center justify-center relative overflow-hidden">
          {capaUrl ? (
            <img src={capaUrl} alt="" className={`w-full h-full object-cover ${locked ? 'opacity-40' : ''}`} />
          ) : (
            <GraduationCap size={40} className={`text-primary/70 ${locked ? 'opacity-40' : ''}`} strokeWidth={1.5} />
          )}
          {locked && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/45 backdrop-blur-[1px]">
              <div className="w-11 h-11 rounded-xl bg-white/12 flex items-center justify-center">
                <Lock size={20} className="text-white" />
              </div>
              <LockCta lock={lock} />
            </div>
          )}
        </div>
        <div className="p-4">
          <p className="text-sm font-semibold flex items-center gap-1.5">
            {locked && <Lock size={12} className="text-muted-foreground shrink-0" />}
            <span className="truncate">{titulo}</span>
          </p>
          {descricao && <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{descricao}</p>}
          {!locked && progress && progress.total > 0 && (
            <div className="mt-3">
              <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                {progress.done}/{progress.total} aulas · {pct}%
              </p>
            </div>
          )}
          {!locked && (!progress || progress.total === 0) && (
            <p className="mt-3 text-[10px] text-muted-foreground flex items-center gap-1">
              <PlayCircle size={11} /> Começar
            </p>
          )}
        </div>
      </button>

      {(onEdit || onDelete) && (
        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
          {onEdit && (
            <button
              onClick={onEdit}
              className="p-1.5 bg-black/40 text-white hover:text-primary rounded-lg backdrop-blur"
              title="Editar"
              type="button"
            >
              <Pencil size={12} />
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="p-1.5 bg-black/40 text-white hover:text-red-400 rounded-lg backdrop-blur"
              title="Excluir"
              type="button"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
