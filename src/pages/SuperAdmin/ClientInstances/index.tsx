import { useState, useEffect, useCallback } from 'react';
import { formatDateBR } from '@/utils/dateUtils';
import {
  Plus, RefreshCw, Building2, CheckCircle, AlertCircle, Loader2,
  Copy, ExternalLink, Trash2, ChevronDown, ChevronUp, Users, ToggleLeft,
  BarChart3, List, Archive, ArchiveRestore, UploadCloud, ScrollText, Gauge,
} from 'lucide-react';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Input, Label } from '@evoapi/design-system';
import clientInstancesService, {
  ClientInstance, CreateClientInstancePayload, DashboardData,
} from '@/services/clientInstances/clientInstancesService';
import { buildMasterSsoUrl } from '@/utils/masterSso';
import { useAuth } from '@/contexts/AuthContext';
import MembersModal from './MembersModal';
import FeaturesModal from './FeaturesModal';
import DashboardView from './DashboardView';
import LogsView from './LogsView';
import UserMetricsView from './UserMetricsView';

type ViewTab = 'list' | 'dashboard' | 'logs' | 'metrics';

const STATUS_LABEL: Record<string, string> = {
  pending:               'Aguardando',
  provisioning_railway:  'Criando servidor...',
  active:                'Ativo',
  error:                 'Erro',
};

const STATUS_COLOR: Record<string, string> = {
  pending:               'bg-orange-100 text-orange-700',
  provisioning_railway:  'bg-blue-100 text-blue-700',
  active:                'bg-emerald-100 text-emerald-700',
  error:                 'bg-red-100 text-red-700',
};

function StatusIcon({ status }: { status: string }) {
  if (status === 'active') return <CheckCircle className="h-4 w-4 text-emerald-600" />;
  if (status === 'error')  return <AlertCircle className="h-4 w-4 text-red-600" />;
  return <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />;
}

function InstanceCard({ instance, onDelete, onArchive, onRefresh }: {
  instance: ClientInstance;
  onDelete: () => void;
  onArchive: () => void;
  onRefresh?: () => void;
}) {
  const [expanded, setExpanded]         = useState(false);
  const [copied, setCopied]             = useState(false);
  const [membersOpen, setMembersOpen]   = useState(false);
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const [entering, setEntering]         = useState(false);
  const [syncing, setSyncing]           = useState(false);

  const enterAsMaster = async () => {
    setEntering(true);
    try {
      const res = await clientInstancesService.sso(instance.id);
      const { token, frontend_url, name } = res.data.data;
      window.open(buildMasterSsoUrl(frontend_url, token, name), '_blank');
    } catch (e) {
      console.error('Falha no SSO master:', e);
      alert('Falha ao entrar no CRM do cliente.');
    } finally {
      setEntering(false);
    }
  };

  const copyLink = () => {
    if (!instance.frontend_link) return;
    navigator.clipboard.writeText(instance.frontend_link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const syncFrontend = async () => {
    setSyncing(true);
    try {
      const res = await clientInstancesService.syncFrontend(instance.id);
      alert(`Deploy iniciado: ${res.data.message}`);
    } catch (e: any) {
      const msg = e?.response?.data?.error ?? 'Erro ao iniciar deploy';
      alert(`Falha: ${msg}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="bg-card border rounded-lg p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <StatusIcon status={instance.status} />
              <span className="font-semibold">{instance.name}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[instance.status] ?? ''}`}>
                {STATUS_LABEL[instance.status] ?? instance.status}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{instance.admin_email}</p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {instance.status === 'active' && (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setMembersOpen(true)}>
              <Users className="h-3 w-3" />
              Membros
            </Button>
          )}
          {instance.status === 'active' && (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setFeaturesOpen(true)}>
              <ToggleLeft className="h-3 w-3" />
              Funcoes
            </Button>
          )}
          {instance.status === 'active' && instance.frontend_link && (
            <>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={copyLink}>
                <Copy className="h-3 w-3" />
                {copied ? 'Copiado!' : 'Link'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                disabled={syncing}
                onClick={syncFrontend}
                title="Refaz o deploy Vercel deste tenant com o codigo atual"
              >
                {syncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <UploadCloud className="h-3 w-3" />}
                {syncing ? 'Subindo...' : 'Sync'}
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs gap-1"
                disabled={entering}
                onClick={enterAsMaster}
              >
                <ExternalLink className="h-3 w-3" />
                {entering ? 'Entrando...' : 'Entrar'}
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-orange-600"
            title="Arquivar"
            onClick={onArchive}
          >
            <Archive className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setExpanded(e => !e)}>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <MembersModal instance={instance} open={membersOpen} onClose={() => setMembersOpen(false)} />
      <FeaturesModal
        instance={instance}
        open={featuresOpen}
        onClose={() => setFeaturesOpen(false)}
        onSaved={() => onRefresh?.()}
      />

      {instance.error_message && (
        <p className="mt-2 text-xs text-red-600 bg-red-50 rounded p-2">{instance.error_message}</p>
      )}

      {expanded && (
        <div className="mt-3 border-t pt-3 space-y-2">
          {instance.backend_url && (
            <div className="text-xs">
              <span className="text-muted-foreground">Backend: </span>
              <span className="font-mono">{instance.backend_url}</span>
            </div>
          )}
          {instance.frontend_link && (
            <div className="text-xs">
              <span className="text-muted-foreground">Link cliente: </span>
              <span className="font-mono break-all">{instance.frontend_link}</span>
            </div>
          )}
          {instance.provisioning_log.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-medium text-muted-foreground mb-1">Log de criacao</p>
              <div className="bg-muted rounded p-2 space-y-0.5 max-h-40 overflow-y-auto">
                {instance.provisioning_log.map((entry, i) => (
                  <p key={i} className="text-xs font-mono">
                    <span className="text-muted-foreground">{new Date(entry.time).toLocaleTimeString('pt-BR')} </span>
                    {entry.message}
                  </p>
                ))}
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Criado em {formatDateBR(instance.created_at)}
          </p>
        </div>
      )}
    </div>
  );
}

function NewClientModal({ open, onClose, onCreate }: {
  open: boolean;
  onClose: () => void;
  onCreate: () => void;
}) {
  const [form, setForm]   = useState<CreateClientInstancePayload>({ name: '', admin_email: '', admin_name: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const submit = async () => {
    if (!form.name || !form.admin_email) return;
    setLoading(true);
    setError('');
    try {
      await clientInstancesService.create(form);
      onCreate();
      onClose();
      setForm({ name: '', admin_email: '', admin_name: '' });
    } catch (e: any) {
      const d = e?.response?.data;
      setError(d?.errors?.join(', ') ?? d?.error ?? d?.message ?? 'Erro ao criar instancia');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Novo Cliente</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Nome da imobiliaria *</Label>
            <Input
              placeholder="Ex: Imobiliaria Casa Grande"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Nome do responsavel</Label>
            <Input
              placeholder="Ex: Joao Silva"
              value={form.admin_name}
              onChange={e => setForm(f => ({ ...f, admin_name: e.target.value }))}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Email de acesso *</Label>
            <Input
              type="email"
              placeholder="Ex: joao@casagrande.com.br"
              value={form.admin_email}
              onChange={e => setForm(f => ({ ...f, admin_email: e.target.value }))}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Este sera o login do cliente no CRM dele.
            </p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={submit} disabled={loading || !form.name || !form.admin_email}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            Criar CRM
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ClientInstances() {
  const { user } = useAuth();
  const [tab, setTab]               = useState<ViewTab>('list');
  const [showArchived, setShowArchived] = useState(false);

  const [instances, setInstances]   = useState<ClientInstance[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  const [dashData, setDashData]     = useState<DashboardData | null>(null);
  const [loadingDash, setLoadingDash] = useState(false);

  const [modalOpen, setModalOpen]   = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);

  const loadList = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await clientInstancesService.list(showArchived);
      setInstances(res.data.data);
    } catch {
      setInstances([]);
    } finally {
      setLoadingList(false);
    }
  }, [showArchived]);

  const loadDashboard = useCallback(async () => {
    setLoadingDash(true);
    try {
      const res = await clientInstancesService.dashboard();
      setDashData(res.data.data);
    } catch {
      setDashData(null);
    } finally {
      setLoadingDash(false);
    }
  }, []);

  useEffect(() => { loadList(); }, [loadList]);
  useEffect(() => { if (tab === 'dashboard') loadDashboard(); }, [tab, loadDashboard]);

  // Auto-refresh while provisioning
  useEffect(() => {
    const provisioning = instances.some(i => i.status !== 'active' && i.status !== 'error');
    if (!provisioning) return;
    const t = setTimeout(loadList, 10_000);
    return () => clearTimeout(t);
  }, [instances, loadList]);

  const handleDelete = async (id: number) => {
    if (!confirm('Remover esta instancia? Isso nao apaga o Railway/Vercel, so o registro.')) return;
    await clientInstancesService.delete(id);
    loadList();
  };

  const handleArchive = async (id: number) => {
    if (!confirm('Arquivar este cliente? Ele some da lista principal mas pode ser restaurado.')) return;
    await clientInstancesService.archive(id);
    loadList();
    if (tab === 'dashboard') loadDashboard();
  };

  const handleUnarchive = async (id: number) => {
    await clientInstancesService.unarchive(id);
    loadList();
  };

  const handleRefresh = () => {
    if (tab === 'list') loadList();
    else loadDashboard();
  };

  const handleSyncAll = async () => {
    if (!confirm('Vai fazer redeploy Vercel de TODOS os tenants ativos. Continuar?')) return;
    setSyncingAll(true);
    try {
      const res = await clientInstancesService.syncAllFrontends();
      const results = res.data.data;
      const ok   = results.filter(r => r.success).map(r => r.name).join(', ');
      const fail = results.filter(r => !r.success).map(r => `${r.name}: ${r.error}`).join('\n');
      let msg = res.data.message;
      if (ok)   msg += `\nOK: ${ok}`;
      if (fail) msg += `\nFalhou:\n${fail}`;
      alert(msg);
    } catch (e: any) {
      alert(e?.response?.data?.error ?? 'Erro ao sincronizar todos');
    } finally {
      setSyncingAll(false);
    }
  };

  if (user?.email !== 'comercial@lealmidia.com.br') {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Acesso restrito.
      </div>
    );
  }

  const active       = instances.filter(i => i.status === 'active').length;
  const provisioning = instances.filter(i => i.status !== 'active' && i.status !== 'error').length;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="border-b bg-card px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Building2 className="h-6 w-6 text-primary" />
              Clientes CRM
            </h1>
            <p className="text-sm text-muted-foreground">Gerencie as instancias LM Flow de cada cliente</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncAll}
              disabled={syncingAll}
              title="Redeploy Vercel de todos os tenants (atualiza todos com o codigo da raiz)"
            >
              {syncingAll
                ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                : <UploadCloud className="h-4 w-4 mr-2" />
              }
              {syncingAll ? 'Sincronizando...' : 'Sync Todos'}
            </Button>
            <Button size="sm" onClick={() => setModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Cliente
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3">
            <p className="text-xs text-emerald-700 dark:text-emerald-400">Ativos</p>
            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{active}</p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
            <p className="text-xs text-blue-700 dark:text-blue-400">Criando</p>
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{provisioning}</p>
          </div>
          <div className="bg-muted rounded-lg p-3">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">{instances.length}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b -mb-[17px]">
          <button
            onClick={() => setTab('list')}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === 'list'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <List className="h-3.5 w-3.5" />
            Lista
          </button>
          <button
            onClick={() => setTab('dashboard')}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === 'dashboard'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Dashboard
          </button>
          <button
            onClick={() => setTab('logs')}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === 'logs'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <ScrollText className="h-3.5 w-3.5" />
            Logs
          </button>
          <button
            onClick={() => setTab('metrics')}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === 'metrics'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Gauge className="h-3.5 w-3.5" />
            Métricas de Uso
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {tab === 'list' ? (
          <>
            {/* Archived toggle */}
            <div className="flex justify-end mb-3">
              <button
                onClick={() => setShowArchived(v => !v)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {showArchived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                {showArchived ? 'Ver ativos' : 'Ver arquivados'}
              </button>
            </div>

            {loadingList ? (
              <div className="flex items-center justify-center h-48 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Carregando...
              </div>
            ) : instances.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-3">
                <Building2 className="h-12 w-12 opacity-20" />
                <p className="font-medium">{showArchived ? 'Nenhum cliente arquivado' : 'Nenhum cliente ainda'}</p>
                {!showArchived && (
                  <Button size="sm" onClick={() => setModalOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Criar primeiro cliente
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {instances.map(i => (
                  showArchived ? (
                    <div key={i.id} className="bg-card border rounded-lg p-4 flex items-center justify-between opacity-70">
                      <div className="flex items-center gap-3">
                        <Archive className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-sm">{i.name}</p>
                          <p className="text-xs text-muted-foreground">{i.admin_email}</p>
                        </div>
                      </div>
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleUnarchive(i.id)}>
                        <ArchiveRestore className="h-3 w-3" />
                        Restaurar
                      </Button>
                    </div>
                  ) : (
                    <InstanceCard
                      key={i.id}
                      instance={i}
                      onDelete={() => handleDelete(i.id)}
                      onArchive={() => handleArchive(i.id)}
                      onRefresh={loadList}
                    />
                  )
                ))}
              </div>
            )}
          </>
        ) : tab === 'dashboard' ? (
          <DashboardView
            data={dashData}
            loading={loadingDash}
            onArchive={handleArchive}
          />
        ) : tab === 'logs' ? (
          <div className="h-full"><LogsView /></div>
        ) : (
          <div className="h-full"><UserMetricsView /></div>
        )}
      </div>

      <NewClientModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreate={loadList}
      />
    </div>
  );
}
