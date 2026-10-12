// Home da Área de Membros: boas-vindas e progresso, "Continue assistindo",
// cursos e aulas avulsas. Quem vê o quê: quemVe.ts (decisão do Tony, 12/10/2026).

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, FolderPlus, GraduationCap, Lock, Pencil, Plus } from 'lucide-react';
import {
  useCourses, useDeleteCourse, useModules, useAllLessons, useProgress, useEntitlements,
  computeLocked, getCurrentUserRef, TENANT_SLUG,
  type KnowledgeCourse, type KnowledgeModule,
} from '@/hooks/useKnowledge';
import { useAuthStore } from '@/store/authStore';
import { formatDuration } from '@/pages/Customer/Tutorials/_internal/lib';
import Pagina from '@/components/base/Pagina';
import BaseHeader from '@/components/base/BaseHeader';
import Carregando from '@/components/base/Carregando';
import EmptyState from '@/components/base/EmptyState';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { Button, Card } from '@/components/ui/ds';
import CourseCard from './CourseCard';
import CourseForm from './CourseForm';
import ModuleForm from './ModuleForm';
import CapaGerada from './CapaGerada';
import AnelDeProgresso from './AnelDeProgresso';
import BarraDaLealMidia from './BarraDaLealMidia';
import { LockCta } from './LockOverlay';
import { GERAL_COURSE_ID } from './_lib';
import { useCargoNaAcademia } from './useCargoNaAcademia';
import { agruparAulas, contarAulas, modulosVisiveis, quemAssiste, soParaGestores } from './quemVe';

interface Props {
  embedded?: boolean; // true = dentro da aba Aulas do Tutorial
}

export default function AcademiaHome({ embedded }: Props) {
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const navigate = useNavigate();
  const { cargo, podeEditar } = useCargoNaAcademia();
  const nome = useAuthStore((s) => s.currentUser?.name ?? '');
  const primeiroNome = nome.trim().split(/\s+/)[0] ?? '';

  const { data: courses = [], isLoading: loadingCourses, error: erroCourses, refetch: refetchCourses } = useCourses();
  const { data: modules = [], isLoading: loadingModules, error: erroModules, refetch: refetchModules } = useModules();
  const moduleIds = useMemo(() => modules.map((m) => m.id), [modules]);
  const { data: aulasCruas, isLoading: loadingLessons } = useAllLessons(moduleIds);
  // Desligado (ainda sem módulos) ou buscando, `data` é undefined: só decide "vazio" depois que as aulas chegaram.
  const aulasCarregadas = !loadingLessons && aulasCruas !== undefined;
  const allLessons = useMemo(() => aulasCruas ?? [], [aulasCruas]);
  const { data: progress = {} } = useProgress();
  const { data: entitlements = [] } = useEntitlements();
  const deleteCourse = useDeleteCourse();

  const [courseForm, setCourseForm] = useState<{ editing: KnowledgeCourse | null } | null>(null);
  const [moduleForm, setModuleForm] = useState<{ editing: KnowledgeModule | null } | null>(null);

  const userRef = getCurrentUserRef();
  const isLoading = loadingCourses || loadingModules;
  const erroAoCarregar = erroCourses || erroModules;
  const soLeitura = cargo !== 'admin';

  const aulasPorModulo = useMemo(() => agruparAulas(allLessons), [allLessons]);
  const visiveis = useMemo(
    () => modulosVisiveis(modules, aulasPorModulo, cargo, aulasCarregadas),
    [modules, aulasPorModulo, cargo, aulasCarregadas],
  );
  const modulosLiberados = useMemo(
    () => visiveis.filter((m) => !(soLeitura && computeLocked(m, 'module', m.id, entitlements, TENANT_SLUG, userRef))),
    [visiveis, soLeitura, entitlements, userRef],
  );
  const porCurso = useMemo(() => {
    const mapa: Record<string, KnowledgeModule[]> = {};
    for (const m of visiveis) (mapa[m.course_id ?? GERAL_COURSE_ID] ??= []).push(m);
    return mapa;
  }, [visiveis]);

  const courseLocked = (c: KnowledgeCourse) => soLeitura && computeLocked(c, 'course', c.id, entitlements, TENANT_SLUG, userRef);
  const cursos = courses.filter((c) => cargo === 'admin' || (porCurso[c.id]?.length ?? 0) > 0);
  const avulsos = porCurso[GERAL_COURSE_ID] ?? [];

  const liberadosDoCurso = (key: string) => modulosLiberados.filter((m) => (m.course_id ?? GERAL_COURSE_ID) === key);
  const geral = contarAulas(
    modulosLiberados.filter((m) => !m.course_id || courses.some((c) => c.id === m.course_id && !courseLocked(c))),
    aulasPorModulo,
    progress,
  );

  // "Continue assistindo": 1ª aula não vista, em ordem de curso → módulo → aula.
  const continuar = (() => {
    const chaves = [...cursos.filter((c) => !courseLocked(c)).map((c) => c.id), GERAL_COURSE_ID];
    for (const key of chaves) {
      const mods = liberadosDoCurso(key);
      for (const m of mods) {
        const aulas = aulasPorModulo[m.id] ?? [];
        const i = aulas.findIndex((l) => !progress[l.id]);
        if (i >= 0) {
          const curso = courses.find((c) => c.id === key);
          return { key, lesson: aulas[i], modulo: m, posicao: i + 1, totalDoModulo: aulas.length, cursoTitulo: curso?.titulo ?? 'Aulas avulsas' };
        }
      }
    }
    return null;
  })();

  function abrir(courseKey: string, lessonId?: string) {
    navigate(`/academia/curso/${courseKey}${lessonId ? `?lesson=${lessonId}` : ''}`);
  }

  const temConteudo = cursos.length > 0 || avulsos.length > 0;

  const corpo = (
    <div className="grid gap-8">
      {continuar && (
        <section>
          <h2 className="mb-3 text-lg font-bold">Continue assistindo</h2>
          <button type="button" onClick={() => abrir(continuar.key, continuar.lesson.id)}
            className="grid w-full overflow-hidden rounded-2xl border border-border bg-card text-left transition-colors hover:border-primary/40 md:grid-cols-[280px_1fr]">
            <div className="aspect-video max-w-full overflow-hidden bg-muted">
              {continuar.lesson.capa_url
                ? <img src={continuar.lesson.capa_url} alt="" className="h-full w-full object-cover" />
                : <CapaGerada titulo={continuar.lesson.titulo} semente={continuar.lesson.id} />}
            </div>
            <div className="flex min-w-0 flex-col justify-center gap-1.5 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                Aula {continuar.posicao} de {continuar.totalDoModulo} · {continuar.modulo.titulo}
              </p>
              <p className="truncate text-lg font-bold">{continuar.lesson.titulo}</p>
              <p className="text-sm text-muted-foreground">
                {[formatDuration(continuar.lesson.duracao_min), continuar.cursoTitulo].filter(Boolean).join(' · ')}
              </p>
            </div>
          </button>
        </section>
      )}

      {isLoading && <Carregando variante="cartoes" rotulo="Carregando..." />}

      {!isLoading && !temConteudo && erroAoCarregar && (
        <EmptyState tipo="erro" aoTentarDeNovo={() => { if (erroCourses) void refetchCourses(); if (erroModules) void refetchModules(); }} />
      )}
      {!isLoading && !temConteudo && !erroAoCarregar && (
        <EmptyState icon={GraduationCap} title="Nenhum curso ainda."
          description={podeEditar ? 'Crie um curso pra montar a área de membros.' : 'Em breve teremos conteúdo aqui.'} />
      )}

      {cursos.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold">Cursos</h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {cursos.map((c) => {
              const locked = courseLocked(c);
              const doCurso = porCurso[c.id] ?? [];
              const conta = contarAulas(liberadosDoCurso(c.id), aulasPorModulo, progress);
              return (
                <CourseCard key={c.id} id={c.id} titulo={c.titulo} descricao={c.descricao} capaUrl={c.capa_url}
                  locked={locked} restricted={c.access === 'restricted'} soGestores={soParaGestores(doCurso)} lock={c}
                  modulos={doCurso.length} progress={{ done: conta.feitas, total: conta.total, minutos: conta.minutos }}
                  onOpen={() => (locked ? undefined : abrir(c.id))}
                  onEdit={podeEditar ? () => setCourseForm({ editing: c }) : undefined}
                  onDelete={podeEditar ? async () => {
                    if (await confirmar({
                      titulo: 'Excluir curso',
                      descricao: <>Excluir o curso <strong>{c.titulo}</strong>? Os módulos ficam em Aulas avulsas, nenhum é excluído.</>,
                      rotuloDaAcao: 'Excluir', destrutivo: true,
                    })) deleteCourse.mutate(c.id);
                  } : undefined} />
              );
            })}
          </div>
        </section>
      )}

      {avulsos.length > 0 && (
        <section>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-bold">Aulas avulsas</h2>
            <span className="text-sm text-muted-foreground">Conteúdo rápido, fora dos cursos</span>
          </div>
          <div className="grid gap-2.5">
            {avulsos.map((m) => {
              const aulas = aulasPorModulo[m.id] ?? [];
              const preso = soLeitura && computeLocked(m, 'module', m.id, entitlements, TENANT_SLUG, userRef);
              const conta = contarAulas(preso ? [] : [m], aulasPorModulo, progress);
              const vazio = aulasCarregadas && aulas.length === 0;
              const inerte = vazio || preso;
              return (
                <Card key={m.id} className={`flex-row items-center gap-4 p-3 ${vazio && !preso ? 'border-dashed opacity-80' : 'hover:border-primary/40'}`}>
                  <button type="button" disabled={inerte} onClick={() => abrir(GERAL_COURSE_ID, aulas[0]?.id)}
                    className="flex min-w-0 flex-1 items-center gap-4 text-left disabled:cursor-default">
                    <div className="aspect-video w-24 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {m.capa_url ? <img src={m.capa_url} alt="" className="h-full w-full object-cover" /> : <CapaGerada titulo="" semente={m.id} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 font-semibold">
                        <span className="truncate">{m.titulo}</span>
                        {quemAssiste(m) === 'managers' && <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">Gestores</span>}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {preso ? (m.lock_message?.trim() || 'Conteúdo exclusivo. Libere pra assistir.')
                          : vazio ? 'Sem aulas ainda. Só a Leal Mídia vê este módulo.'
                          : aulasCarregadas ? [`${conta.total} ${conta.total === 1 ? 'aula' : 'aulas'}`, formatDuration(conta.minutos)].filter(Boolean).join(' · ')
                          : ''}
                      </p>
                    </div>
                    {preso ? <Lock className="h-4 w-4 text-muted-foreground" aria-label="Bloqueado" />
                      : !vazio && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </button>
                  {preso && <LockCta lock={m} />}
                  {podeEditar && (
                    <button type="button" onClick={() => setModuleForm({ editing: m })} aria-label="Editar módulo" title="Editar módulo"
                      className="rounded-lg p-1.5 text-muted-foreground hover:text-primary">
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                </Card>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );

  return (
    <>
      <div className={embedded ? 'flex-1 overflow-y-auto' : ''}>
        <BarraDaLealMidia>
          <Button variant="outline" size="sm" type="button" onClick={() => setModuleForm({ editing: null })}>
            <FolderPlus className="h-4 w-4" /> Novo módulo
          </Button>
          <Button size="sm" type="button" onClick={() => setCourseForm({ editing: null })}>
            <Plus className="h-4 w-4" /> Novo curso
          </Button>
        </BarraDaLealMidia>
        {embedded ? (
          <div className="mx-auto grid max-w-6xl gap-8 px-5 py-7 md:px-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-lg font-bold">{primeiroNome ? `Olá, ${primeiroNome}` : 'Olá'}</p>
                <p className="text-sm text-muted-foreground">Aulas curtas pra tirar o máximo do LM Flow e vender mais.</p>
              </div>
              {geral.total > 0 && <AnelDeProgresso feitas={geral.feitas} total={geral.total} />}
            </div>
            {corpo}
          </div>
        ) : (
          <Pagina
            cabecalho={
              <BaseHeader
                title={primeiroNome ? `Olá, ${primeiroNome}` : 'Olá'}
                subtitle="Aulas curtas pra tirar o máximo do LM Flow e vender mais."
                aDireita={geral.total > 0 ? <AnelDeProgresso feitas={geral.feitas} total={geral.total} /> : undefined}
              />
            }
          >
            {corpo}
          </Pagina>
        )}
      </div>
      {courseForm && <CourseForm editing={courseForm.editing} onClose={() => setCourseForm(null)} />}
      {moduleForm && <ModuleForm editing={moduleForm.editing} onClose={() => setModuleForm(null)} />}
      {dialogoDeConfirmacao}
    </>
  );
}
