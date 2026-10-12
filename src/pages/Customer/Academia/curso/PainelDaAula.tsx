// Painel da aula: vídeo, trilha, Marcar como vista / Próxima aula, "A seguir"
// depois de concluir, ações da Leal Mídia numa faixa, texto, anexos, nota e
// comentários.

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CheckCircle2, ChevronDown, ChevronRight, ChevronUp, Circle, Megaphone, Pencil, Trash2 } from 'lucide-react';
import { useDeleteLesson, useProgress, useRatings, useSetRating, useToggleProgress, useUpdateLesson, type KnowledgeLesson, type KnowledgeModule } from '@/hooks/useKnowledge';
import { formatDuration } from '@/pages/Customer/Tutorials/_internal/lib';
import VideoEmbed from '@/pages/Customer/Tutorials/_internal/VideoEmbed';
import CommentsSection from '@/pages/Customer/Tutorials/_internal/CommentsSection';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { Button } from '@/components/ui/ds';
import LessonAttachments from '../LessonAttachments';
import StarRating from '../StarRating';
import AnnounceLessonModal from '../AnnounceLessonModal';
import CapaGerada from '../CapaGerada';

interface Props {
  aula: KnowledgeLesson;
  modulo: KnowledgeModule;
  aulasDoModulo: KnowledgeLesson[];
  proxima: KnowledgeLesson | null;
  anterior: KnowledgeLesson | null;
  cursoId: string;
  cursoTitulo: string;
  podeEditar: boolean;
  aoIr: (aulaId: string) => void;
  aoExcluida: () => void;
  aoEditar: () => void;
}

export default function PainelDaAula({ aula, modulo, aulasDoModulo, proxima, anterior, cursoId, cursoTitulo, podeEditar, aoIr, aoExcluida, aoEditar }: Props) {
  const { data: progress = {} } = useProgress();
  const toggleProgress = useToggleProgress();
  const { data: rating } = useRatings(aula.id);
  const setRating = useSetRating();
  const vista = !!progress[aula.id];
  const posicao = aulasDoModulo.findIndex((l) => l.id === aula.id) + 1;

  return (
    <div className="mx-auto w-full max-w-4xl p-5 md:p-6">
      <p className="mb-3 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        <span>{cursoTitulo}</span><ChevronRight className="h-3.5 w-3.5" /><span>{modulo.titulo}</span><ChevronRight className="h-3.5 w-3.5" />
        <span className="font-semibold text-foreground">Aula {posicao} de {aulasDoModulo.length}</span>
      </p>
      <VideoEmbed provider={aula.video_provider} videoId={aula.video_id} videoUrl={aula.video_url} className="mb-5" />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-2xl font-extrabold">{aula.titulo}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{[formatDuration(aula.duracao_min), modulo.titulo].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {anterior && <Button variant="outline" type="button" onClick={() => aoIr(anterior.id)}>Anterior</Button>}
          <Button variant="outline" type="button" disabled={toggleProgress.isPending} aria-pressed={vista}
            onClick={() => toggleProgress.mutate({ lesson_id: aula.id, done: !vista })}
            className={vista ? 'border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : ''}>
            {vista ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
            {vista ? 'Aula concluída' : 'Marcar como vista'}
          </Button>
          {proxima && <Button type="button" onClick={() => aoIr(proxima.id)}>Próxima aula <ChevronRight className="h-4 w-4" /></Button>}
        </div>
      </div>

      {vista && proxima && (
        <button type="button" onClick={() => aoIr(proxima.id)}
          className="mt-4 flex w-full items-center gap-4 rounded-2xl border border-primary bg-primary/5 p-3 text-left">
          <div className="aspect-video w-24 shrink-0 overflow-hidden rounded-lg">
            {proxima.capa_url ? <img src={proxima.capa_url} alt="" className="h-full w-full object-cover" /> : <CapaGerada titulo="" semente={proxima.id} />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">A seguir</p>
            <p className="truncate font-semibold">{proxima.titulo}</p>
            {proxima.duracao_min ? <p className="text-sm text-muted-foreground">{formatDuration(proxima.duracao_min)}</p> : null}
          </div>
        </button>
      )}

      {podeEditar && (
        <AcoesDaLealMidia aula={aula} aulas={aulasDoModulo} cursoId={cursoId} cursoTitulo={cursoTitulo} moduloTitulo={modulo.titulo} aoEditar={aoEditar} aoExcluida={aoExcluida} />
      )}

      {aula.descricao_md && (
        <article className="prose prose-sm mt-5 max-w-none dark:prose-invert">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{aula.descricao_md}</ReactMarkdown>
        </article>
      )}

      <LessonAttachments lessonId={aula.id} canEdit={podeEditar} />

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold">O que achou da aula?</span>
        <StarRating value={rating?.mine ?? 0} onRate={(stars) => setRating.mutate({ lesson_id: aula.id, stars })} />
        {rating && rating.count > 0 && <span className="text-xs text-muted-foreground">média {rating.avg.toFixed(1)} · {rating.count}</span>}
      </div>

      <CommentsSection lessonId={aula.id} canModerate={podeEditar} />
    </div>
  );
}

function AcoesDaLealMidia({ aula, aulas, cursoId, cursoTitulo, moduloTitulo, aoEditar, aoExcluida }: {
  aula: KnowledgeLesson; aulas: KnowledgeLesson[]; cursoId: string; cursoTitulo: string; moduloTitulo: string; aoEditar: () => void; aoExcluida: () => void;
}) {
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const del = useDeleteLesson();
  const update = useUpdateLesson();
  const [avisando, setAvisando] = useState(false);
  const idx = aulas.findIndex((l) => l.id === aula.id);

  async function mover(dir: -1 | 1) {
    const j = idx + dir;
    if (j < 0 || j >= aulas.length) return;
    const a = aulas[idx];
    const b = aulas[j];
    await update.mutateAsync({ id: a.id, ordem: b.ordem });
    await update.mutateAsync({ id: b.id, ordem: a.ordem });
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-primary/50 bg-primary/5 p-2.5">
      <Button size="sm" variant="outline" type="button" onClick={aoEditar}><Pencil className="h-4 w-4" /> Editar aula</Button>
      <Button size="sm" variant="outline" type="button" disabled={idx <= 0} onClick={() => mover(-1)}><ChevronUp className="h-4 w-4" /> Subir</Button>
      <Button size="sm" variant="outline" type="button" disabled={idx >= aulas.length - 1} onClick={() => mover(1)}><ChevronDown className="h-4 w-4" /> Descer</Button>
      <Button size="sm" variant="outline" type="button" onClick={() => setAvisando(true)}><Megaphone className="h-4 w-4" /> Avisar clientes</Button>
      <Button size="sm" variant="outline" type="button" className="text-destructive" onClick={async () => {
        if (await confirmar({ titulo: 'Excluir aula', descricao: <>Excluir a aula <strong>{aula.titulo}</strong>?</>, rotuloDaAcao: 'Excluir', destrutivo: true })) {
          del.mutate(aula.id);
          aoExcluida();
        }
      }}><Trash2 className="h-4 w-4" /> Excluir aula</Button>
      {avisando && (
        <AnnounceLessonModal
          lesson={{ id: aula.id, titulo: aula.titulo, curso: cursoTitulo, modulo: moduloTitulo, descricao: aula.descricao_md ?? '', duracao: aula.duracao_min }}
          courseId={cursoId}
          onClose={() => setAvisando(false)}
        />
      )}
      {dialogoDeConfirmacao}
    </div>
  );
}
