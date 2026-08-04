import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, Check, Loader2, Mail, MessageCircle, RotateCcw, Smartphone, Users } from 'lucide-react';
import { toast } from 'sonner';
import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Switch,
} from '@/components/ui/ds';
import notificationPolicyService, {
  type CatalogData,
  type CatalogEvent,
  type NotificationChannel,
  type PipelineStages,
  type PolicyPatch,
  type ResolvedPolicy,
} from '@/services/notifications/notificationPolicyService';

/**
 * Aba "Notificações" da Central de Push.
 *
 * A Central responde "que push EU, super-admin, quero receber". Esta aba responde
 * outra coisa: "o que CADA CLIENTE recebe". Por isso convivem na mesma tela mas
 * não se misturam.
 *
 * A matriz é evento × canal. Quando o evento não suporta um canal aparece um
 * travessão, e não um switch desligado — switch cinza sugere "eu poderia ligar
 * isso", e não poderia.
 */

const CHANNEL_ICON: Record<NotificationChannel, typeof Bell> = {
  bell: Bell,
  push: Smartphone,
  email: Mail,
  whatsapp: MessageCircle,
};

const CHANNEL_ORDER: NotificationChannel[] = ['bell', 'push', 'email', 'whatsapp'];

export default function NotificationsTab() {
  const [catalog, setCatalog] = useState<CatalogData | null>(null);
  const [tenantId, setTenantId] = useState<string>('');
  const [policy, setPolicy] = useState<ResolvedPolicy>({});
  const [stages, setStages] = useState<PipelineStages[]>([]);
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
      // Etapas só interessam ao filtro de funil.mudou_etapa; falha aqui não pode
      // derrubar a tela inteira.
      notificationPolicyService.stages(id).then(setStages).catch(() => setStages([]));
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

  const grouped = useMemo(() => {
    if (!catalog) return [];
    return catalog.groups
      .map(group => ({
        ...group,
        events: catalog.events.filter(e => e.group === group.key),
      }))
      .filter(g => g.events.length > 0);
  }, [catalog]);

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

      {/* ── Cabeçalho de canais ── */}
      <div className="rounded-lg border overflow-hidden">
        <div className="hidden md:grid grid-cols-[1fr_repeat(4,72px)] gap-2 px-4 py-2 bg-muted/40 text-xs font-medium text-muted-foreground">
          <span>Aviso</span>
          {CHANNEL_ORDER.map(channel => (
            <span key={channel} className="text-center">
              {catalog?.channels.find(c => c.key === channel)?.label ?? channel}
            </span>
          ))}
        </div>

        {grouped.map(group => (
          <section key={group.key}>
            <div className="px-4 py-2 bg-muted/20 border-t text-sm font-medium">{group.label}</div>

            {group.events.map(event => {
              const entry = policy[event.key];
              if (!entry) return null;

              return (
                <div key={event.key} className="border-t">
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_repeat(4,72px)] gap-2 px-4 py-3 items-center">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{event.label}</span>
                        {entry.overridden && (
                          <Badge variant="outline" className="text-[10px]">
                            personalizado
                          </Badge>
                        )}
                        {entry.overridden && (
                          <button
                            onClick={() => resetEvent(event.key)}
                            className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                          >
                            <RotateCcw className="w-3 h-3" />
                            voltar ao padrão
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
                      {event.params.length > 0 && (
                        <button
                          onClick={() => setExpanded(expanded === event.key ? null : event.key)}
                          className="text-[11px] text-violet-300 hover:text-violet-200 mt-1"
                        >
                          {expanded === event.key ? 'ocultar ajustes' : 'ajustes deste aviso'}
                        </button>
                      )}
                    </div>

                    {CHANNEL_ORDER.map(channel => {
                      const supported = event.channels.includes(channel);
                      const Icon = CHANNEL_ICON[channel];

                      return (
                        <div key={channel} className="flex md:justify-center items-center gap-2">
                          <Icon className="w-3.5 h-3.5 text-muted-foreground md:hidden" />
                          {supported ? (
                            <Switch
                              checked={entry.channels[channel]?.value ?? false}
                              onCheckedChange={v => toggleChannel(event.key, channel, v)}
                              aria-label={`${event.label} — ${channel}`}
                            />
                          ) : (
                            // Travessão e não switch desabilitado: cinza sugere
                            // "eu poderia ligar isso", e não poderia.
                            <span className="text-muted-foreground/40 text-sm">—</span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {expanded === event.key && (
                    <ParamsEditor
                      event={event}
                      entry={entry}
                      catalog={catalog!}
                      stages={stages}
                      onChange={(key, value) => setParam(event.key, key, value)}
                    />
                  )}
                </div>
              );
            })}
          </section>
        ))}
      </div>

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

function ParamsEditor({
  event,
  entry,
  catalog,
  stages,
  onChange,
}: {
  event: CatalogEvent;
  entry: { params: Record<string, { value: unknown }> };
  catalog: CatalogData;
  stages: PipelineStages[];
  onChange: (key: string, value: unknown) => void;
}) {
  return (
    <div className="px-4 pb-4 pt-1 bg-muted/10 space-y-4">
      {event.params.map(param => {
        const current = entry.params[param.key]?.value;

        return (
          <div key={param.key} className="space-y-1.5">
            <Label className="text-xs">{param.label}</Label>
            {param.hint && <p className="text-[11px] text-muted-foreground">{param.hint}</p>}

            {param.type === 'boolean' && (
              <Switch checked={Boolean(current)} onCheckedChange={v => onChange(param.key, v)} />
            )}

            {param.type === 'string' && (
              <Input
                defaultValue={(current as string) ?? ''}
                placeholder="…@g.us"
                onBlur={e => onChange(param.key, e.target.value)}
                className="max-w-md"
              />
            )}

            {param.type === 'integer' && (
              <Input
                type="number"
                defaultValue={(current as number) ?? 0}
                onBlur={e => onChange(param.key, Number(e.target.value))}
                className="max-w-[120px]"
              />
            )}

            {param.type === 'origin_groups' && (
              <div className="flex flex-wrap gap-3">
                {catalog.origin_groups.map(origin => {
                  const selected = Array.isArray(current) && current.includes(origin.key);
                  return (
                    <label key={origin.key} className="flex items-center gap-2 text-xs cursor-pointer">
                      <Checkbox
                        checked={selected}
                        onCheckedChange={checked => {
                          const list = Array.isArray(current) ? [...(current as string[])] : [];
                          onChange(
                            param.key,
                            checked ? [...list, origin.key] : list.filter(k => k !== origin.key),
                          );
                        }}
                      />
                      {origin.label}
                    </label>
                  );
                })}
              </div>
            )}

            {param.type === 'stage_ids' && (
              <div className="space-y-2">
                {stages.length === 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    Não consegui listar as etapas deste cliente.
                  </p>
                )}
                {stages.map(pipeline => (
                  <div key={pipeline.id}>
                    <p className="text-[11px] font-medium text-muted-foreground">{pipeline.name}</p>
                    <div className="flex flex-wrap gap-3 mt-1">
                      {pipeline.stages.map(stage => {
                        const selected = Array.isArray(current) && current.includes(stage.id);
                        return (
                          <label key={stage.id} className="flex items-center gap-2 text-xs cursor-pointer">
                            <Checkbox
                              checked={selected}
                              onCheckedChange={checked => {
                                const list = Array.isArray(current) ? [...(current as string[])] : [];
                                onChange(
                                  param.key,
                                  checked ? [...list, stage.id] : list.filter(k => k !== stage.id),
                                );
                              }}
                            />
                            {stage.name}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
