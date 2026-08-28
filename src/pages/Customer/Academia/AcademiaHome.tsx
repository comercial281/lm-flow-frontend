// Home da Área de Membros — cards de curso (estilo Kiwify), "continue assistindo"
// e, pro admin, criação/edição de cursos e módulos.

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, GraduationCap, PlayCircle, FolderPlus } from 'lucide-react';
import {
  useCourses,
  useDeleteCourse,
  useModules,
  useAllLessons,
  useProgress,
  useEntitlements,
  computeLocked,
  getCurrentUserRef,
  TENANT_SLUG,
  type KnowledgeCourse,
} from '@/hooks/useKnowledge';
import CourseCard from './CourseCard';
import CourseForm from './CourseForm';
import ModuleForm from './ModuleForm';
import { GERAL_COURSE_ID } from './_lib';

import { useConfirmacao } from '@/hooks/useConfirmacao';
interface Props {
  canEdit: boolean;
  embedded?: boolean; // true = dentro da aba do app (sem chrome de tela cheia)
}

export default function AcademiaHome({ canEdit, embedded }: Props) {
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const navigate = useNavigate();
  const { data: courses = [], isLoading: loadingCourses } = useCourses();
  const { data: modules = [], isLoading: loadingModules } = useModules();
  const moduleIds = useMemo(() => modules.map((m) => m.id), [modules]);
  const { data: allLessons = [] } = useAllLessons(moduleIds);
  const { data: progress = {} } = useProgress();
  const { data: entitlements = [] } = useEntitlements();
  const deleteCourse = useDeleteCourse();

  const [courseForm, setCourseForm] = useState<{ editing: KnowledgeCourse | null } | null>(null);
  const [showModuleForm, setShowModuleForm] = useState(false);

  const userRef = getCurrentUserRef();
  const isLoading = loadingCourses || loadingModules;

  // Lições por módulo (ordem já vem do hook).
  const lessonsByModule = useMemo(() => {
    const map: Record<string, typeof allLessons> = {};
    for (const l of allLessons) (map[l.module_id] ??= []).push(l);
    return map;
  }, [allLessons]);

  // Módulos por curso (course_id null => Geral).
  const modulesByCourse = useMemo(() => {
    const map: Record<string, typeof modules> = {};
    for (const m of modules) (map[m.course_id ?? GERAL_COURSE_ID] ??= []).push(m);
    return map;
  }, [modules]);

  function courseProgress(courseKey: string) {
    const mods = modulesByCourse[courseKey] ?? [];
    let total = 0;
    let done = 0;
    for (const m of mods) {
      for (const l of lessonsByModule[m.id] ?? []) {
        total += 1;
        if (progress[l.id]) done += 1;
      }
    }
    return { total, done };
  }

  // Admin (super-admin) fura o cadeado: abre e gerencia tudo, com selo "Restrito".
  function courseLocked(c: KnowledgeCourse) {
    return !canEdit && computeLocked(c, 'course', c.id, entitlements, TENANT_SLUG, userRef);
  }

  // "Continue assistindo": 1ª aula não concluída num curso/módulo desbloqueado.
  const continueTarget = useMemo(() => {
    const scan: { courseKey: string; courseTitle: string }[] = courses
      .filter((c) => !courseLocked(c))
      .map((c) => ({ courseKey: c.id, courseTitle: c.titulo }));
    if ((modulesByCourse[GERAL_COURSE_ID] ?? []).length > 0) {
      scan.push({ courseKey: GERAL_COURSE_ID, courseTitle: 'Geral' });
    }

    for (const s of scan) {
      for (const m of modulesByCourse[s.courseKey] ?? []) {
        if (computeLocked(m, 'module', m.id, entitlements, TENANT_SLUG, userRef)) continue;
        for (const l of lessonsByModule[m.id] ?? []) {
          if (!progress[l.id]) {
            return { courseKey: s.courseKey, courseTitle: s.courseTitle, lessonId: l.id, lessonTitle: l.titulo };
          }
        }
      }
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courses, modulesByCourse, lessonsByModule, progress, entitlements, userRef]);

  const geralModules = modulesByCourse[GERAL_COURSE_ID] ?? [];
  const hasContent = courses.length > 0 || geralModules.length > 0;

  function openCourse(courseKey: string, lessonId?: string) {
    const q = lessonId ? `?lesson=${lessonId}` : '';
    navigate(`/academia/curso/${courseKey}${q}`);
  }

  return (
    <>
    <div className={embedded ? 'flex-1 overflow-y-auto' : ''}>
      <div className="max-w-6xl mx-auto px-5 py-6 md:px-8 md:py-8">
        {/* Ações admin */}
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <button
              onClick={() => setCourseForm({ editing: null })}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-primary-foreground bg-primary hover:opacity-90 rounded-lg"
              type="button"
            >
              <Plus size={13} /> Novo curso
            </button>
            <button
              onClick={() => setShowModuleForm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border hover:border-primary/40"
              type="button"
            >
              <FolderPlus size={13} /> Novo módulo
            </button>
          </div>
        )}

        {courseForm && (
          <CourseForm editing={courseForm.editing} onClose={() => setCourseForm(null)} />
        )}
        {showModuleForm && <ModuleForm editing={null} onClose={() => setShowModuleForm(false)} />}

        {/* Continue assistindo */}
        {continueTarget && (
          <button
            type="button"
            onClick={() => openCourse(continueTarget.courseKey, continueTarget.lessonId)}
            className="w-full text-left mb-8 group"
          >
            <p className="text-xs font-semibold text-muted-foreground mb-2">Continue assistindo</p>
            <div className="flex items-center gap-4 rounded-xl border border-border bg-card hover:border-primary/40 p-4 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                <PlayCircle size={24} className="text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{continueTarget.lessonTitle}</p>
                <p className="text-xs text-muted-foreground truncate">{continueTarget.courseTitle}</p>
              </div>
            </div>
          </button>
        )}

        {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}

        {!isLoading && !hasContent && (
          <div className="text-center py-16">
            <GraduationCap size={44} className="mx-auto text-muted-foreground/40 mb-3" strokeWidth={1.5} />
            <p className="text-sm text-muted-foreground">Nenhum curso ainda.</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              {canEdit ? 'Crie um curso pra montar a área de membros.' : 'Em breve teremos conteúdo aqui.'}
            </p>
          </div>
        )}

        {/* Grade de cursos */}
        {(courses.length > 0 || geralModules.length > 0) && (
          <>
            <h2 className="text-lg font-bold mb-4">Cursos</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {courses.map((c) => {
                const locked = courseLocked(c);
                return (
                  <CourseCard
                    key={c.id}
                    titulo={c.titulo}
                    descricao={c.descricao}
                    capaUrl={c.capa_url}
                    locked={locked}
                    restricted={c.access === 'restricted'}
                    lock={c}
                    progress={courseProgress(c.id)}
                    onOpen={() => (locked ? undefined : openCourse(c.id))}
                    onEdit={canEdit ? () => setCourseForm({ editing: c }) : undefined}
                    onDelete={
                      canEdit
                        ? async () => {
                            if (await confirmar({
                              titulo: 'Excluir curso',
                              descricao: (
                                <>
                                  Excluir o curso <strong>{c.titulo}</strong>? Os módulos ficam
                                  soltos em Geral — nenhum é apagado.
                                </>
                              ),
                              rotuloDaAcao: 'Excluir',
                              destrutivo: true,
                            })) {
                              deleteCourse.mutate(c.id);
                            }
                          }
                        : undefined
                    }
                  />
                );
              })}

              {geralModules.length > 0 && (
                <CourseCard
                  titulo="Geral"
                  descricao="Módulos avulsos"
                  capaUrl={null}
                  locked={false}
                  lock={{ titulo: 'Geral', lock_cta_type: 'none', lock_cta_label: null, lock_cta_value: null, lock_message: null }}
                  progress={courseProgress(GERAL_COURSE_ID)}
                  onOpen={() => openCourse(GERAL_COURSE_ID)}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
      {dialogoDeConfirmacao}
    </>
  );
}
