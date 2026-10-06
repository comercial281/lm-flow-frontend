import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Label } from '@/components/ui/ds';
import EmptyState from '@/components/base/EmptyState';
import { Seletor } from '@/components/base/Seletor';
import NotificationMatrix from '@/components/notifications/NotificationMatrix';
import { useConfirmacao, type PedidoDeConfirmacao } from '@/hooks/useConfirmacao';
import { numero, plural } from '@/lib/formato';
import { PAGINA } from '@/pages/Admin/Area/estilo';
import notificationPolicyService, {
  type CatalogData,
  type NotificationChannel,
  type PipelineStages,
  type PolicyPatch,
  type PolicyUser,
  type ResolvedPolicy,
} from '@/services/notifications/notificationPolicyService';

/**
 * Comunicação → Avisos na tela: o que CADA CLIENTE recebe.
 *
 * O push que chega para a Leal Mídia mora em Push. Aqui é outra pergunta: o que
 * a equipe de cada cliente recebe dentro do CRM dela.
 *
 * A lista em si é o NotificationMatrix, o MESMO componente que o cliente vê em
 * Configurações → Conta (decisão de 25/08: uma lista só, nas duas telas). As
 * duas gravam a mesma configuração no servidor: o que o super-admin muda aqui
 * aparece lá, e vice-versa.
 *
 * Erro de leitura é erro na tela, com "Tentar de novo", nunca tela em branco.
 */

// "Aplicar a todos" troca a configuração de todos os OUTROS clientes ativos pela
// deste. O servidor aplica em Tenant.usable menos o de origem, que é a mesma
// lista que o catálogo traz: por isso o N é o tamanho da lista menos um.
function pedidoAplicarATodos(outros: number): PedidoDeConfirmacao {
  return {
    titulo: outros === 1 ? 'Aplicar este padrão ao outro cliente?' : `Aplicar este padrão aos ${numero(outros)} clientes?`,
    descricao: 'A configuração de cada um é substituída.',
    rotuloDaAcao: 'Aplicar',
    destrutivo: true,
  };
}

export default function NotificationsTab() {
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const [catalog, setCatalog] = useState<CatalogData | null>(null);
  const [erroCatalogo, setErroCatalogo] = useState(false);
  const [tenantId, setTenantId] = useState<string>('');
  const [policy, setPolicy] = useState<ResolvedPolicy | null>(null);
  const [erroPolicy, setErroPolicy] = useState(false);
  const [stages, setStages] = useState<PipelineStages[]>([]);
  const [users, setUsers] = useState<PolicyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const carregarCatalogo = useCallback(async () => {
    setLoading(true);
    setErroCatalogo(false);
    try {
      const data = await notificationPolicyService.catalog();
      setCatalog(data);
      setTenantId(atual => atual || data.tenants[0]?.id || '');
    } catch {
      setErroCatalogo(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregarCatalogo();
  }, [carregarCatalogo]);

  const loadPolicy = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    setErroPolicy(false);
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
      setPolicy(null);
      setErroPolicy(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tenantId) void loadPolicy(tenantId);
  }, [tenantId, loadPolicy]);

  const save = async (patch: PolicyPatch) => {
    setSaving(true);
    try {
      const { policy: updated } = await notificationPolicyService.update(tenantId, patch);
      setPolicy(updated);
    } catch {
      toast.error('Não consegui salvar');
      void loadPolicy(tenantId);
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

  const outros = Math.max((catalog?.tenants.length ?? 0) - 1, 0);

  const applyToAll = async () => {
    if (!tenantId || outros === 0) return;
    if (!(await confirmar(pedidoAplicarATodos(outros)))) return;
    setSaving(true);
    try {
      const { applied, failed } = await notificationPolicyService.applyToAll(tenantId);
      toast.success(
        `Aplicado em ${plural(applied.length, 'cliente', 'clientes')}` +
          (failed.length ? ` · ${plural(failed.length, 'falhou', 'falharam')}` : ''),
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
    Object.values(policy ?? {}).forEach(entry => {
      const values = Object.values(entry.channels);
      total += 1;
      if (values.some(c => c.value)) on += 1;
    });
    return { on, total };
  }, [policy]);

  if (loading && !catalog && !erroCatalogo) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (erroCatalogo || !catalog) {
    return <EmptyState tipo="erro" aoTentarDeNovo={() => void carregarCatalogo()} />;
  }

  if (catalog.tenants.length === 0) {
    return (
      <EmptyState
        title="Nenhum cliente ativo"
        description="Os avisos de cada cliente aparecem aqui quando houver cliente ativo."
      />
    );
  }

  return (
    <div className={`${PAGINA} max-w-5xl`}>
      {/* ── Cliente + resumo ── */}
      <div className="flex flex-wrap items-end gap-3 justify-between">
        <div className="min-w-[240px]">
          <Label htmlFor="np-tenant">Cliente</Label>
          <Seletor
            id="np-tenant"
            value={tenantId}
            onChange={e => setTenantId(e.target.value)}
            className="mt-1 w-full h-9 rounded-md border bg-background px-3 text-sm"
          >
            {catalog.tenants.map(t => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Seletor>
        </div>

        <div className="flex items-center gap-3">
          {policy && (
            <span className="text-sm text-muted-foreground">
              {activeCount.on} de {activeCount.total} avisos ativos
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void applyToAll()}
            disabled={!tenantId || outros === 0 || saving || !policy}
          >
            <Users className="w-4 h-4 mr-2" />
            Aplicar a todos os clientes
          </Button>
          {saving && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Isto controla o que a equipe <strong>do cliente</strong> recebe. O push que chega para você
        fica em Push.
      </p>

      {erroPolicy ? (
        <EmptyState tipo="erro" aoTentarDeNovo={() => void loadPolicy(tenantId)} />
      ) : (
        policy && (
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
        )
      )}

      {dialogoDeConfirmacao}
    </div>
  );
}
