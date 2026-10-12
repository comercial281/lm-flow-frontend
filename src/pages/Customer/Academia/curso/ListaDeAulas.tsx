// Lista lateral da tela da aula: módulos em sanfona, aulas numeradas com
// duração e visto; selo Gestores; setas e "Nova aula" só pra Leal Mídia.

import { useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronRight, ChevronUp, Circle, Lock, Pencil, Plus, Trash2 } from 'lucide-react';
import type { KnowledgeLesson, KnowledgeModule } from '@/hooks/useKnowledge';
import { formatDuration } from '@/pages/Customer/Tutorials/_internal/lib';
import { LockCta } from '../LockOverlay';
import { contarAulas, quemAssiste } from '../quemVe';

interface Props {
  titulo: string;
  modulos: KnowledgeModule[];
  aulasPorModulo: Record<string, KnowledgeLesson[]>;
  progresso: Record<string, boolean>;
  selecionada: string | null;
  travado: (m: KnowledgeModule) => boolean;
  podeEditar: boolean;
  aoEscolher: (aulaId: string) => void;
  aoEditarModulo: (m: KnowledgeModule) => void;
  aoExcluirModulo: (m: KnowledgeModule) => void;
  aoMoverModulo: (m: KnowledgeModule, direcao: -1 | 1) => void;
  aoNovaAula: (m: KnowledgeModule) => void;
}

export default function ListaDeAulas(p: Props) {
  const geral = contarAulas(p.modulos.filter((m) => !p.travado(m)), p.aulasPorModulo, p.progresso);
  const pct = geral.total ? Math.round((geral.feitas / geral.total) * 100) : 0;
  return (
    <aside className="order-2 flex max-h-[55vh] w-full shrink-0 flex-col overflow-y-auto border-t border-border bg-card md:max-h-none md:w-[340px] md:border-l md:border-t-0">
      <div className="grid gap-2 border-b border-border px-4 py-4">
        <p className="font-semibold">{p.titulo}</p>
        <p className="text-sm text-muted-foreground">{geral.feitas} de {geral.total} aulas</p>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} /></div>
      </div>
      {p.modulos.map((m, i) => (
        <Modulo key={m.id} {...p} m={m} primeiro={i === 0} ultimo={i === p.modulos.length - 1} />
      ))}
      {p.modulos.length === 0 && <p className="px-4 py-6 text-center text-sm text-muted-foreground">Sem módulos ainda.</p>}
    </aside>
  );
}

function Modulo({ m, primeiro, ultimo, aulasPorModulo, progresso, selecionada, travado, podeEditar, aoEscolher, aoEditarModulo, aoExcluirModulo, aoMoverModulo, aoNovaAula }: Props & { m: KnowledgeModule; primeiro: boolean; ultimo: boolean }) {
  const [aberto, setAberto] = useState(true);
  const aulas = aulasPorModulo[m.id] ?? [];
  const preso = travado(m);
  const feitas = aulas.filter((l) => progresso[l.id]).length;
  return (
    <div className="border-b border-border/70">
      <div className="flex items-center gap-2 px-4 py-3">
        <button type="button" onClick={() => setAberto((v) => !v)} aria-expanded={aberto}
          className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm font-semibold">
          {preso ? <Lock className="h-4 w-4 shrink-0 text-muted-foreground" /> : aberto ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
          <span className="truncate">{m.titulo}</span>
          {quemAssiste(m) === 'managers' && <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">Gestores</span>}
        </button>
        <span className="shrink-0 text-xs text-muted-foreground">{preso ? 'bloqueado' : `${feitas}/${aulas.length}`}</span>
        {podeEditar && (
          <div className="flex shrink-0 items-center">
            <button type="button" disabled={primeiro} onClick={() => aoMoverModulo(m, -1)} aria-label="Subir módulo" title="Subir módulo" className="p-1 text-muted-foreground hover:text-primary disabled:opacity-30"><ChevronUp className="h-4 w-4" /></button>
            <button type="button" disabled={ultimo} onClick={() => aoMoverModulo(m, 1)} aria-label="Descer módulo" title="Descer módulo" className="p-1 text-muted-foreground hover:text-primary disabled:opacity-30"><ChevronDown className="h-4 w-4" /></button>
            <button type="button" onClick={() => aoEditarModulo(m)} aria-label="Editar módulo" title="Editar módulo" className="p-1 text-muted-foreground hover:text-primary"><Pencil className="h-4 w-4" /></button>
            <button type="button" onClick={() => aoExcluirModulo(m)} aria-label="Excluir módulo" title="Excluir módulo" className="p-1 text-muted-foreground hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
          </div>
        )}
      </div>
      {aberto && (preso ? (
        <div className="px-4 pb-3">
          <p className="mb-2 text-sm text-muted-foreground">{m.lock_message?.trim() || 'Conteúdo exclusivo. Libere pra assistir.'}</p>
          <LockCta lock={m} />
        </div>
      ) : (
        <div className="pb-2">
          {aulas.map((l, idx) => {
            const vista = !!progresso[l.id];
            const ativa = l.id === selecionada;
            return (
              <button key={l.id} type="button" onClick={() => aoEscolher(l.id)} aria-current={ativa || undefined}
                className={`flex w-full items-center gap-2.5 border-l-[3px] py-2.5 pl-4 pr-3 text-left text-sm transition-colors ${ativa ? 'border-primary bg-primary/10 font-semibold' : 'border-transparent hover:bg-muted/50'}`}>
                {vista ? <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" aria-label="Vista" /> : <Circle className="h-4 w-4 shrink-0 text-muted-foreground/50" />}
                <span className="w-5 shrink-0 text-xs tabular-nums text-muted-foreground">{String(idx + 1).padStart(2, '0')}</span>
                <span className="min-w-0 flex-1 truncate">{l.titulo}</span>
                {l.duracao_min ? <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatDuration(l.duracao_min)}</span> : null}
              </button>
            );
          })}
          {aulas.length === 0 && <p className="px-4 py-2 text-sm text-muted-foreground">Sem aulas ainda.</p>}
          {podeEditar && (
            <button type="button" onClick={() => aoNovaAula(m)} className="mx-4 mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
              <Plus className="h-4 w-4" /> Nova aula
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
