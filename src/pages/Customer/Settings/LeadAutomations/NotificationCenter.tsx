import { useEffect, useState, useCallback } from 'react';
import { BellRing, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/ds';
import { toast } from 'sonner';
import {
  leadAutomationService,
  type LeadAutomationRule,
  type LeadAutomationAction,
} from '@/services/leadAutomation/leadAutomationService';
import usersService from '@/services/users/usersService';
import type { User } from '@/types/users';

// Central de Notificações: cenários prontos de CRM em toggle. Cada toggle provisiona
// (por baixo) uma regra do motor LeadAutomation com a ação notify_push pros usuários
// escolhidos. Marcador no description (central:notif:<key>) identifica as regras da central.
const MARK = 'central:notif:';

interface Preset {
  key: string;
  label: string;
  hint: string;
  trigger: string;
  title: string;
  message: string;
}

const PRESETS: Preset[] = [
  {
    key: 'lead_novo',
    label: 'Lead novo chegou',
    hint: 'Push assim que um lead entra no CRM.',
    trigger: 'lead.created',
    title: 'Novo lead!',
    message: '{{nome_completo}} acabou de entrar — {{telefone}}',
  },
  {
    key: 'mudou_etapa',
    label: 'Lead mudou de etapa',
    hint: 'Push quando um lead muda de coluna no pipeline.',
    trigger: 'lead.stage_changed',
    title: 'Lead mudou de etapa',
    message: '{{nome_completo}} avançou no funil.',
  },
  {
    key: 'reuniao_agendada',
    label: 'Reunião agendada',
    hint: 'Push quando uma visita/reunião é marcada.',
    trigger: 'lead.visit_scheduled',
    title: 'Reunião agendada',
    message: 'Reunião marcada com {{nome_completo}}.',
  },
  {
    key: 'lembrete_reuniao',
    label: 'Lembrete de reunião (1h antes)',
    hint: 'Push 1 hora antes da reunião.',
    trigger: 'lead.visit_reminder_1h',
    title: 'Reunião em 1h',
    message: 'Você tem reunião com {{nome_completo}} em 1 hora.',
  },
  {
    key: 'lead_esfriando',
    label: 'Lead esfriando (7 dias sem contato)',
    hint: 'Push quando um lead fica 7 dias sem resposta.',
    trigger: 'lead.inactive_7d',
    title: 'Lead esfriando',
    message: '{{nome_completo}} está há 7 dias sem contato.',
  },
];

export default function NotificationCenter() {
  const [users, setUsers] = useState<User[]>([]);
  const [rules, setRules] = useState<LeadAutomationRule[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, r] = await Promise.all([usersService.getUsers(), leadAutomationService.getAll()]);
      const list =
        ((u as unknown as { data?: User[] }).data) ??
        ((u as unknown as { users?: User[] }).users) ??
        (Array.isArray(u) ? (u as unknown as User[]) : []);
      setUsers(list);
      setRules(r);

      const presetRules = r.filter(x => (x.description || '').startsWith(MARK));
      const ids = new Set<string>();
      presetRules.forEach(pr => {
        const a = pr.actions?.find(ac => ac.type === 'notify_push');
        const uids = (a?.params as unknown as { user_ids?: string[] })?.user_ids;
        if (Array.isArray(uids)) uids.forEach(id => ids.add(String(id)));
      });
      setSelectedUserIds(ids.size ? [...ids] : list.map(x => String(x.id)));
    } catch {
      toast.error('Erro ao carregar a Central de Notificações');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const ruleForKey = (key: string) => rules.find(r => (r.description || '') === MARK + key);
  const isOn = (key: string) => {
    const r = ruleForKey(key);
    return !!r && r.is_active;
  };

  const buildAction = (p: Preset): LeadAutomationAction => ({
    type: 'notify_push',
    params: { user_ids: selectedUserIds, title: p.title, message: p.message } as unknown as Record<string, string | number>,
  });

  const togglePreset = async (p: Preset) => {
    if (!selectedUserIds.length) {
      toast.error('Escolha pelo menos um usuário pra receber o push.');
      return;
    }
    setBusy(p.key);
    try {
      const existing = ruleForKey(p.key);
      if (existing) {
        if (existing.is_active) {
          await leadAutomationService.update(existing.id, { is_active: false });
        } else {
          await leadAutomationService.update(existing.id, { is_active: true, actions: [buildAction(p)] });
        }
      } else {
        await leadAutomationService.create({
          name: p.label,
          description: MARK + p.key,
          trigger: p.trigger,
          conditions: [],
          actions: [buildAction(p)],
          is_active: true,
          priority: 0,
        });
      }
      await load();
    } catch {
      toast.error('Não consegui atualizar. Tente de novo.');
    } finally {
      setBusy(null);
    }
  };

  const toggleUser = async (id: string) => {
    const next = selectedUserIds.includes(id)
      ? selectedUserIds.filter(x => x !== id)
      : [...selectedUserIds, id];
    setSelectedUserIds(next);

    // Atualiza os destinatários nas regras da central que já estão ativas.
    const activePresetRules = rules.filter(r => (r.description || '').startsWith(MARK) && r.is_active);
    if (activePresetRules.length && next.length) {
      try {
        await Promise.all(
          activePresetRules.map(r => {
            const a = r.actions?.find(ac => ac.type === 'notify_push');
            const params = { ...(a?.params || {}), user_ids: next } as unknown as Record<string, string | number>;
            return leadAutomationService.update(r.id, { actions: [{ type: 'notify_push', params }] });
          }),
        );
      } catch {
        toast.error('Destinatários salvos só localmente — recarregue se necessário.');
      }
    }
  };

  const activeCount = PRESETS.filter(p => isOn(p.key)).length;

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
            Ligue os avisos por push (Modo Plantão) sem montar regra a regra. {activeCount} ativo(s).
          </p>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-border pt-4 space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </div>
          ) : (
            <>
              {/* Destinatários */}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Quem recebe o push
                </p>
                <div className="max-h-36 overflow-y-auto rounded-md border border-input bg-background divide-y divide-input">
                  {users.length === 0 && (
                    <p className="text-xs text-muted-foreground p-2">Nenhum usuário cadastrado.</p>
                  )}
                  {users.map(u => (
                    <label
                      key={u.id}
                      className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-muted/50"
                    >
                      <input
                        type="checkbox"
                        checked={selectedUserIds.includes(String(u.id))}
                        onChange={() => toggleUser(String(u.id))}
                      />
                      <span>{u.name}</span>
                    </label>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Recebe quem estiver com o Modo Plantão ligado no app/celular.
                </p>
              </div>

              {/* Presets */}
              <div className="space-y-2">
                {PRESETS.map(p => {
                  const on = isOn(p.key);
                  const isBusy = busy === p.key;
                  return (
                    <div
                      key={p.key}
                      className="flex items-center gap-3 rounded-lg border border-border px-4 py-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{p.label}</p>
                        <p className="text-xs text-muted-foreground">{p.hint}</p>
                      </div>
                      <Button
                        size="sm"
                        variant={on ? 'default' : 'outline'}
                        disabled={isBusy}
                        onClick={() => togglePreset(p)}
                        className="cursor-pointer min-w-[88px]"
                      >
                        {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : on ? 'Ligado' : 'Desligado'}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
