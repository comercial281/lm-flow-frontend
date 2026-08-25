import { useMemo } from 'react';
import { Bell, Mail, MessageCircle, RotateCcw, Smartphone } from 'lucide-react';
import { Badge, Checkbox, Input, Switch } from '@/components/ui/ds';
import type {
  CatalogEvent,
  LabelledKey,
  NotificationChannel,
  PipelineStages,
  PolicyEntry,
  PolicyUser,
  ResolvedPolicy,
} from '@/services/notifications/notificationPolicyService';

/**
 * Só o que a LISTA precisa. Não é `CatalogData`: aquele carrega também a lista de
 * clientes, que só existe na Área do Admin — exigi-la aqui obrigaria a tela do
 * cliente a inventar um campo vazio para satisfazer o tipo.
 */
export interface MatrixCatalog {
  groups: LabelledKey[];
  channels: LabelledKey[];
  origin_groups: LabelledKey[];
  events: CatalogEvent[];
}

/**
 * A LISTA DE AVISOS — um componente só, usado nas DUAS telas.
 *
 * Área do Admin (Central de Push → aba Notificações) e app do cliente
 * (Configurações → Conta → Central de Notificações) mostram exatamente a mesma
 * lista, porque são a mesma lista: as duas leem e gravam a mesma configuração no
 * servidor.
 *
 * Isto é componente compartilhado DE PROPÓSITO. Antes eram duas telas escritas
 * separado, com nomes diferentes para os mesmos avisos, e elas divergiram: o
 * cliente desligava numa e continuava recebendo pela outra. Duplicar este JSX
 * "só pra ajustar um detalhe" é como aquilo volta.
 *
 * A matriz é aviso × canal. Quando o aviso não sabe usar um canal aparece um
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

interface Props {
  catalog: MatrixCatalog;
  policy: ResolvedPolicy;
  stages?: PipelineStages[];
  users?: PolicyUser[];
  expanded: string | null;
  onExpand: (event: string | null) => void;
  onToggleChannel: (event: string, channel: NotificationChannel, value: boolean) => void;
  onSetParam: (event: string, key: string, value: unknown) => void;
  /** Só o painel raiz oferece "voltar ao padrão" — o cliente não pensa em "padrão de fábrica". */
  onReset?: (event: string) => void;
  /** Sem permissão de mexer, os controles ficam inertes em vez de sumirem: quem não
   *  pode editar ainda precisa ver o que a empresa recebe. */
  readOnly?: boolean;
}

export default function NotificationMatrix({
  catalog,
  policy,
  stages = [],
  users = [],
  expanded,
  onExpand,
  onToggleChannel,
  onSetParam,
  onReset,
  readOnly = false,
}: Props) {
  const grouped = useMemo(
    () =>
      catalog.groups
        .map(group => ({ ...group, events: catalog.events.filter(e => e.group === group.key) }))
        .filter(g => g.events.length > 0),
    [catalog],
  );

  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="hidden md:grid grid-cols-[1fr_repeat(4,72px)] gap-2 px-4 py-2 bg-muted/40 text-xs font-medium text-muted-foreground">
        <span>Aviso</span>
        {CHANNEL_ORDER.map(channel => (
          <span key={channel} className="text-center">
            {catalog.channels.find(c => c.key === channel)?.label ?? channel}
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
                      {entry.overridden && onReset && (
                        <>
                          <Badge variant="outline" className="text-[10px]">
                            personalizado
                          </Badge>
                          {!readOnly && (
                            <button
                              onClick={() => onReset(event.key)}
                              className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                            >
                              <RotateCcw className="w-3 h-3" />
                              voltar ao padrão
                            </button>
                          )}
                        </>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
                    {event.params.length > 0 && (
                      <button
                        onClick={() => onExpand(expanded === event.key ? null : event.key)}
                        className="text-[11px] text-primary hover:underline mt-1"
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
                            disabled={readOnly}
                            onCheckedChange={v => onToggleChannel(event.key, channel, v)}
                            aria-label={`${event.label} — ${channel}`}
                          />
                        ) : (
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
                    catalog={catalog}
                    stages={stages}
                    users={users}
                    readOnly={readOnly}
                    onChange={(key, value) => onSetParam(event.key, key, value)}
                  />
                )}
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}

function ParamsEditor({
  event,
  entry,
  catalog,
  stages,
  users,
  readOnly,
  onChange,
}: {
  event: CatalogEvent;
  entry: PolicyEntry;
  catalog: MatrixCatalog;
  stages: PipelineStages[];
  users: PolicyUser[];
  readOnly: boolean;
  onChange: (key: string, value: unknown) => void;
}) {
  const toggleInList = (current: unknown, item: string, checked: boolean) => {
    const list = Array.isArray(current) ? [...(current as string[])] : [];
    return checked ? [...list, item] : list.filter(k => k !== item);
  };

  return (
    <div className="px-4 pb-4 pt-1 bg-muted/10 space-y-4">
      {event.params.map(param => {
        const current = entry.params[param.key]?.value;

        return (
          <div key={param.key} className="space-y-1.5">
            <p className="text-xs font-medium">{param.label}</p>
            {param.hint && <p className="text-[11px] text-muted-foreground">{param.hint}</p>}

            {param.type === 'boolean' && (
              <Switch
                checked={Boolean(current)}
                disabled={readOnly}
                onCheckedChange={v => onChange(param.key, v)}
              />
            )}

            {param.type === 'string' && (
              <Input
                defaultValue={(current as string) ?? ''}
                placeholder="…@g.us"
                disabled={readOnly}
                onBlur={e => onChange(param.key, e.target.value)}
                className="max-w-md"
              />
            )}

            {param.type === 'integer' && (
              <Input
                type="number"
                defaultValue={(current as number) ?? 0}
                disabled={readOnly}
                onBlur={e => onChange(param.key, Number(e.target.value))}
                className="max-w-[120px]"
              />
            )}

            {param.type === 'origin_groups' && (
              <div className="flex flex-wrap gap-3">
                {catalog.origin_groups.map(origin => (
                  <label key={origin.key} className="flex items-center gap-2 text-xs cursor-pointer">
                    <Checkbox
                      checked={Array.isArray(current) && current.includes(origin.key)}
                      disabled={readOnly}
                      onCheckedChange={checked =>
                        onChange(param.key, toggleInList(current, origin.key, Boolean(checked)))
                      }
                    />
                    {origin.label}
                  </label>
                ))}
              </div>
            )}

            {param.type === 'user_ids' && (
              <div>
                {users.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">
                    Não consegui listar as pessoas deste cliente.
                  </p>
                ) : (
                  <div className="max-h-36 overflow-y-auto rounded-md border border-input bg-background divide-y divide-input max-w-md">
                    {users.map(u => (
                      <label
                        key={u.id}
                        className="flex items-center gap-2 px-3 py-2 text-xs cursor-pointer hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={Array.isArray(current) && current.includes(u.id)}
                          disabled={readOnly}
                          onCheckedChange={checked =>
                            onChange(param.key, toggleInList(current, u.id, Boolean(checked)))
                          }
                        />
                        {u.name}
                      </label>
                    ))}
                  </div>
                )}
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
                      {pipeline.stages.map(stage => (
                        <label
                          key={stage.id}
                          className="flex items-center gap-2 text-xs cursor-pointer"
                        >
                          <Checkbox
                            checked={Array.isArray(current) && current.includes(stage.id)}
                            disabled={readOnly}
                            onCheckedChange={checked =>
                              onChange(param.key, toggleInList(current, stage.id, Boolean(checked)))
                            }
                          />
                          {stage.name}
                        </label>
                      ))}
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
