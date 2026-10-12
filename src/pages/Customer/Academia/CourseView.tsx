// Área de membros — tela do curso: aula à esquerda, lista à direita.
// Quem vê o quê: quemVe.ts. Corretor que abre link de aula/curso de gestor vê o aviso.

import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, FolderPlus, Pencil, PlayCircle } from 'lucide-react';
import {
  useCourses, useModules, useAllLessons, useProgress, useEntitlements, useDeleteModule, useUpdateModule,
  computeLocked, getCurrentUserRef, TENANT_SLUG,
  type KnowledgeLesson, type KnowledgeModule, type KnowledgeCourse,
} from '@/hooks/useKnowledge';
import Carregando from '@/components/base/Carregando';
import EmptyState from '@/components/base/EmptyState';
import Aviso from '@/components/base/Aviso';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { Button } from '@/components/ui/ds';
import LockOverlay from './LockOverlay';
import ModuleForm from './ModuleForm';
import CourseForm from './CourseForm';
import BarraDaLealMidia from './BarraDaLealMidia';
import JanelaDaAula from './curso/JanelaDaAula';
import ListaDeAulas from './curso/ListaDeAulas';
import PainelDaAula from './curso/PainelDaAula';
import { GERAL_COURSE_ID } from './_lib';
import { useCargoNaAcademia } from './useCargoNaAcademia';
import { agruparAulas, modulosVisiveis, podeAssistir, trocarOrdem } from './quemVe';

export default function CourseView({ onBack }: { onBack: () => void }) {
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const { courseId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const { cargo, podeEditar, pronto } = useCargoNaAcademia();
  const soLeitura = cargo !== 'admin';

  const { data: courses = [] } = useCourses();
  const { data: allModules = [], isLoading: carregandoModulos, error: erroModulos, refetch: recarregarModulos } = useModules();
  const { data: entitlements = [] } = useEntitlements();
  const { data: progress = {} } = useProgress();
  const deleteModule = useDeleteModule();
  const updateModule = useUpdateModule();
  const userRef = getCurrentUserRef();

  const isGeral = courseId === GERAL_COURSE_ID;
  const course: KnowledgeCourse | null = isGeral ? null : courses.find((c) => c.id === courseId) ?? null;
  const titulo = isGeral ? 'Aulas avulsas' : course?.titulo ?? 'Curso';

  const doCurso = useMemo(
    () => allModules.filter((m) => (isGeral ? m.course_id == null : m.course_id === courseId))
      .sort((a, b) => a.ordem - b.ordem || a.created_at.localeCompare(b.created_at)),
    [allModules, courseId, isGeral],
  );
  const { data: aulasCruas, isLoading: carregandoAulas } = useAllLessons(useMemo(() => doCurso.map((m) => m.id), [doCurso]));
  // Desligado (ainda sem módulos) ou buscando, `data` é undefined: só decide "vazio" depois que as aulas chegaram.
  const aulasCarregadas = !carregandoAulas && aulasCruas !== undefined;
  const allLessons = useMemo(() => aulasCruas ?? [], [aulasCruas]);
  const aulasPorModulo = useMemo(() => agruparAulas(allLessons), [allLessons]);
  const modulos = useMemo(() => modulosVisiveis(doCurso, aulasPorModulo, cargo, aulasCarregadas), [doCurso, aulasPorModulo, cargo, aulasCarregadas]);

  const travado = (m: KnowledgeModule) => soLeitura && computeLocked(m, 'module', m.id, entitlements, TENANT_SLUG, userRef);
  const abertas: KnowledgeLesson[] = useMemo(
    () => modulos.filter((m) => !travado(m)).flatMap((m) => aulasPorModulo[m.id] ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [modulos, aulasPorModulo, entitlements, userRef, soLeitura],
  );

  const pedida = params.get('lesson');
  const [selecionada, setSelecionada] = useState<string | null>(pedida);
  const aulaPedidaDeGestor = useMemo(() => {
    if (!pedida || cargo !== 'corretor') return false;
    const l = allLessons.find((x) => x.id === pedida);
    const m = l && doCurso.find((x) => x.id === l.module_id);
    return !!m && !podeAssistir(m, cargo);
  }, [pedida, cargo, allLessons, doCurso]);

  useEffect(() => {
    if (aulaPedidaDeGestor) return;
    if (selecionada && abertas.some((l) => l.id === selecionada)) return;
    if (abertas.length === 0) return;
    setSelecionada((abertas.find((l) => !progress[l.id]) ?? abertas[0]).id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abertas, aulaPedidaDeGestor]);

  useEffect(() => {
    if (!selecionada) return;
    const next = new URLSearchParams(params);
    next.set('lesson', selecionada);
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selecionada]);

  const [cursoForm, setCursoForm] = useState(false);
  const [moduloForm, setModuloForm] = useState<{ editing: KnowledgeModule | null } | null>(null);
  const [aulaForm, setAulaForm] = useState<{ moduleId: string; editing: KnowledgeLesson | null } | null>(null);

  const [movendo, setMovendo] = useState(false);
  async function moverModulo(m: KnowledgeModule, dir: -1 | 1) {
    if (movendo) return;
    // Ordem empatada (tudo 0) não troca nada: regrava o índice de cada módulo que mudou.
    const mudancas = trocarOrdem(modulos, modulos.findIndex((x) => x.id === m.id), dir);
    if (mudancas.length === 0) return;
    setMovendo(true);
    try {
      for (const c of mudancas) await updateModule.mutateAsync(c);
    } catch {
      /* o hook já avisa o erro */
    } finally {
      setMovendo(false);
    }
  }

  const barra = (
    <div className="flex items-center gap-3 border-b border-border px-5 py-3 md:px-8">
      <button onClick={onBack} type="button" className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4 shrink-0" /><span className="truncate font-semibold text-foreground">{titulo}</span>
      </button>
    </div>
  );

  // Curso inteiro sem nada que esta pessoa possa assistir (ex.: corretor num curso só de gestor).
  if (!carregandoModulos && aulasCarregadas && cargo !== 'admin' && doCurso.length > 0 && modulos.length === 0) {
    const deGestor = doCurso.some((m) => !podeAssistir(m, cargo));
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <BarraDaLealMidia />
        {barra}
        {deGestor && !pronto ? (
          <Carregando variante="texto" linhas={6} className="p-10" />
        ) : (
          <div className="mx-auto max-w-md p-8">
            <Aviso tom="neutro" titulo={deGestor ? 'Este curso é só para gestores' : 'Nenhuma aula neste curso ainda.'}>
              {deGestor ? 'Peça a um gestor da sua imobiliária se precisar deste conteúdo.' : 'Volte em breve.'}
            </Aviso>
          </div>
        )}
      </div>
    );
  }

  if (course && soLeitura && computeLocked(course, 'course', course.id, entitlements, TENANT_SLUG, userRef)) {
    return (<div className="flex min-h-0 flex-1 flex-col"><BarraDaLealMidia />{barra}<LockOverlay lock={course} /></div>);
  }

  const aula = abertas.find((l) => l.id === selecionada) ?? null;
  const idx = aula ? abertas.findIndex((l) => l.id === aula.id) : -1;
  const moduloDaAula = aula ? modulos.find((m) => m.id === aula.module_id) ?? null : null;

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col">
        <BarraDaLealMidia>
          {course && <Button variant="outline" size="sm" type="button" onClick={() => setCursoForm(true)}><Pencil className="h-4 w-4" /> Editar curso</Button>}
          <Button size="sm" type="button" onClick={() => setModuloForm({ editing: null })}><FolderPlus className="h-4 w-4" /> Novo módulo</Button>
        </BarraDaLealMidia>
        {barra}
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <div className="order-1 min-w-0 flex-1 overflow-y-auto">
            {aulaPedidaDeGestor && !pronto ? (
              <Carregando variante="texto" linhas={6} className="p-10" />
            ) : aulaPedidaDeGestor ? (
              <div className="mx-auto max-w-md p-8">
                <Aviso tom="neutro" titulo="Esta aula é só para gestores">Escolha outra aula na lista.</Aviso>
              </div>
            ) : aula && moduloDaAula ? (
              <PainelDaAula key={aula.id} aula={aula} modulo={moduloDaAula} aulasDoModulo={aulasPorModulo[moduloDaAula.id] ?? []}
                proxima={abertas[idx + 1] ?? null} anterior={abertas[idx - 1] ?? null}
                cursoId={courseId} cursoTitulo={titulo} podeEditar={podeEditar}
                aoIr={setSelecionada} aoExcluida={() => setSelecionada(null)}
                aoEditar={() => setAulaForm({ moduleId: aula.module_id, editing: aula })} />
            ) : modulos.length === 0 && carregandoModulos ? (
              <Carregando variante="texto" linhas={6} className="p-10" />
            ) : modulos.length === 0 && erroModulos ? (
              <EmptyState tipo="erro" className="h-full min-h-[280px]" aoTentarDeNovo={() => void recarregarModulos()} />
            ) : modulos.length === 0 ? (
              <EmptyState icon={PlayCircle} title="Nenhum módulo neste curso ainda." className="h-full min-h-[280px]" />
            ) : (
              <EmptyState icon={PlayCircle} title="Escolha uma aula na lista." className="h-full min-h-[280px]" />
            )}
          </div>
          <ListaDeAulas titulo={titulo} modulos={modulos} aulasPorModulo={aulasPorModulo} progresso={progress}
            selecionada={aulaPedidaDeGestor ? null : selecionada} travado={travado} podeEditar={podeEditar}
            aoEscolher={(id) => { setSelecionada(id); if (aulaPedidaDeGestor) setParams(new URLSearchParams({ lesson: id }), { replace: true }); }}
            aoEditarModulo={(m) => setModuloForm({ editing: m })}
            aoExcluirModulo={async (m) => {
              if (await confirmar({ titulo: 'Excluir módulo', descricao: <>Excluir o módulo <strong>{m.titulo}</strong> e todas as aulas dentro?</>, rotuloDaAcao: 'Excluir', destrutivo: true })) deleteModule.mutate(m.id);
            }}
            aoMoverModulo={moverModulo} travarSetas={movendo}
            aoNovaAula={(m) => setAulaForm({ moduleId: m.id, editing: null })} />
        </div>
      </div>
      {cursoForm && course && <CourseForm editing={course} onClose={() => setCursoForm(false)} />}
      {moduloForm && <ModuleForm editing={moduloForm.editing} defaultCourseId={isGeral ? null : courseId} onClose={() => setModuloForm(null)} />}
      {aulaForm && <JanelaDaAula moduleId={aulaForm.moduleId} editing={aulaForm.editing} onClose={() => setAulaForm(null)} />}
      {dialogoDeConfirmacao}
    </>
  );
}
