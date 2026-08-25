import { useCallback, useEffect, useMemo, useState } from 'react';
import { BellRing, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import NotificationMatrix from '@/components/notifications/NotificationMatrix';
import notificationPreferencesService, {
  type ClientCatalogData,
} from '@/services/notifications/notificationPreferencesService';
import type {
  NotificationChannel,
  PolicyPatch,
  ResolvedPolicy,
} from '@/services/notifications/notificationPolicyService';

/**
 * Central de Notificações — o que a EQUIPE desta imobiliária recebe.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * É A MESMA LISTA DA ÁREA DO ADMIN
 * ─────────────────────────────────────────────────────────────────────────────
 * Esta tela mostrava, até 2026-08-25, uma lista PRÓPRIA de cinco chaves que
 * criava regra de automação por baixo. A Área do Admin tinha outra lista, com
 * outros nomes, que não sabia desta. As duas mandavam nos mesmos avisos: um lead
 * novo chegava a tocar o celular duas vezes e desligar aqui não calava lá.
 *
 * Agora é uma lista só. O componente é o mesmo das duas telas
 * (NotificationMatrix) e a configuração gravada é a mesma — muda só o caminho
 * até ela. Se um dia alguém for tentado a "simplificar" isto de volta para uma
 * lista própria: era exatamente assim que as duas divergiam.
 *
 * Quem não é admin nem gerente VÊ a lista e não mexe. Esconder faria o corretor
 * achar que ninguém configurou nada; o silêncio pessoal dele fica no Perfil.
 */
export default function NotificationCenter() {
  const [data, setData] = useState<ClientCatalogData | null>(null);
  const [policy, setPolicy] = useState<ResolvedPolicy>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await notificationPreferencesService.policy();
      setData(payload);
      setPolicy(payload.policy);
    } catch {
      toast.error('Não consegui carregar a Central de Notificações');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (patch: PolicyPatch) => {
    setSaving(true);
    try {
      const { policy: updated } = await notificationPreferencesService.updatePolicy(patch);
      setPolicy(updated);
    } catch {
      // Recarrega em vez de manter o switch onde o clique deixou: mostrar
      // "ligado" para algo que não salvou é a tela mentindo.
      toast.error('Não consegui salvar');
      load();
    } finally {
      setSaving(false);
    }
  };

  const activeCount = useMemo(
    () => Object.values(policy).filter(entry => Object.values(entry.channels).some(c => c.value)).length,
    [policy],
  );

  return (
    <div className="mb-6 rounded-xl border border-primary/30 bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left cursor-pointer hover:bg-muted/30"
      >
        <div className="rounded-lg bg-primary/10 p-2 text-primary shrink-0">
          <BellRing className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Central de Notificações</p>
          <p className="text-xs text-muted-foreground">
            Escolha o que a equipe recebe e por onde — sininho, push no celular, e-mail ou WhatsApp.{' '}
            {loading ? 'Carregando…' : `${activeCount} aviso(s) ligado(s).`}
          </p>
        </div>
        {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-border pt-4 space-y-3">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </div>
          )}

          {!loading && data && (
            <>
              <p className="text-xs text-muted-foreground">
                Isto vale para a equipe toda. Cada pessoa ainda pode calar avisos só para ela em{' '}
                <strong>Perfil → Notificações</strong>.
                {!data.can_edit && ' Só admin e gerente podem mudar esta lista.'}
              </p>

              <NotificationMatrix
                catalog={data}
                policy={policy}
                stages={data.pipelines}
                users={data.users}
                expanded={expanded}
                onExpand={setExpanded}
                readOnly={!data.can_edit}
                onToggleChannel={(event: string, channel: NotificationChannel, value: boolean) =>
                  save({ [event]: { channels: { [channel]: value } } })
                }
                onSetParam={(event: string, key: string, value: unknown) =>
                  save({ [event]: { params: { [key]: value } } })
                }
              />

              <p className="text-[11px] text-muted-foreground">
                O push no celular só chega em quem estiver com o <strong>Modo Plantão</strong>{' '}
                ligado. O WhatsApp usa o número cadastrado de cada pessoa em Configurações →
                Usuários.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
