import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
} from '@/components/ui/ds';
import NotificationMatrix from '@/components/notifications/NotificationMatrix';
import notificationPolicyService, {
  type CatalogData,
  type NotificationChannel,
  type PipelineStages,
  type PolicyPatch,
  type PolicyUser,
  type ResolvedPolicy,
} from '@/services/notifications/notificationPolicyService';

/**
 * Aba "Notificações" da Central de Push.
 *
 * A Central responde "que push EU, super-admin, quero receber". Esta aba responde
 * outra coisa: "o que CADA CLIENTE recebe". Por isso convivem na mesma tela mas
 * não se misturam.
 *
 * A lista em si é o NotificationMatrix, o MESMO componente que o cliente vê em
 * Configurações → Conta. As duas telas gravam a mesma configuração no servidor:
 * o que o super-admin muda aqui aparece lá, e vice-versa. Elas serem o mesmo
 * componente é o que impede de voltarem a divergir.
 */

export default function NotificationsTab() {
  const [catalog, setCatalog] = useState<CatalogData | null>(null);
  const [tenantId, setTenantId] = useState<string>('');
  const [policy, setPolicy] = useState<ResolvedPolicy>({});
  const [stages, setStages] = useState<PipelineStages[]>([]);
  const [users, setUsers] = useState<PolicyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);

  useEffect(() => {
    notificationPolicyService
      .catalog()
      .then(data => {
        setCatalog(data);
        if (data.tenants.length) setTenantId(data.tenants[0].id);
      })
      .catch(() => toast.error('Não consegui carregar o catálogo de notificações'))
      .finally(() => setLoading(false));
  }, []);

  const loadPolicy = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    try {
      const { policy: resolved } = await notificationPolicyService.show(id);
      setPolicy(resolved);
      // Etapas e pessoas só alimentam os ajustes de alguns avisos; falha aqui não
      // pode derrubar a tela inteira.
      notificationPolicyService
        .tenantContext(id)
        .then(ctx => {
          setStages(ctx.pipelines);
          setUsers(ctx.users);
        })
        .catch(() => {
          setStages([]);
          setUsers([]);
        });
    } catch {
      toast.error('Não consegui carregar a configuração deste cliente');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tenantId) loadPolicy(tenantId);
  }, [tenantId, loadPolicy]);

  const save = async (patch: PolicyPatch) => {
    setSaving(true);
    try {
      const { policy: updated } = await notificationPolicyService.update(tenantId, patch);
      setPolicy(updated);
    } catch {
      toast.error('Não consegui salvar');
      loadPolicy(tenantId);
    } finally {
      setSaving(false);
    }
  };

  const toggleChannel = (event: string, channel: NotificationChannel, value: boolean) =>
    save({ [event]: { channels: { [channel]: value } } });

  const setParam = (event: string, key: string, value: unknown) =>
    save({ [event]: { params: { [key]: value } } });

  const resetEvent = async (event: string) => {
    setSaving(true);
    try {
      const { policy: updated } = await notificationPolicyService.resetEvent(tenantId, event);
      setPolicy(updated);
      toast.success('Voltou ao padrão');
    } catch {
      toast.error('Não consegui restaurar o padrão');
    } finally {
      setSaving(false);
    }
  };

  const applyToAll = async () => {
    setConfirmAll(false);
    setSaving(true);
    try {
      const { applied, failed } = await notificationPolicyService.applyToAll(tenantId);
      toast.success(
        `Aplicado em ${applied.length} cliente(s)` +
          (failed.length ? ` — ${failed.length} falharam` : ''),
      );
    } catch {
      toast.error('Não consegui aplicar a todos');
    } finally {
      setSaving(false);
    }
  };

  const activeCount = useMemo(() => {
    let on = 0;
    let total = 0;
    Object.values(policy).forEach(entry => {
      const values = Object.values(entry.channels);
      total += 1;
      if (values.some(c => c.value)) on += 1;
    });
    return { on, total };
  }, [policy]);

  const tenant = catalog?.tenants.find(t => t.id === tenantId);

  if (loading && !catalog) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-4">
      {/* ── Cliente + resumo ── */}
      <div className="flex flex-wrap items-end gap-3 justify-between">
        <div className="min-w-[240px]">
          <Label htmlFor="np-tenant">Cliente</Label>
          <select
            id="np-tenant"
            value={tenantId}
            onChange={e => setTenantId(e.target.value)}
            className="mt-1 w-full h-9 rounded-md border bg-background px-3 text-sm"
          >
            {catalog?.tenants.map(t => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {activeCount.on} de {activeCount.total} avisos ativos
          </span>
          <Button variant="outline" size="sm" onClick={() => setConfirmAll(true)} disabled={!tenantId}>
            <Users className="w-4 h-4 mr-2" />
            Aplicar a todos os clientes
          </Button>
          {saving && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Isto controla o que a equipe <strong>do cliente</strong> recebe. O push que chega para você
        continua na aba "Regras".
      </p>

      {catalog && (
        <NotificationMatrix
          catalog={catalog}
          policy={policy}
          stages={stages}
          users={users}
          expanded={expanded}
          onExpand={setExpanded}
          onToggleChannel={toggleChannel}
          onSetParam={setParam}
          onReset={resetEvent}
        />
      )}

      <Dialog open={confirmAll} onOpenChange={setConfirmAll}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aplicar a todos os clientes?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            A configuração de <strong>{tenant?.name}</strong> vai substituir a de todos os outros
            clientes ativos. O que cada um tiver personalizado será perdido.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAll(false)}>
              Cancelar
            </Button>
            <Button onClick={applyToAll}>
              <Check className="w-4 h-4 mr-2" />
              Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
