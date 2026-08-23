import { useCallback, useEffect, useState, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button, Input, Badge } from '@/components/ui/ds';
import { GitBranch, Plus, Search, Folder, FolderPlus, Pencil, Play, Pause, Copy, Archive, Trash2 } from 'lucide-react';
import EmptyState from '@/components/base/EmptyState';
import { flowAutomationsService, flowAutomationFoldersService } from '@/services/flowAutomations/flowAutomationsService';
import type { FlowAutomation, FlowAutomationFolder } from '@/types/flowAutomations';
import { FLOW_TRIGGER_LABELS } from '@/types/flowAutomations';

// Lista de fluxos — mirror da grade de cards da aba Automações do Hub (12/08):
// filete colorido, selo de estado, menu de ações. Pasta é lugar (entra), não filtro.
export default function FlowAutomationsList() {
  const navigate = useNavigate();
  const [automations, setAutomations] = useState<FlowAutomation[]>([]);
  const [folders, setFolders] = useState<FlowAutomationFolder[]>([]);
  const [folderId, setFolderId] = useState<string | null | undefined>(undefined); // undefined = "todas"
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, fldrs] = await Promise.all([
        flowAutomationsService.list({ search: search || undefined, folderId }),
        flowAutomationFoldersService.list(),
      ]);
      setAutomations(list);
      setFolders(fldrs);
    } catch {
      toast.error('Erro ao carregar fluxos');
    } finally {
      setLoading(false);
    }
  }, [search, folderId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    try {
      const created = await flowAutomationsService.create({ name: 'Novo fluxo', folder_id: folderId ?? null });
      navigate(`/automations/flow-builder/${created.id}`);
    } catch {
      toast.error('Erro ao criar fluxo');
    }
  };

  const toggle = async (a: FlowAutomation) => {
    try {
      await flowAutomationsService.toggle(a.id);
      load();
    } catch {
      toast.error('Erro ao ligar/desligar');
    }
  };

  const duplicate = async (a: FlowAutomation) => {
    try {
      await flowAutomationsService.duplicate(a.id);
      toast.success('Fluxo duplicado');
      load();
    } catch {
      toast.error('Erro ao duplicar');
    }
  };

  const archive = async (a: FlowAutomation) => {
    try {
      await flowAutomationsService.archive(a.id);
      load();
    } catch {
      toast.error('Erro ao arquivar');
    }
  };

  const destroy = async (a: FlowAutomation) => {
    if (!window.confirm(`Excluir "${a.name}"? Essa ação não pode ser desfeita.`)) return;
    try {
      await flowAutomationsService.destroy(a.id);
      toast.success('Fluxo removido');
      load();
    } catch {
      toast.error('Erro ao remover');
    }
  };

  const createFolder = async () => {
    const name = window.prompt('Nome da pasta:');
    if (!name?.trim()) return;
    try {
      await flowAutomationFoldersService.create({ name: name.trim() });
      load();
    } catch {
      toast.error('Erro ao criar pasta');
    }
  };

  const renameFolder = async (f: FlowAutomationFolder, ev: MouseEvent) => {
    ev.stopPropagation();
    const name = window.prompt('Novo nome da pasta:', f.name);
    if (!name?.trim() || name.trim() === f.name) return;
    try {
      await flowAutomationFoldersService.update(f.id, { name: name.trim() });
      load();
    } catch {
      toast.error('Erro ao renomear pasta');
    }
  };

  const deleteFolder = async (f: FlowAutomationFolder, ev: MouseEvent) => {
    ev.stopPropagation();
    if (!window.confirm(`Excluir a pasta "${f.name}"? Os fluxos de dentro voltam pra "Sem pasta".`)) return;
    try {
      await flowAutomationFoldersService.destroy(f.id);
      load();
    } catch {
      toast.error('Erro ao excluir pasta');
    }
  };

  return (
    <div className="h-full flex flex-col p-4">
      <div className="flex items-center gap-2 mb-2">
        <GitBranch className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold">FlowBuilder</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Editor visual de automações: monte um fluxo com blocos, condições e espera — igual ao editor de automações do Hub.
      </p>

      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Buscar fluxo..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button onClick={handleCreate}><Plus className="h-4 w-4 mr-1" /> Novo fluxo</Button>
      </div>

      {folderId === undefined && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mb-4">
          {folders.map(f => (
            <div key={f.id} className="group relative flex items-center gap-2 rounded-lg border border-border p-3 hover:border-primary transition-colors">
              <button onClick={() => setFolderId(f.id)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                <Folder className="h-4 w-4 shrink-0" style={{ color: f.color }} />
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{f.name}</div>
                  <div className="text-xs text-muted-foreground">{f.automations_count} itens · {f.enabled_count} ligados</div>
                </div>
              </button>
              <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                <button onClick={ev => renameFolder(f, ev)} title="Renomear" className="p-1 rounded hover:bg-accent">
                  <Pencil className="h-3 w-3 text-muted-foreground" />
                </button>
                <button onClick={ev => deleteFolder(f, ev)} title="Excluir pasta" className="p-1 rounded hover:bg-accent">
                  <Trash2 className="h-3 w-3 text-muted-foreground" />
                </button>
              </div>
            </div>
          ))}
          <button
            onClick={createFolder}
            className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
          >
            <FolderPlus className="h-4 w-4" /> Nova pasta
          </button>
        </div>
      )}

      {folderId !== undefined && (
        <button onClick={() => setFolderId(undefined)} className="text-xs text-muted-foreground hover:text-foreground mb-3 self-start">
          ← Voltar pras pastas
        </button>
      )}

      {!loading && automations.length === 0 && (
        <EmptyState icon={GitBranch} title="Nenhum fluxo ainda" description="Crie o primeiro fluxo de automação visual." />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 overflow-auto">
        {automations.map(a => (
          <div key={a.id} className="rounded-lg border border-border overflow-hidden flex">
            <div className="w-1.5 shrink-0" style={{ backgroundColor: a.archived_at ? '#94a3b8' : a.is_enabled ? '#059669' : '#dc2626' }} />
            <div className="flex-1 p-3 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-1">
                <button className="text-sm font-semibold truncate hover:underline text-left" onClick={() => navigate(`/automations/flow-builder/${a.id}`)}>
                  {a.name}
                </button>
                <Badge variant={a.archived_at ? 'secondary' : a.is_enabled ? 'default' : 'outline'} className="shrink-0 text-[10px]">
                  {a.archived_at ? 'ARQUIVADO' : a.is_enabled ? 'ATIVO' : 'DESLIGADO'}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground mb-3 truncate">
                {FLOW_TRIGGER_LABELS[a.trigger?.event as keyof typeof FLOW_TRIGGER_LABELS] || 'Sem gatilho definido'}
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" onClick={() => toggle(a)} title={a.is_enabled ? 'Desligar' : 'Ligar'}>
                  {a.is_enabled ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => duplicate(a)} title="Duplicar">
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => archive(a)} title="Arquivar">
                  <Archive className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => destroy(a)} title="Excluir">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
