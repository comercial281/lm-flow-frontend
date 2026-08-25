import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, BellOff, Loader2, Mail, MessageCircle, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import notificationPreferencesService, {
  type MutesData,
  type MutesMap,
} from '@/services/notifications/notificationPreferencesService';
import type { NotificationChannel } from '@/services/notifications/notificationPolicyService';

/**
 * "Silenciar avisos pra mim" — o Perfil, agora com efeito.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE ESTA TELA FOI REESCRITA
 * ─────────────────────────────────────────────────────────────────────────────
 * O que havia aqui era uma caixinha por tipo de aviso gravando um mapa de bits
 * que o produto parou de consultar quando a emissão passou pelo portão único. A
 * pessoa desmarcava tudo, salvava, e continuava recebendo igual. Tela que mente é
 * pior do que tela que não existe.
 *
 * Agora é a camada de CIMA da lista da empresa: aparece só o que a empresa
 * ligou, e a pessoa desliga o que não quer, canal a canal. Só TIRA — não há como
 * ligar aqui um aviso que a empresa desligou, senão o gestor perderia o controle
 * do que a equipe recebe. Aviso desligado pela empresa nem aparece: mostrá-lo com
 * uma chave do lado sugeriria que dava para ligar.
 */

const CHANNEL_ICON: Record<NotificationChannel, typeof Bell> = {
  bell: Bell,
  push: Smartphone,
  email: Mail,
  whatsapp: MessageCircle,
};

const CHANNEL_ORDER: NotificationChannel[] = ['bell', 'push', 'email', 'whatsapp'];

export default function PersonalMutes() {
  const [data, setData] = useState<MutesData | null>(null);
  const [mutes, setMutes] = useState<MutesMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await notificationPreferencesService.mutes();
      setData(payload);
      setMutes(payload.mutes ?? {});
    } catch {
      toast.error('Não consegui carregar seus avisos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Só os avisos que a empresa ligou, e de cada um só os canais ligados.
  const visible = useMemo(() => {
    if (!data) return [];

    return data.groups
      .map(group => ({
        ...group,
        events: data.events
          .filter(event => event.group === group.key)
          .map(event => ({
            event,
            channels: CHANNEL_ORDER.filter(
              channel => data.policy[event.key]?.channels[channel]?.value,
            ),
          }))
          .filter(row => row.channels.length > 0),
      }))
      .filter(group => group.events.length > 0);
  }, [data]);

  const isMuted = (eventKey: string, channel: NotificationChannel) =>
    (mutes[eventKey] ?? []).includes(channel);

  const toggle = async (eventKey: string, channel: NotificationChannel) => {
    const current = mutes[eventKey] ?? [];
    const next = current.includes(channel)
      ? current.filter(c => c !== channel)
      : [...current, channel];

    // Otimista: silenciar é reversível num clique, e esperar o servidor a cada
    // caixinha faria a tela parecer travada.
    setMutes(prev => ({ ...prev, [eventKey]: next }));
    setSaving(true);
    try {
      await notificationPreferencesService.updateMutes({ [eventKey]: next });
    } catch {
      setMutes(prev => ({ ...prev, [eventKey]: current }));
      toast.error('Não consegui salvar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando seus avisos…
      </div>
    );
  }

  if (!visible.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Sua empresa ainda não ligou nenhum aviso. Quando ligar, eles aparecem aqui para você poder
        silenciar o que não quiser.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Estes são os avisos que sua empresa ligou. Clique num canal para parar de recebê-lo{' '}
        <strong>só para você</strong> — o resto da equipe continua recebendo.
        {saving && <Loader2 className="inline h-3 w-3 animate-spin ml-2" />}
      </p>

      <div className="rounded-lg border overflow-hidden">
        {visible.map(group => (
          <section key={group.key}>
            <div className="px-4 py-2 bg-muted/20 border-t first:border-t-0 text-sm font-medium">
              {group.label}
            </div>

            {group.events.map(({ event, channels }) => (
              <div
                key={event.key}
                className="border-t px-4 py-3 flex flex-wrap items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{event.label}</p>
                  <p className="text-xs text-muted-foreground">{event.description}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {channels.map(channel => {
                    const Icon = CHANNEL_ICON[channel];
                    const muted = isMuted(event.key, channel);
                    const label = data?.channels.find(c => c.key === channel)?.label ?? channel;

                    return (
                      <button
                        key={channel}
                        type="button"
                        onClick={() => toggle(event.key, channel)}
                        aria-pressed={!muted}
                        title={muted ? `${label}: silenciado para você` : `${label}: você recebe`}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs cursor-pointer transition-colors ${
                          muted
                            ? 'border-dashed border-muted-foreground/40 text-muted-foreground/60 line-through'
                            : 'border-primary/40 bg-primary/10 text-foreground'
                        }`}
                      >
                        {muted ? <BellOff className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
