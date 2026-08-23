// Área de membros — visão de um curso estilo Kiwify:
// player central + sidebar de módulos (sanfona) com aulas numeradas e progresso.
// Módulos bloqueados aparecem com cadeado + CTA. Aluno: assiste, marca visto,
// baixa anexos, avalia e comenta. Admin: cria módulo/aula, edita, reordena, anexa.

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ArrowLeft, PlayCircle, CheckCircle2, Circle, Clock, ChevronLeft, ChevronRight,
  Lock, Plus, Pencil, Trash2, ChevronUp, ChevronDown, X, Link2, Upload, FolderPlus,
} from 'lucide-react';
import {
  useCourses, useModules, useAllLessons, useProgress, useToggleProgress,
  useCreateLesson, useUploadLessonVideo, useReplaceLessonVideo, useDeleteLesson, useUpdateLesson,
  useDeleteModule, useEntitlements, useRatings, useSetRating, computeLocked,
  getCurrentUserRef, TENANT_SLUG,
  type KnowledgeModule, type KnowledgeLesson, type KnowledgeCourse,
} from '@/hooks/useKnowledge';
import { useIsSuperAdmin } from '@/hooks/useIsSuperAdmin';
import { parseVideoUrl, formatDuration } from '@/pages/Customer/Tutorials/_internal/lib';
import VideoEmbed from '@/pages/Customer/Tutorials/_internal/VideoEmbed';
import CommentsSection from '@/pages/Customer/Tutorials/_internal/CommentsSection';
import LockOverlay, { LockCta } from './LockOverlay';
import LessonAttachments from './LessonAttachments';
import StarRating from './StarRating';
import ModuleForm from './ModuleForm';
import CourseForm from './CourseForm';
import CoverPicker from './CoverPicker';
import { GERAL_COURSE_ID } from './_lib';

interface Props {
  onBack: () => void;
}

export default function CourseView({ onBack }: Props) {
  const { courseId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const canEdit = useIsSuperAdmin();

  const { data: courses = [] } = useCourses();
  const { data: allModules = [] } = useModules();
  const { data: entitlements = [] } = useEntitlements();
  const { data: progress = {} } = useProgress();

  const userRef = getCurrentUserRef();
  const isGeral = courseId === GERAL_COURSE_ID;
  const course: KnowledgeCourse | null = isGeral ? null : courses.find((c) => c.id === courseId) ?? null;

  const modules = useMemo(
    () =>
      allModules
        .filter((m) => (isGeral ? m.course_id == null : m.course_id === courseId))
        .sort((a, b) => a.ordem - b.ordem),
    [allModules, courseId, isGeral],
  );
  const moduleIds = useMemo(() => modules.map((m) => m.id), [modules]);
  const { data: allLessons = [] } = useAllLessons(moduleIds);

  const lessonsByModule = useMemo(() => {
    const map: Record<string, KnowledgeLesson[]> = {};
    for (const l of allLessons) (map[l.module_id] ??= []).push(l);
    for (const k of Object.keys(map)) map[k].sort((a, b) => a.ordem - b.ordem);
    return map;
  }, [allLessons]);

  // Admin (super-admin) fura o cadeado: vê e gerencia tudo, com selo "Restrito".
  const moduleLocked = (m: KnowledgeModule) =>
    !canEdit && computeLocked(m, 'module', m.id, entitlements, TENANT_SLUG, userRef);

  // Aulas "abertas" (de módulos desbloqueados), em ordem — pra prev/next e continue.
  const openLessons = useMemo(() => {
    const out: KnowledgeLesson[] = [];
    for (const m of modules) {
      if (moduleLocked(m)) continue;
      out.push(...(lessonsByModule[m.id] ?? []));
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modules, lessonsByModule, entitlements, userRef]);

  const [selectedId, setSelectedId] = useState<string | null>(params.get('lesson'));

  // Seleção default: ?lesson válido, senão 1ª aula não concluída, senão a 1ª.
  useEffect(() => {
    if (selectedId && openLessons.some((l) => l.id === selectedId)) return;
    if (openLessons.length === 0) return;
    const next = openLessons.find((l) => !progress[l.id]) ?? openLessons[0];
    setSelectedId(next.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openLessons]);

  // Sincroniza ?lesson na URL.
  useEffect(() => {
    if (!selectedId) return;
    const next = new URLSearchParams(params);
    next.set('lesson', selectedId);
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const selected = openLessons.find((l) => l.id === selectedId) ?? null;
  const selectedIdx = openLessons.findIndex((l) => l.id === selectedId);

  // Admin state
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [moduleForm, setModuleForm] = useState<{ editing: KnowledgeModule | null } | null>(null);
  const deleteModule = useDeleteModule();

  // Curso bloqueado (guarda extra) — admin fura o cadeado.
  if (course && !canEdit && computeLocked(course, 'course', course.id, entitlements, TENANT_SLUG, userRef)) {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <TopBar title={course.titulo} onBack={onBack} />
        <LockOverlay lock={course} />
      </div>
    );
  }

  const title = isGeral ? 'Geral' : course?.titulo ?? 'Curso';

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TopBar
        title={title}
        onBack={onBack}
        right={
          canEdit ? (
            <div className="flex items-center gap-2">
              {course && (
                <button
                  onClick={() => setShowCourseForm(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] rounded-lg border border-border hover:border-primary/40"
                  type="button"
                >
                  <Pencil size={12} /> Editar curso
                </button>
              )}
              <button
                onClick={() => setModuleForm({ editing: null })}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] rounded-lg bg-primary text-primary-foreground hover:opacity-90"
                type="button"
              >
                <FolderPlus size={12} /> Novo módulo
              </button>
            </div>
          ) : undefined
        }
      />

      {(showCourseForm || moduleForm) && (
        <div className="px-5 md:px-8 pt-4 overflow-y-auto">
          {showCourseForm && course && (
            <CourseForm editing={course} onClose={() => setShowCourseForm(false)} />
          )}
          {moduleForm && (
            <ModuleForm
              editing={moduleForm.editing}
              defaultCourseId={isGeral ? null : courseId}
              onClose={() => setModuleForm(null)}
            />
          )}
        </div>
      )}

      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        {/* Player + conteúdo — sempre no topo no mobile, à esquerda no desktop */}
        <div className="flex-1 overflow-y-auto min-w-0 order-1">
          {selected ? (
            <LessonPanel
              key={selected.id}
              lesson={selected}
              lessons={openLessons}
              index={selectedIdx}
              canEdit={canEdit}
              onSelect={setSelectedId}
              onDeleted={() => setSelectedId(null)}
            />
          ) : (
            <div className="h-full min-h-[280px] flex items-center justify-center text-center p-10">
              <div>
                <PlayCircle size={44} className="mx-auto text-muted-foreground/40 mb-3" strokeWidth={1.5} />
                <p className="text-sm text-muted-foreground">
                  {modules.length === 0 ? 'Nenhum módulo neste curso ainda.' : 'Escolha uma aula na lista.'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar de módulos/aulas */}
        <aside className="w-full md:w-80 shrink-0 border-t md:border-t-0 md:border-l border-border bg-card/40 overflow-y-auto order-2 max-h-[55vh] md:max-h-none">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground">
              {modules.length} módulo{modules.length === 1 ? '' : 's'}
            </p>
          </div>
          {modules.map((m) => (
            <ModuleSection
              key={m.id}
              module={m}
              lessons={lessonsByModule[m.id] ?? []}
              locked={moduleLocked(m)}
              progress={progress}
              selectedId={selectedId}
              canEdit={canEdit}
              onSelectLesson={setSelectedId}
              onEditModule={() => setModuleForm({ editing: m })}
              onDeleteModule={() => {
                if (window.confirm(`Excluir o módulo "${m.titulo}" e todas as aulas dentro?`)) {
                  deleteModule.mutate(m.id);
                }
              }}
            />
          ))}
          {modules.length === 0 && (
            <p className="px-4 py-6 text-xs text-muted-foreground text-center">Sem módulos ainda.</p>
          )}
        </aside>
      </div>
    </div>
  );
}

// ── Barra de topo ────────────────────────────────────────────────────────────
function TopBar({ title, onBack, right }: { title: string; onBack: () => void; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 md:px-8 py-3 border-b border-border">
      <button onClick={onBack} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground min-w-0" type="button">
        <ArrowLeft size={15} className="shrink-0" />
        <span className="font-semibold text-foreground truncate">{title}</span>
      </button>
      {right}
    </div>
  );
}

// ── Seção de módulo na sidebar (sanfona) ─────────────────────────────────────
function ModuleSection({
  module: m, lessons, locked, progress, selectedId, canEdit,
  onSelectLesson, onEditModule, onDeleteModule,
}: {
  module: KnowledgeModule;
  lessons: KnowledgeLesson[];
  locked: boolean;
  progress: Record<string, boolean>;
  selectedId: string | null;
  canEdit: boolean;
  onSelectLesson: (id: string) => void;
  onEditModule: () => void;
  onDeleteModule: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [adding, setAdding] = useState(false);
  const done = lessons.filter((l) => progress[l.id]).length;

  return (
    <div className="border-b border-border/70">
      <div className="w-full flex items-center gap-2 px-4 py-2.5">
        <button onClick={() => setOpen((v) => !v)} className="flex-1 min-w-0 flex items-center gap-2 text-left" type="button">
          {locked ? <Lock size={13} className="text-muted-foreground shrink-0" /> : open ? <ChevronDown size={13} className="shrink-0" /> : <ChevronRight size={13} className="shrink-0" />}
          <span className="text-xs font-semibold truncate">{m.titulo}</span>
          {!locked && m.access === 'restricted' && (
            <span className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-semibold rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <Lock size={8} /> Restrito
            </span>
          )}
        </button>
        <span className="text-[10px] text-muted-foreground shrink-0">
          {locked ? 'bloqueado' : `${done}/${lessons.length}`}
        </span>
        {canEdit && (
          <div className="flex items-center gap-0.5 shrink-0">
            <button onClick={onEditModule} className="p-1 text-muted-foreground hover:text-primary" title="Editar módulo" type="button"><Pencil size={11} /></button>
            <button onClick={onDeleteModule} className="p-1 text-muted-foreground hover:text-red-400" title="Excluir módulo" type="button"><Trash2 size={11} /></button>
          </div>
        )}
      </div>

      {open && (
        <div className="pb-1.5">
          {locked ? (
            <div className="px-4 pb-3">
              <p className="text-[11px] text-muted-foreground mb-2">
                {m.lock_message?.trim() || 'Conteúdo exclusivo. Libere pra assistir.'}
              </p>
              <LockCta lock={m} />
            </div>
          ) : (
            <>
              {lessons.map((l, idx) => {
                const isDone = !!progress[l.id];
                const active = l.id === selectedId;
                return (
                  <button
                    key={l.id}
                    onClick={() => onSelectLesson(l.id)}
                    className={`w-full text-left flex items-center gap-2.5 pl-4 pr-3 py-2 text-xs transition-colors ${
                      active ? 'bg-primary/10 border-l-2 border-primary' : 'border-l-2 border-transparent hover:bg-muted/40'
                    }`}
                    type="button"
                  >
                    {isDone ? <CheckCircle2 size={15} className="text-primary shrink-0" /> : <Circle size={15} className="text-muted-foreground/50 shrink-0" />}
                    <span className="shrink-0 text-muted-foreground tabular-nums">{String(idx + 1).padStart(2, '0')}</span>
                    {l.capa_url && (
                      <img src={l.capa_url} alt="" className="w-10 h-6 shrink-0 rounded object-cover border border-border" />
                    )}
                    <span className={`flex-1 min-w-0 truncate ${active ? 'font-semibold' : 'text-foreground/80'}`}>{l.titulo}</span>
                    {l.duracao_min ? <span className="text-[10px] text-muted-foreground shrink-0">{formatDuration(l.duracao_min)}</span> : null}
                  </button>
                );
              })}
              {lessons.length === 0 && <p className="px-4 py-2 text-[11px] text-muted-foreground">Sem aulas ainda.</p>}
              {canEdit && (
                adding ? (
                  <div className="px-4 py-2">
                    <AddLessonForm moduleId={m.id} onDone={() => setAdding(false)} />
                  </div>
                ) : (
                  <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 mx-4 my-1.5 px-2.5 py-1.5 text-[11px] rounded-lg border border-border hover:border-primary/40" type="button">
                    <Plus size={11} /> Nova aula
                  </button>
                )
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Painel da aula selecionada (player + ações + anexos + avaliação + comentários) ─
function LessonPanel({
  lesson, lessons, index, canEdit, onSelect, onDeleted,
}: {
  lesson: KnowledgeLesson;
  lessons: KnowledgeLesson[];
  index: number;
  canEdit: boolean;
  onSelect: (id: string) => void;
  onDeleted: () => void;
}) {
  const { data: progress = {} } = useProgress();
  const toggleProgress = useToggleProgress();
  const { data: rating } = useRatings(lesson.id);
  const setRating = useSetRating();

  function goTo(offset: number) {
    const next = lessons[index + offset];
    if (next) onSelect(next.id);
  }

  return (
    <div className="p-5 md:p-6 max-w-4xl mx-auto w-full">
      <VideoEmbed provider={lesson.video_provider} videoId={lesson.video_id} videoUrl={lesson.video_url} className="mb-5" />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <button
          onClick={() => toggleProgress.mutate({ lesson_id: lesson.id, done: !progress[lesson.id] })}
          disabled={toggleProgress.isPending}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg border transition-colors ${
            progress[lesson.id] ? 'bg-primary/15 text-primary border-primary/40' : 'bg-card text-foreground border-border hover:border-primary/40'
          }`}
          type="button"
        >
          {progress[lesson.id] ? <CheckCircle2 size={14} /> : <Circle size={14} />}
          {progress[lesson.id] ? 'Aula concluída' : 'Marcar como visto'}
        </button>

        <div className="flex items-center gap-2">
          <button onClick={() => goTo(-1)} disabled={index <= 0} className="flex items-center gap-1 px-3 py-2 text-xs rounded-lg border border-border hover:border-primary/40 disabled:opacity-40" type="button">
            <ChevronLeft size={14} /> Anterior
          </button>
          <button onClick={() => goTo(1)} disabled={index >= lessons.length - 1} className="flex items-center gap-1 px-3 py-2 text-xs rounded-lg border border-border hover:border-primary/40 disabled:opacity-40" type="button">
            Próximo <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold mb-1">{lesson.titulo}</h1>
          {lesson.duracao_min ? (
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock size={11} /> {formatDuration(lesson.duracao_min)}</p>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-1">
          <StarRating value={rating?.mine ?? 0} onRate={(stars) => setRating.mutate({ lesson_id: lesson.id, stars })} />
          {rating && rating.count > 0 && (
            <span className="text-[11px] text-muted-foreground">média {rating.avg.toFixed(1)} · {rating.count}</span>
          )}
        </div>
      </div>

      {canEdit && <LessonAdminActions lesson={lesson} lessons={lessons} onDeleted={onDeleted} />}

      {lesson.descricao_md && (
        <article className="prose prose-sm max-w-none dark:prose-invert mt-4">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{lesson.descricao_md}</ReactMarkdown>
        </article>
      )}

      <LessonAttachments lessonId={lesson.id} canEdit={canEdit} />

      <CommentsSection lessonId={lesson.id} canModerate={canEdit} />
    </div>
  );
}

// ── Ações admin por aula (editar / reordenar / excluir) ──────────────────────
function LessonAdminActions({ lesson, lessons, onDeleted }: { lesson: KnowledgeLesson; lessons: KnowledgeLesson[]; onDeleted: () => void }) {
  const del = useDeleteLesson();
  const update = useUpdateLesson();
  const [editing, setEditing] = useState(false);
  const idx = lessons.findIndex((l) => l.id === lesson.id);

  async function move(dir: -1 | 1) {
    const j = idx + dir;
    if (j < 0 || j >= lessons.length) return;
    const a = lessons[idx];
    const b = lessons[j];
    await update.mutateAsync({ id: a.id, ordem: b.ordem });
    await update.mutateAsync({ id: b.id, ordem: a.ordem });
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setEditing((v) => !v)} className={`flex items-center gap-1 px-2 py-1 text-[11px] rounded-md border ${editing ? 'border-primary/40 text-primary bg-primary/10' : 'border-primary/40 text-primary hover:bg-primary/10'}`} type="button"><Pencil size={12} /> Editar aula</button>
        <button onClick={() => move(-1)} disabled={idx <= 0} className="flex items-center gap-1 px-2 py-1 text-[11px] rounded-md border border-border hover:border-primary/40 disabled:opacity-30" type="button"><ChevronUp size={12} /> Subir</button>
        <button onClick={() => move(1)} disabled={idx >= lessons.length - 1} className="flex items-center gap-1 px-2 py-1 text-[11px] rounded-md border border-border hover:border-primary/40 disabled:opacity-30" type="button"><ChevronDown size={12} /> Descer</button>
        <button
          onClick={() => { if (window.confirm(`Excluir aula "${lesson.titulo}"?`)) { del.mutate(lesson.id); onDeleted(); } }}
          className="flex items-center gap-1 px-2 py-1 text-[11px] text-red-500 rounded-md border border-red-500/30 hover:bg-red-500/10"
          type="button"
        ><Trash2 size={12} /> Excluir aula</button>
      </div>
      {editing && <EditLessonForm lesson={lesson} onClose={() => setEditing(false)} />}
    </div>
  );
}

// ── Form de editar aula (título, thumb, vídeo, duração, texto) ────────────────
function EditLessonForm({ lesson, onClose }: { lesson: KnowledgeLesson; onClose: () => void }) {
  const update = useUpdateLesson();
  const replaceVideo = useReplaceLessonVideo();
  const [titulo, setTitulo] = useState(lesson.titulo);
  const [descricao, setDescricao] = useState(lesson.descricao_md ?? '');
  const [duracao, setDuracao] = useState(lesson.duracao_min ? String(lesson.duracao_min) : '');
  const [capaUrl, setCapaUrl] = useState(lesson.capa_url ?? '');
  const [videoMode, setVideoMode] = useState<'keep' | 'link' | 'upload'>('keep');
  const [videoUrl, setVideoUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const busy = update.isPending || replaceVideo.isPending;

  async function submit() {
    if (!titulo.trim()) { window.alert('Dê um título à aula.'); return; }
    const dur = duracao ? parseInt(duracao, 10) : null;

    // Valida o vídeo ANTES de qualquer escrita.
    let videoPatch: Record<string, unknown> = {};
    if (videoMode === 'link') {
      const parsed = parseVideoUrl(videoUrl);
      if (!videoUrl.trim() || !parsed) { window.alert('Cole um link válido do YouTube ou Vimeo.'); return; }
      videoPatch = { video_url: videoUrl.trim(), video_provider: parsed.provider, video_id: parsed.id, storage_path: null };
    }
    if (videoMode === 'upload' && !file) { window.alert('Selecione o novo arquivo de vídeo.'); return; }

    if (videoMode === 'upload' && file) {
      await replaceVideo.mutateAsync({ id: lesson.id, file });
    }
    await update.mutateAsync({
      id: lesson.id,
      titulo: titulo.trim(),
      descricao_md: descricao,
      duracao_min: dur,
      capa_url: capaUrl.trim() || null,
      ...videoPatch,
    });
    onClose();
  }

  return (
    <div className="mt-3 rounded-xl border border-border bg-card p-4 space-y-3 max-w-2xl">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold">Editar aula</p>
        <button onClick={onClose} type="button" className="text-muted-foreground hover:text-foreground"><X size={14} /></button>
      </div>

      <div>
        <p className="text-[11px] text-muted-foreground mb-1">Título da aula</p>
        <input autoFocus value={titulo} onChange={(e) => setTitulo(e.target.value)} className="w-full bg-background border border-border rounded px-3 py-2 text-sm" />
      </div>

      <CoverPicker value={capaUrl} onChange={setCapaUrl} />

      <div>
        <p className="text-[11px] text-muted-foreground mb-1">Vídeo</p>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5 w-fit mb-2">
          <button onClick={() => setVideoMode('keep')} className={`px-2.5 py-1 text-[10px] rounded-md ${videoMode === 'keep' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`} type="button">Manter atual</button>
          <button onClick={() => setVideoMode('link')} className={`flex items-center gap-1 px-2.5 py-1 text-[10px] rounded-md ${videoMode === 'link' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`} type="button"><Link2 size={10} /> Trocar por link</button>
          <button onClick={() => setVideoMode('upload')} className={`flex items-center gap-1 px-2.5 py-1 text-[10px] rounded-md ${videoMode === 'upload' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`} type="button"><Upload size={10} /> Trocar por arquivo</button>
        </div>
        {videoMode === 'link' && (
          <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="URL YouTube ou Vimeo" className="w-full bg-background border border-border rounded px-3 py-2 text-sm" />
        )}
        {videoMode === 'upload' && (
          <input type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="w-full text-[11px] file:mr-2 file:px-2 file:py-1 file:rounded file:border-0 file:bg-primary file:text-primary-foreground" />
        )}
      </div>

      <div>
        <p className="text-[11px] text-muted-foreground mb-1">Duração (min, opcional)</p>
        <input value={duracao} onChange={(e) => setDuracao(e.target.value.replace(/[^0-9]/g, ''))} placeholder="Ex.: 12" className="w-full bg-background border border-border rounded px-3 py-2 text-sm" />
      </div>

      <div>
        <p className="text-[11px] text-muted-foreground mb-1">Texto da aula (markdown, aparece abaixo do vídeo)</p>
        <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={4} placeholder="Descrição, passo a passo, links..." className="w-full bg-background border border-border rounded px-3 py-2 text-sm resize-y" />
      </div>

      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground" type="button">Cancelar</button>
        <button onClick={submit} disabled={busy} className="px-3 py-1.5 text-xs text-primary-foreground bg-primary hover:opacity-90 disabled:opacity-50 rounded-lg" type="button">
          {busy ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}

// ── Form inline de nova aula (embed ou upload) ───────────────────────────────
function AddLessonForm({ moduleId, onDone }: { moduleId: string; onDone: () => void }) {
  const createLesson = useCreateLesson();
  const uploadLesson = useUploadLessonVideo();
  const [mode, setMode] = useState<'embed' | 'upload'>('embed');
  const [titulo, setTitulo] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [duracao, setDuracao] = useState('');
  const busy = createLesson.isPending || uploadLesson.isPending;

  async function submit() {
    if (!titulo.trim()) return;
    const dur = duracao ? parseInt(duracao, 10) : undefined;
    if (mode === 'embed') {
      if (!videoUrl.trim() || !parseVideoUrl(videoUrl)) { window.alert('Cole um link válido do YouTube ou Vimeo.'); return; }
      await createLesson.mutateAsync({ module_id: moduleId, titulo: titulo.trim(), video_url: videoUrl.trim(), duracao_min: dur });
    } else {
      if (!file) { window.alert('Selecione um arquivo de vídeo.'); return; }
      await uploadLesson.mutateAsync({ module_id: moduleId, titulo: titulo.trim(), file, duracao_min: dur });
    }
    onDone();
  }

  return (
    <div className="space-y-2 rounded-lg border border-border bg-background/60 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
          <button onClick={() => setMode('embed')} className={`flex items-center gap-1 px-2 py-1 text-[10px] rounded-md ${mode === 'embed' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`} type="button"><Link2 size={10} /> Link</button>
          <button onClick={() => setMode('upload')} className={`flex items-center gap-1 px-2 py-1 text-[10px] rounded-md ${mode === 'upload' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`} type="button"><Upload size={10} /> Arquivo</button>
        </div>
        <button onClick={onDone} type="button" className="text-muted-foreground hover:text-foreground"><X size={13} /></button>
      </div>
      <input autoFocus value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título da aula" className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-xs" />
      {mode === 'embed' ? (
        <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="URL YouTube ou Vimeo" className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-xs" />
      ) : (
        <input type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="w-full text-[11px] file:mr-2 file:px-2 file:py-1 file:rounded file:border-0 file:bg-primary file:text-primary-foreground" />
      )}
      <input value={duracao} onChange={(e) => setDuracao(e.target.value.replace(/[^0-9]/g, ''))} placeholder="Duração (min, opcional)" className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-xs" />
      <div className="flex justify-end">
        <button onClick={submit} disabled={busy} className="px-2.5 py-1.5 text-[11px] text-primary-foreground bg-primary hover:opacity-90 disabled:opacity-50 rounded-lg" type="button">
          {busy ? (mode === 'upload' ? 'Enviando vídeo...' : 'Salvando...') : 'Adicionar'}
        </button>
      </div>
    </div>
  );
}
