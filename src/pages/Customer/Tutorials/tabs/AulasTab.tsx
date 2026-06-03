// Aba Aulas — modulos + aulas em video (embed YT/Vimeo).

import { useState } from 'react';
import { Plus, PlayCircle, ArrowLeft, Trash2, X, Clock, GraduationCap } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  useModules,
  useCreateModule,
  useDeleteModule,
  useLessons,
  useCreateLesson,
  useDeleteLesson,
  type KnowledgeModule,
  type KnowledgeLesson,
} from '@/hooks/useKnowledge';
import { parseVideoUrl, formatDuration } from '../_internal/lib';
import VideoEmbed from '../_internal/VideoEmbed';

interface Props {
  canEdit: boolean;
}

export default function AulasTab({ canEdit }: Props) {
  const { data: modules = [], isLoading } = useModules();
  const createModule = useCreateModule();
  const deleteModule = useDeleteModule();

  const [selectedModule, setSelectedModule] = useState<KnowledgeModule | null>(null);
  const [creatingModule, setCreatingModule] = useState(false);
  const [modTitulo, setModTitulo] = useState('');
  const [modDescricao, setModDescricao] = useState('');

  if (selectedModule) {
    return (
      <ModuleDetail
        module={selectedModule}
        onBack={() => setSelectedModule(null)}
        canEdit={canEdit}
      />
    );
  }

  async function handleCreateModule() {
    if (!modTitulo.trim()) return;
    await createModule.mutateAsync({
      titulo: modTitulo.trim(),
      descricao: modDescricao.trim() || undefined,
    });
    setModTitulo('');
    setModDescricao('');
    setCreatingModule(false);
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center justify-between px-6 py-3 border-b border-border">
        <span className="text-xs text-muted-foreground">
          {modules.length} modulo{modules.length === 1 ? '' : 's'}
        </span>
        {canEdit && !creatingModule && (
          <button
            onClick={() => setCreatingModule(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-primary-foreground bg-primary hover:opacity-90 rounded-lg"
            type="button"
          >
            <Plus size={12} /> Novo modulo
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        {creatingModule && (
          <div className="mb-6 bg-card border border-border rounded-xl p-4 space-y-3 max-w-2xl">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold">Novo modulo</p>
              <button
                onClick={() => setCreatingModule(false)}
                type="button"
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={14} />
              </button>
            </div>
            <input
              autoFocus
              value={modTitulo}
              onChange={(e) => setModTitulo(e.target.value)}
              placeholder="Nome do modulo (ex.: Onboarding interno)"
              className="w-full bg-background border border-border rounded px-3 py-2 text-sm"
            />
            <textarea
              value={modDescricao}
              onChange={(e) => setModDescricao(e.target.value)}
              placeholder="Descricao (opcional)"
              rows={2}
              className="w-full bg-background border border-border rounded px-3 py-2 text-sm resize-y"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setCreatingModule(false)}
                className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                type="button"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateModule}
                className="px-3 py-1.5 text-xs text-primary-foreground bg-primary hover:opacity-90 rounded-lg"
                type="button"
              >
                Criar
              </button>
            </div>
          </div>
        )}

        {isLoading && <p className="text-xs text-muted-foreground">Carregando...</p>}
        {!isLoading && modules.length === 0 && !creatingModule && (
          <div className="text-center py-16">
            <GraduationCap
              size={40}
              className="mx-auto text-muted-foreground/40 mb-3"
              strokeWidth={1.5}
            />
            <p className="text-sm text-muted-foreground">Nenhuma aula ainda.</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              {canEdit
                ? 'Crie um modulo pra comecar a montar a area de aulas.'
                : 'Aguarde — em breve teremos conteudo aqui.'}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map((m) => (
            <ModuleCard
              key={m.id}
              module={m}
              onOpen={() => setSelectedModule(m)}
              onDelete={
                canEdit
                  ? () => {
                      if (
                        window.confirm(`Excluir modulo "${m.titulo}" e todas as aulas dentro?`)
                      ) {
                        deleteModule.mutate(m.id);
                      }
                    }
                  : null
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ModuleCard({
  module: m,
  onOpen,
  onDelete,
}: {
  module: KnowledgeModule;
  onOpen: () => void;
  onDelete: (() => void) | null;
}) {
  return (
    <div className="group relative bg-card border border-border hover:border-primary/30 rounded-xl overflow-hidden transition-colors">
      <button onClick={onOpen} className="w-full text-left" type="button">
        <div className="aspect-video bg-gradient-to-br from-primary/20 via-purple-500/10 to-muted flex items-center justify-center relative overflow-hidden">
          {m.capa_url ? (
            <img src={m.capa_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <PlayCircle size={40} className="text-primary/70" strokeWidth={1.5} />
          )}
        </div>
        <div className="p-4">
          <p className="text-sm font-semibold">{m.titulo}</p>
          {m.descricao && (
            <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{m.descricao}</p>
          )}
        </div>
      </button>
      {onDelete && (
        <button
          onClick={onDelete}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1.5 bg-black/40 text-white hover:text-red-400 rounded-lg backdrop-blur transition-all"
          type="button"
        >
          <Trash2 size={12} />
        </button>
      )}
    </div>
  );
}

function ModuleDetail({
  module: m,
  onBack,
  canEdit,
}: {
  module: KnowledgeModule;
  onBack: () => void;
  canEdit: boolean;
}) {
  const { data: lessons = [], isLoading } = useLessons(m.id);
  const createLesson = useCreateLesson();
  const deleteLesson = useDeleteLesson();

  const [selected, setSelected] = useState<KnowledgeLesson | null>(null);
  const [creating, setCreating] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [duracao, setDuracao] = useState('');
  const [descricao, setDescricao] = useState('');

  async function handleCreate() {
    if (!titulo.trim() || !videoUrl.trim()) return;
    if (!parseVideoUrl(videoUrl)) {
      window.alert('URL invalida — cole link do YouTube ou Vimeo.');
      return;
    }
    await createLesson.mutateAsync({
      module_id: m.id,
      titulo: titulo.trim(),
      video_url: videoUrl.trim(),
      descricao_md: descricao || undefined,
      duracao_min: duracao ? parseInt(duracao, 10) : undefined,
    });
    setTitulo('');
    setVideoUrl('');
    setDuracao('');
    setDescricao('');
    setCreating(false);
  }

  if (selected) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between px-6 py-3 border-b border-border">
          <button
            onClick={() => setSelected(null)}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
            type="button"
          >
            <ArrowLeft size={14} /> Voltar para o modulo
          </button>
          {canEdit && (
            <button
              onClick={() => {
                if (window.confirm(`Excluir aula "${selected.titulo}"?`)) {
                  deleteLesson.mutate(selected.id);
                  setSelected(null);
                }
              }}
              className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-500 border border-red-500/30 hover:bg-red-500/10 rounded-lg"
              type="button"
            >
              <Trash2 size={12} /> Excluir aula
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full">
          <h1 className="text-2xl font-bold mb-1">{selected.titulo}</h1>
          {selected.duracao_min && (
            <p className="text-xs text-muted-foreground mb-4 flex items-center gap-1">
              <Clock size={11} /> {formatDuration(selected.duracao_min)}
            </p>
          )}
          <VideoEmbed
            provider={selected.video_provider}
            videoId={selected.video_id}
            className="mb-6"
          />
          {selected.descricao_md && (
            <article className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{selected.descricao_md}</ReactMarkdown>
            </article>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center justify-between px-6 py-3 border-b border-border">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
          type="button"
        >
          <ArrowLeft size={14} /> Modulos
        </button>
        {canEdit && !creating && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-primary-foreground bg-primary hover:opacity-90 rounded-lg"
            type="button"
          >
            <Plus size={12} /> Nova aula
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mb-6">
          <h2 className="text-xl font-bold">{m.titulo}</h2>
          {m.descricao && <p className="text-sm text-muted-foreground mt-1">{m.descricao}</p>}
        </div>

        {creating && (
          <div className="mb-6 bg-card border border-border rounded-xl p-4 space-y-3 max-w-2xl">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold">Nova aula</p>
              <button
                onClick={() => setCreating(false)}
                type="button"
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={14} />
              </button>
            </div>
            <input
              autoFocus
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Titulo da aula"
              className="w-full bg-background border border-border rounded px-3 py-2 text-sm"
            />
            <input
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="URL YouTube ou Vimeo"
              className="w-full bg-background border border-border rounded px-3 py-2 text-sm"
            />
            <input
              value={duracao}
              onChange={(e) => setDuracao(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="Duracao em minutos (opcional)"
              className="w-full bg-background border border-border rounded px-3 py-2 text-sm"
            />
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descricao em markdown (opcional) — links em [texto](url)"
              rows={3}
              className="w-full bg-background border border-border rounded px-3 py-2 text-sm resize-y"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setCreating(false)}
                className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                type="button"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                className="px-3 py-1.5 text-xs text-primary-foreground bg-primary hover:opacity-90 rounded-lg"
                type="button"
              >
                Adicionar
              </button>
            </div>
          </div>
        )}

        {isLoading && <p className="text-xs text-muted-foreground">Carregando...</p>}
        {!isLoading && lessons.length === 0 && !creating && (
          <p className="text-xs text-muted-foreground text-center py-8">
            Nenhuma aula neste modulo.
          </p>
        )}

        <div className="space-y-2 max-w-3xl">
          {lessons.map((lesson, idx) => (
            <button
              key={lesson.id}
              onClick={() => setSelected(lesson)}
              className="w-full text-left bg-card border border-border hover:border-primary/30 rounded-xl p-4 transition-colors flex items-center gap-4"
              type="button"
            >
              <span className="shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                {idx + 1}
              </span>
              <PlayCircle size={20} className="text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{lesson.titulo}</p>
                <p className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5">
                  {lesson.video_provider === 'youtube' ? 'YouTube' : 'Vimeo'}
                  {lesson.duracao_min && (
                    <>
                      <span>·</span>
                      <Clock size={10} />
                      {formatDuration(lesson.duracao_min)}
                    </>
                  )}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
