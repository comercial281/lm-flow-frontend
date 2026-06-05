import { useState, useEffect, useCallback } from 'react';
import { Plus, RefreshCw, Building2, CheckCircle, AlertCircle, Loader2, Copy, ExternalLink, Trash2, ChevronDown, ChevronUp, Users, ToggleLeft } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Input, Label } from '@evoapi/design-system';
import clientInstancesService, { ClientInstance, CreateClientInstancePayload } from '@/services/clientInstances/clientInstancesService';
import { useAuth } from '@/contexts/AuthContext';
import MembersModal from './MembersModal';
import FeaturesModal from './FeaturesModal';

const STATUS_LABEL: Record<string, string> = {
  pending:               'Aguardando',
  provisioning_railway:  'Criando servidor...',
  active:                'Ativo',
  error:                 'Erro',
};

const STATUS_COLOR: Record<string, string> = {
  pending:               'bg-amber-100 text-amber-700',
  provisioning_railway:  'bg-blue-100 text-blue-700',
  active:                'bg-emerald-100 text-emerald-700',
  error:                 'bg-red-100 text-red-700',
};

function StatusIcon({ status }: { status: string }) {
  if (status === 'active') return <CheckCircle className="h-4 w-4 text-emerald-600" />;
  if (status === 'error')  return <AlertCircle className="h-4 w-4 text-red-600" />;
  return <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />;
}

function InstanceCard({ instance, onDelete, onRefresh }: {
  instance: ClientInstance;
  onDelete: () => void;
  onRefresh?: () => void;
}) {
  const [expanded, setExpanded]         = useState(false);
  const [copied, setCopied]             = useState(false);
  const [membersOpen, setMembersOpen]   = useState(false);
  const [featuresOpen, setFeaturesOpen] = useState(false);

  const copyLink = () => {
    if (!instance.frontend_link) return;
    navigator.clipboard.writeText(instance.frontend_link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
              Funções
            </Button>
          )}
          {instance.status === 'active' && instance.frontend_link && (
            <>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={copyLink}>
                <Copy className="h-3 w-3" />
                {copied ? 'Copiado!' : 'Link'}
              </Button>
              <a href={instance.frontend_link} target="_blank" rel="noreferrer">
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                  <ExternalLink className="h-3 w-3" />
                  Abrir
                </Button>
              </a>
            </>
          )}
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
              <p className="text-xs font-medium text-muted-foreground mb-1">Log de criação</p>
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
            Criado em {new Date(instance.created_at).toLocaleDateString('pt-BR')}
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
      setError(
        d?.errors?.join(', ') ??
        d?.error ??
        d?.message ??
        'Erro ao criar instância'
      );
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
            <Label>Nome da imobiliária *</Label>
            <Input
              placeholder="Ex: Imobiliária Casa Grande"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Nome do responsável</Label>
            <Input
              placeholder="Ex: João Silva"
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
              Este será o login do cliente no CRM dele.
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
  const [instances, setInstances] = useState<ClientInstance[]>([]);
  const [loading, setLoading]     = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await clientInstancesService.list();
      setInstances(res.data.data);
    } catch {
      setInstances([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh while any instance is still provisioning
  useEffect(() => {
    const provisioning = instances.some(i => i.status !== 'active' && i.status !== 'error');
    if (!provisioning) return;
    const t = setTimeout(load, 10_000);
    return () => clearTimeout(t);
  }, [instances, load]);

  const handleDelete = async (id: number) => {
    if (!confirm('Remover esta instância? Isso não apaga o Railway/Vercel, só o registro.')) return;
    await clientInstancesService.delete(id);
    load();
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
            <p className="text-sm text-muted-foreground">Gerencie as instâncias LM Flow de cada cliente</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
            <Button size="sm" onClick={() => setModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Cliente
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
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
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Carregando...
          </div>
        ) : instances.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-3">
            <Building2 className="h-12 w-12 opacity-20" />
            <p className="font-medium">Nenhum cliente ainda</p>
            <Button size="sm" onClick={() => setModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar primeiro cliente
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {instances.map(i => (
              <InstanceCard
                key={i.id}
                instance={i}
                onDelete={() => handleDelete(i.id)}
                onRefresh={load}
              />
            ))}
          </div>
        )}
      </div>

      <NewClientModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreate={load}
      />
    </div>
  );
}
