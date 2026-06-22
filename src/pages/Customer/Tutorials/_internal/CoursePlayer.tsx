// Área de membros: player de uma "aula/curso" (módulo) no estilo plataforma de curso.
// Sidebar de aulas numeradas + busca + progresso · player central + marcar visto +
// anterior/próximo · comentários. Admin (super-admin) cria por embed ou upload.

import { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ArrowLeft,
  Plus,
  PlayCircle,
  CheckCircle2,
  Circle,
  Clock,
  X,
  Trash2,
  Search,
  ChevronLeft,
  ChevronRight,
  Link2,
  Upload,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import {
  useLessons,
  useCreateLesson,
  useUploadLessonVideo,
  useDeleteLesson,
  useUpdateLesson,
  useProgress,
  useToggleProgress,
  type KnowledgeModule,
  type KnowledgeLesson,
} from '@/hooks/useKnowledge';
import { parseVideoUrl, formatDuration } from './lib';
import VideoEmbed from './VideoEmbed';
import CommentsSection from './CommentsSection';

interface Props {
  module: KnowledgeModule;
  onBack: () => void;
  canEdit: boolean;
}

export default function CoursePlayer({ module: m, onBack, canEdit }: Props) {
  const { data: lessons = [], isLoading } = useLessons(m.id);
  const { data: progress = {} } = useProgress();
  const toggleProgress = useToggleProgress();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Seleciona a 1ª aula assim que carrega.
  useEffect(() => {
    if (!selectedId && lessons.length > 0) setSelectedId(lessons[0].id);
  }, [lessons, selectedId]);

  const selected = lessons.find((l) => l.id === selectedId) ?? null;
  const selectedIndex = lessons.findIndex((l) => l.id === selectedId);

  const completedCount = lessons.filter((l) => progress[l.id]).length;
  const pct = lessons.length ? Math.round((completedCount / lessons.length) * 100) : 0;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return lessons;
    return lessons.filter((l) => l.titulo.toLowerCase().includes(q));
  }, [lessons, search]);

  function goTo(offset: number) {
    const next = lessons[selectedIndex + offset];
    if (next) setSelectedId(next.id);
  }

  return (
    <div className="flex-1 flex min-h-0">
      {/* ── Sidebar de aulas ─────────────────────────────────────────── */}
      <aside className="w-72 shrink-0 border-r border-border flex flex-col min-h-0 bg-card/40">
        <div className="px-4 py-3 border-b border-border">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground mb-3"
            type="button"
          >
            <ArrowLeft size={14} /> Todos os módulos
          </button>
          <p className="text-sm font-bold leading-tight">{m.titulo}</p>
          {/* Progresso */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
              <span>Seu progresso</span>
              <span className="text-primary font-semibold">{pct}%</span>
            </div>
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
          {/* Busca */}
          <div className="relative mt-3">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar aula"
              className="w-full bg-background border border-border rounded-lg pl-8 pr-2 py-1.5 text-xs"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {isLoading && <p className="px-4 py-2 text-xs text-muted-foreground">Carregando...</p>}
          {!isLoading && lessons.length === 0 && (
            <p className="px-4 py-6 text-xs text-muted-foreground text-center">
              Nenhuma aula neste módulo ainda.
            </p>
          )}
          {filtered.map((lesson) => {
            const realIdx = lessons.findIndex((l) => l.id === lesson.id);
            const done = !!progress[lesson.id];
            const active = lesson.id === selectedId;
            return (
              <button
                key={lesson.id}
                onClick={() => setSelectedId(lesson.id)}
                className={`w-full text-left flex items-center gap-3 px-4 py-2.5 text-xs transition-colors ${
                  active ? 'bg-primary/10 border-l-2 border-primary' : 'border-l-2 border-transparent hover:bg-muted/40'
                }`}
                type="button"
              >
                {done ? (
                  <CheckCircle2 size={16} className="text-primary shrink-0" />
                ) : (
                  <Circle size={16} className="text-muted-foreground/50 shrink-0" />
                )}
                <span className="shrink-0 text-muted-foreground tabular-nums">
                  {String(realIdx + 1).padStart(2, '0')}
                </span>
                <span className={`flex-1 min-w-0 truncate ${active ? 'font-semibold text-foreground' : 'text-foreground/80'}`}>
                  {lesson.titulo}
                </span>
                {lesson.duracao_min ? (
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {formatDuration(lesson.duracao_min)}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </aside>

      {/* ── Player + conteúdo ────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-w-0">
        {canEdit && <AdminBar moduleId={m.id} lessons={lessons} />}

        {!selected && !isLoading && (
          <div className="h-full flex items-center justify-center text-center p-10">
            <div>
              <PlayCircle size={44} className="mx-auto text-muted-foreground/40 mb-3" strokeWidth={1.5} />
              <p className="text-sm text-muted-foreground">
                {lessons.length === 0 ? 'Sem aulas por aqui ainda.' : 'Escolha uma aula na lista.'}
              </p>
            </div>
          </div>
        )}

        {selected && (
          <div className="p-6 max-w-4xl mx-auto w-full">
            <VideoEmbed
              provider={selected.video_provider}
              videoId={selected.video_id}
              videoUrl={selected.video_url}
              className="mb-5"
            />

            {/* Barra de ações */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
              <button
                onClick={() =>
                  toggleProgress.mutate({ lesson_id: selected.id, done: !progress[selected.id] })
                }
                disabled={toggleProgress.isPending}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg border transition-colors ${
                  progress[selected.id]
                    ? 'bg-primary/15 text-primary border-primary/40'
                    : 'bg-card text-foreground border-border hover:border-primary/40'
                }`}
                type="button"
              >
                {progress[selected.id] ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                {progress[selected.id] ? 'Aula concluída' : 'Marcar como visto'}
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => goTo(-1)}
                  disabled={selectedIndex <= 0}
                  className="flex items-center gap-1 px-3 py-2 text-xs rounded-lg border border-border hover:border-primary/40 disabled:opacity-40"
                  type="button"
                >
                  <ChevronLeft size={14} /> Anterior
                </button>
                <button
                  onClick={() => goTo(1)}
                  disabled={selectedIndex >= lessons.length - 1}
                  className="flex items-center gap-1 px-3 py-2 text-xs rounded-lg border border-border hover:border-primary/40 disabled:opacity-40"
                  type="button"
                >
                  Próximo <ChevronRight size={14} />
                </button>
              </div>
            </div>

            <h1 className="text-2xl font-bold mb-1">{selected.titulo}</h1>
            {selected.duracao_min ? (
              <p className="text-xs text-muted-foreground mb-4 flex items-center gap-1">
                <Clock size={11} /> {formatDuration(selected.duracao_min)}
              </p>
            ) : null}

            {canEdit && <LessonAdminActions lesson={selected} lessons={lessons} onDeleted={() => setSelectedId(null)} />}

            {selected.descricao_md && (
              <article className="prose prose-sm max-w-none dark:prose-invert mt-4">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{selected.descricao_md}</ReactMarkdown>
              </article>
            )}

            <CommentsSection lessonId={selected.id} canModerate={canEdit} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Ações admin por aula (reordenar / excluir) ────────────────────────────
function LessonAdminActions({
  lesson,
  lessons,
  onDeleted,
}: {
  lesson: KnowledgeLesson;
  lessons: KnowledgeLesson[];
  onDeleted: () => void;
}) {
  const del = useDeleteLesson();
  const update = useUpdateLesson();
  const idx = lessons.findIndex((l) => l.id === lesson.id);

  async function move(dir: -1 | 1) {
    const j = idx + dir;
    if (j < 0 || j >= lessons.length) return;
    const a = lessons[idx];
    const b = lessons[j];
    await update.mutateAsync({ id: a.id, ordem: j });
    await update.mutateAsync({ id: b.id, ordem: idx });
  }

  return (
    <div className="flex items-center gap-2 mb-2">
      <button
        onClick={() => move(-1)}
        disabled={idx <= 0}
        className="flex items-center gap-1 px-2 py-1 text-[11px] rounded-md border border-border hover:border-primary/40 disabled:opacity-30"
        type="button"
      >
        <ChevronUp size={12} /> Subir
      </button>
      <button
        onClick={() => move(1)}
        disabled={idx >= lessons.length - 1}
        className="flex items-center gap-1 px-2 py-1 text-[11px] rounded-md border border-border hover:border-primary/40 disabled:opacity-30"
        type="button"
      >
        <ChevronDown size={12} /> Descer
      </button>
      <button
        onClick={() => {
          if (window.confirm(`Excluir aula "${lesson.titulo}"?`)) {
            del.mutate(lesson.id);
            onDeleted();
          }
        }}
        className="flex items-center gap-1 px-2 py-1 text-[11px] text-red-500 rounded-md border border-red-500/30 hover:bg-red-500/10"
        type="button"
      >
        <Trash2 size={12} /> Excluir aula
      </button>
    </div>
  );
}

// ── Barra admin: adicionar aula (embed ou upload) ─────────────────────────
function AdminBar({ moduleId, lessons }: { moduleId: string; lessons: KnowledgeLesson[] }) {
  const createLesson = useCreateLesson();
  const uploadLesson = useUploadLessonVideo();

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'embed' | 'upload'>('embed');
  const [titulo, setTitulo] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [duracao, setDuracao] = useState('');
  const [descricao, setDescricao] = useState('');

  const busy = createLesson.isPending || uploadLesson.isPending;

  function reset() {
    setTitulo('');
    setVideoUrl('');
    setFile(null);
    setDuracao('');
    setDescricao('');
    setOpen(false);
  }

  async function submit() {
    if (!titulo.trim()) return;
    const dur = duracao ? parseInt(duracao, 10) : undefined;
    if (mode === 'embed') {
      if (!videoUrl.trim() || !parseVideoUrl(videoUrl)) {
        window.alert('Cole um link válido do YouTube ou Vimeo.');
        return;
      }
      await createLesson.mutateAsync({
        module_id: moduleId,
        titulo: titulo.trim(),
        video_url: videoUrl.trim(),
        descricao_md: descricao || undefined,
        duracao_min: dur,
      });
    } else {
      if (!file) {
        window.alert('Selecione um arquivo de vídeo.');
        return;
      }
      await uploadLesson.mutateAsync({
        module_id: moduleId,
        titulo: titulo.trim(),
        file,
        descricao_md: descricao || undefined,
        duracao_min: dur,
      });
    }
    reset();
  }

  return (
    <div className="border-b border-border bg-card/40 px-6 py-2.5">
      {!open ? (
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">
            {lessons.length} aula{lessons.length === 1 ? '' : 's'} · modo edição
          </span>
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-primary-foreground bg-primary hover:opacity-90 rounded-lg"
            type="button"
          >
            <Plus size={12} /> Nova aula
          </button>
        </div>
      ) : (
        <div className="space-y-3 max-w-2xl">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold">Nova aula</p>
            <button onClick={reset} type="button" className="text-muted-foreground hover:text-foreground">
              <X size={14} />
            </button>
          </div>

          {/* Toggle embed/upload */}
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1 w-fit">
            <button
              onClick={() => setMode('embed')}
              className={`flex items-center gap-1.5 px-3 py-1 text-[11px] rounded-md ${
                mode === 'embed' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
              }`}
              type="button"
            >
              <Link2 size={12} /> Link YouTube/Vimeo
            </button>
            <button
              onClick={() => setMode('upload')}
              className={`flex items-center gap-1.5 px-3 py-1 text-[11px] rounded-md ${
                mode === 'upload' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
              }`}
              type="button"
            >
              <Upload size={12} /> Enviar arquivo
            </button>
          </div>

          <input
            autoFocus
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Título da aula"
            className="w-full bg-background border border-border rounded px-3 py-2 text-sm"
          />

          {mode === 'embed' ? (
            <input
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="URL do YouTube ou Vimeo"
              className="w-full bg-background border border-border rounded px-3 py-2 text-sm"
            />
          ) : (
            <input
              type="file"
              accept="video/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-xs file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground"
            />
          )}

          <input
            value={duracao}
            onChange={(e) => setDuracao(e.target.value.replace(/[^0-9]/g, ''))}
            placeholder="Duração em minutos (opcional)"
            className="w-full bg-background border border-border rounded px-3 py-2 text-sm"
          />
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Descrição em markdown (opcional)"
            rows={3}
            className="w-full bg-background border border-border rounded px-3 py-2 text-sm resize-y"
          />

          <div className="flex justify-end gap-2">
            <button onClick={reset} className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground" type="button">
              Cancelar
            </button>
            <button
              onClick={submit}
              disabled={busy}
              className="px-3 py-1.5 text-xs text-primary-foreground bg-primary hover:opacity-90 disabled:opacity-50 rounded-lg"
              type="button"
            >
              {busy ? (mode === 'upload' ? 'Enviando vídeo...' : 'Salvando...') : 'Adicionar aula'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
