// Aba Aulas — catálogo de módulos no estilo área de membros. Abre o CoursePlayer.

import { useMemo, useRef, useState } from 'react';
import { Plus, PlayCircle, Trash2, X, Pencil, GraduationCap, Lock, ImagePlus, Loader2 } from 'lucide-react';
import {
  useModules,
  useCreateModule,
  useUpdateModule,
  useDeleteModule,
  useUploadModuleCover,
  useAllLessons,
  useProgress,
  TENANT_SLUG,
  type KnowledgeModule,
} from '@/hooks/useKnowledge';
import CoursePlayer from '../_internal/CoursePlayer';

interface Props {
  canEdit: boolean;
}

export default function AulasTab({ canEdit }: Props) {
  const { data: modules = [], isLoading } = useModules();
  const deleteModule = useDeleteModule();

  const moduleIds = useMemo(() => modules.map((m) => m.id), [modules]);
  const { data: allLessons = [] } = useAllLessons(moduleIds);
  const { data: progress = {} } = useProgress();

  const [openModule, setOpenModule] = useState<KnowledgeModule | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<KnowledgeModule | null>(null);

  // Progresso por módulo + global.
  const byModule = useMemo(() => {
    const map: Record<string, { total: number; done: number }> = {};
    for (const l of allLessons) {
      const e = (map[l.module_id] ??= { total: 0, done: 0 });
      e.total += 1;
      if (progress[l.id]) e.done += 1;
    }
    return map;
  }, [allLessons, progress]);

  const globalPct =
    allLessons.length > 0
      ? Math.round((allLessons.filter((l) => progress[l.id]).length / allLessons.length) * 100)
      : 0;

  if (openModule) {
    return (
      <CoursePlayer
        key={openModule.id}
        module={openModule}
        onBack={() => setOpenModule(null)}
        canEdit={canEdit}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between px-6 py-3 border-b border-border gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <span className="text-xs text-muted-foreground shrink-0">
            {modules.length} módulo{modules.length === 1 ? '' : 's'}
          </span>
          {allLessons.length > 0 && (
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] text-muted-foreground shrink-0">Seu progresso</span>
              <div className="h-1.5 w-32 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all" style={{ width: `${globalPct}%` }} />
              </div>
              <span className="text-[10px] text-primary font-semibold shrink-0">{globalPct}%</span>
            </div>
          )}
        </div>
        {canEdit && !showForm && (
          <button
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-primary-foreground bg-primary hover:opacity-90 rounded-lg shrink-0"
            type="button"
          >
            <Plus size={12} /> Novo módulo
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {showForm && (
          <ModuleForm
            editing={editing}
            onClose={() => {
              setShowForm(false);
              setEditing(null);
            }}
          />
        )}

        {isLoading && <p className="text-xs text-muted-foreground">Carregando...</p>}
        {!isLoading && modules.length === 0 && !showForm && (
          <div className="text-center py-16">
            <GraduationCap size={40} className="mx-auto text-muted-foreground/40 mb-3" strokeWidth={1.5} />
            <p className="text-sm text-muted-foreground">Nenhum módulo ainda.</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              {canEdit
                ? 'Crie um módulo pra montar a área de membros.'
                : 'Em breve teremos conteúdo aqui.'}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map((m) => {
            const prog = byModule[m.id] ?? { total: 0, done: 0 };
            const pct = prog.total ? Math.round((prog.done / prog.total) * 100) : 0;
            return (
              <div
                key={m.id}
                className="group relative bg-card border border-border hover:border-primary/30 rounded-xl overflow-hidden transition-colors"
              >
                <button onClick={() => setOpenModule(m)} className="w-full text-left" type="button">
                  <div className="aspect-video bg-gradient-to-br from-primary/20 via-purple-500/10 to-muted flex items-center justify-center relative overflow-hidden">
                    {m.capa_url ? (
                      <img src={m.capa_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <PlayCircle size={40} className="text-primary/70" strokeWidth={1.5} />
                    )}
                    {m.tenant_slug && (
                      <span className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 text-[9px] font-semibold bg-black/55 text-white rounded-full backdrop-blur">
                        <Lock size={9} /> Exclusivo
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="text-sm font-semibold">{m.titulo}</p>
                    {m.descricao && (
                      <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{m.descricao}</p>
                    )}
                    {prog.total > 0 && (
                      <div className="mt-3">
                        <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {prog.done}/{prog.total} aulas · {pct}%
                        </p>
                      </div>
                    )}
                  </div>
                </button>

                {canEdit && (
                  <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button
                      onClick={() => {
                        setEditing(m);
                        setShowForm(true);
                      }}
                      className="p-1.5 bg-black/40 text-white hover:text-primary rounded-lg backdrop-blur"
                      title="Editar módulo"
                      type="button"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`Excluir módulo "${m.titulo}" e todas as aulas dentro?`)) {
                          deleteModule.mutate(m.id);
                        }
                      }}
                      className="p-1.5 bg-black/40 text-white hover:text-red-400 rounded-lg backdrop-blur"
                      title="Excluir módulo"
                      type="button"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Form de criar/editar módulo (escopo global x cliente) ─────────────────
function ModuleForm({ editing, onClose }: { editing: KnowledgeModule | null; onClose: () => void }) {
  const createModule = useCreateModule();
  const updateModule = useUpdateModule();
  const uploadCover = useUploadModuleCover();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [titulo, setTitulo] = useState(editing?.titulo ?? '');
  const [descricao, setDescricao] = useState(editing?.descricao ?? '');
  const [capaUrl, setCapaUrl] = useState(editing?.capa_url ?? '');
  // 'global' = todos os tenants · 'tenant' = só este cliente.
  const [scope, setScope] = useState<'global' | 'tenant'>(editing?.tenant_slug ? 'tenant' : 'global');

  const busy = createModule.isPending || updateModule.isPending;
  const canScopeTenant = Boolean(TENANT_SLUG);

  async function handleCoverFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      window.alert('Selecione um arquivo de imagem.');
      return;
    }
    try {
      const url = await uploadCover.mutateAsync({ file });
      setCapaUrl(url);
    } catch {
      // toast de erro já é exibido pelo hook
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function submit() {
    if (!titulo.trim()) return;
    const tenant_slug = scope === 'tenant' && canScopeTenant ? TENANT_SLUG : null;
    if (editing) {
      await updateModule.mutateAsync({
        id: editing.id,
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        capa_url: capaUrl.trim() || null,
        tenant_slug,
      });
    } else {
      await createModule.mutateAsync({
        titulo: titulo.trim(),
        descricao: descricao.trim() || undefined,
        capa_url: capaUrl.trim() || undefined,
        tenant_slug,
      });
    }
    onClose();
  }

  return (
    <div className="mb-6 bg-card border border-border rounded-xl p-4 space-y-3 max-w-2xl">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold">{editing ? 'Editar módulo' : 'Novo módulo'}</p>
        <button onClick={onClose} type="button" className="text-muted-foreground hover:text-foreground">
          <X size={14} />
        </button>
      </div>
      <input
        autoFocus
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        placeholder="Nome do módulo (ex.: Comece aqui)"
        className="w-full bg-background border border-border rounded px-3 py-2 text-sm"
      />
      <textarea
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
        placeholder="Descrição (opcional)"
        rows={2}
        className="w-full bg-background border border-border rounded px-3 py-2 text-sm resize-y"
      />
      {/* Capa (thumbnail) — upload de imagem ou URL */}
      <div>
        <p className="text-[11px] text-muted-foreground mb-1.5">Capa do módulo (thumbnail)</p>
        <div className="flex items-start gap-3">
          <div className="relative w-32 shrink-0 aspect-video rounded-lg border border-border overflow-hidden bg-gradient-to-br from-primary/20 via-purple-500/10 to-muted flex items-center justify-center">
            {capaUrl ? (
              <>
                <img src={capaUrl} alt="Capa" className="w-full h-full object-cover" />
                <button
                  onClick={() => setCapaUrl('')}
                  className="absolute top-1 right-1 p-1 bg-black/55 text-white hover:text-red-400 rounded-md backdrop-blur"
                  title="Remover capa"
                  type="button"
                >
                  <X size={12} />
                </button>
              </>
            ) : (
              <PlayCircle size={24} className="text-primary/60" strokeWidth={1.5} />
            )}
          </div>

          <div className="flex-1 min-w-0 space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleCoverFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadCover.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border hover:border-primary/40 disabled:opacity-50"
              type="button"
            >
              {uploadCover.isPending ? (
                <>
                  <Loader2 size={12} className="animate-spin" /> Enviando...
                </>
              ) : (
                <>
                  <ImagePlus size={12} /> Enviar imagem
                </>
              )}
            </button>
            <input
              value={capaUrl}
              onChange={(e) => setCapaUrl(e.target.value)}
              placeholder="ou cole uma URL da capa"
              className="w-full bg-background border border-border rounded px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>
      {/* Escopo */}
      <div>
        <p className="text-[11px] text-muted-foreground mb-1">Quem vê este módulo</p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setScope('global')}
            className={`px-3 py-1.5 text-[11px] rounded-lg border ${
              scope === 'global' ? 'bg-primary/15 text-primary border-primary/40' : 'border-border text-muted-foreground'
            }`}
            type="button"
          >
            Global (todos os clientes)
          </button>
          <button
            onClick={() => canScopeTenant && setScope('tenant')}
            disabled={!canScopeTenant}
            className={`px-3 py-1.5 text-[11px] rounded-lg border disabled:opacity-40 ${
              scope === 'tenant' ? 'bg-primary/15 text-primary border-primary/40' : 'border-border text-muted-foreground'
            }`}
            type="button"
            title={canScopeTenant ? '' : 'Disponível só dentro do painel de um cliente'}
          >
            Só este cliente{TENANT_SLUG ? ` (${TENANT_SLUG})` : ''}
          </button>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground" type="button">
          Cancelar
        </button>
        <button
          onClick={submit}
          disabled={busy}
          className="px-3 py-1.5 text-xs text-primary-foreground bg-primary hover:opacity-90 disabled:opacity-50 rounded-lg"
          type="button"
        >
          {busy ? 'Salvando...' : editing ? 'Salvar' : 'Criar'}
        </button>
      </div>
    </div>
  );
}
