import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Check, Loader2, MessageCircle, ShieldCheck, User as UserIcon } from 'lucide-react';
import {
  Button, Input, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  DialogDescription, Label as UILabel,
} from '@/components/ui/ds';
import { usersService } from '@/services/users';
import InboxMembersService from '@/services/channels/inboxMembersService';
import type { CustomRole } from '@/types/customRoles';
import type { TeamAccessInbox } from '@/types/teamAccess';
import { buildCargoOptions, cargoPayload } from './cargoOptions';

/* Cadastrar alguém era o buraco do produto: criar a pessoa numa tela, definir o
   cargo noutra, liberar as instâncias numa terceira e mandar a senha numa quarta
   — e o cargo escolhido no cadastro era descartado pelo caminho. Este passo-a-
   passo faz as quatro coisas em ordem, numa janela só.

   As três etapas são deliberadamente as três perguntas do produto: quem é a
   pessoa, o que ela pode fazer, por onde ela atende. */

const STEPS = [
  { key: 'quem', label: 'Quem é', icon: UserIcon },
  { key: 'cargo', label: 'Cargo', icon: ShieldCheck },
  { key: 'instancias', label: 'Instâncias', icon: MessageCircle },
] as const;

interface AddPersonWizardProps {
  open: boolean;
  roles: CustomRole[];
  inboxes: TeamAccessInbox[];
  onClose: () => void;
  /** chamado depois que a pessoa está criada e configurada, para recarregar a lista */
  onCreated: () => void;
}

export default function AddPersonWizard({ open, roles, inboxes, onClose, onCreated }: AddPersonWizardProps) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [password, setPassword] = useState('');
  const [cargoKey, setCargoKey] = useState<string | null>(null);
  const [inboxIds, setInboxIds] = useState<Set<string>>(new Set());

  // Os três de fábrica sempre aparecem, mesmo no cliente que não tem cargo
  // nenhum gravado no banco (ver cargoOptions) — senão este passo fica vazio e
  // não dá para cadastrar ninguém.
  const cargoOptions = useMemo(() => buildCargoOptions(roles), [roles]);
  const selectedCargo = useMemo(
    () => cargoOptions.find(o => o.key === cargoKey) ?? null,
    [cargoOptions, cargoKey],
  );
  // Administrador alcança toda instância sozinho — pedir para escolher instância
  // seria oferecer uma decisão que não tem efeito.
  const roleSeesAll = selectedCargo?.seesAllInboxes ?? false;

  const reset = () => {
    setStep(0); setName(''); setEmail(''); setWhatsapp(''); setPassword('');
    setCargoKey(null); setInboxIds(new Set());
  };

  const close = () => { reset(); onClose(); };

  const canAdvance = () => {
    if (step === 0) return name.trim().length > 1 && /\S+@\S+\.\S+/.test(email.trim());
    if (step === 1) return selectedCargo !== null;
    return true;
  };

  const toggleInbox = (id: string) => {
    setInboxIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  /* Cria a pessoa e já deixa tudo no lugar. A ordem importa: a pessoa precisa
     existir antes de virar membro de uma instância, e o envio do acesso é o
     último passo porque é o único que fala com o mundo de fora. */
  const finish = async (sendAccess: boolean) => {
    setSaving(true);
    try {
      const created: any = await usersService.createUser({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        whatsapp_number: whatsapp.replace(/\D/g, ''),
        ...(password.trim().length >= 6 ? { password: password.trim() } : {}),
        ...(selectedCargo ? cargoPayload(selectedCargo) : {}),
      } as any);

      const userId = String(created?.id ?? '');

      if (userId && !roleSeesAll && inboxIds.size > 0) {
        // Uma chamada por instância porque é assim que a API de membros funciona
        // (a lista é por instância, não por pessoa). Falha em uma não pode perder
        // a pessoa que acabou de ser criada — por isso o aviso é parcial.
        const falhas: string[] = [];
        for (const inboxId of inboxIds) {
          try {
            const current = await InboxMembersService.get(inboxId);
            const ids = new Set(current.map(m => String(m.id)));
            ids.add(userId);
            await InboxMembersService.update(inboxId, Array.from(ids));
          } catch {
            falhas.push(inboxes.find(i => String(i.id) === inboxId)?.name ?? inboxId);
          }
        }
        if (falhas.length > 0) {
          toast.error(`Pessoa criada, mas não consegui liberar: ${falhas.join(', ')}. Ajuste em Gerenciar acesso.`);
        }
      }

      if (sendAccess && userId) {
        const phone = whatsapp.replace(/\D/g, '');
        if (phone.length < 10) {
          toast.warning('Pessoa criada. Para enviar o acesso, informe o WhatsApp com DDD em "Enviar acesso".');
        } else if (password.trim().length < 6) {
          toast.warning('Pessoa criada. Para enviar o acesso, defina uma senha de ao menos 6 caracteres.');
        } else {
          const res = await usersService.sendAccess(userId, { whatsapp_number: phone, password: password.trim() });
          if (res.whatsapp?.sent) {
            toast.success(`${name.trim()} criada e acesso enviado no WhatsApp.`);
          } else {
            toast.warning(`Pessoa criada, mas o WhatsApp não saiu: ${res.whatsapp?.error ?? res.whatsapp?.skipped ?? 'motivo desconhecido'}.`);
          }
        }
      } else {
        toast.success(`${name.trim()} adicionada à equipe.`);
      }

      onCreated();
      close();
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message ?? 'Não consegui criar a pessoa.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && close()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar pessoa</DialogTitle>
          <DialogDescription>
            Cadastro, cargo e instâncias — e, no fim, o acesso vai no WhatsApp dela.
          </DialogDescription>
        </DialogHeader>

        {/* Trilha dos passos */}
        <div className="flex items-center gap-2 py-1">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const done = i < step;
            const current = i === step;
            return (
              <div key={s.key} className="flex flex-1 items-center gap-2">
                <div
                  className={`flex h-7 w-7 flex-none items-center justify-center rounded-full text-xs ${
                    done ? 'bg-primary text-primary-foreground'
                      : current ? 'border-2 border-primary text-primary'
                        : 'border border-border text-muted-foreground'
                  }`}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                </div>
                <span className={`text-xs ${current ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>

        <div className="min-h-[240px] py-2">
          {step === 0 && (
            <div className="space-y-3">
              <div>
                <UILabel className="text-xs">Nome</UILabel>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Ana Souza" className="mt-1" />
              </div>
              <div>
                <UILabel className="text-xs">E-mail (é o login dela)</UILabel>
                <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="ana@imobiliaria.com.br" className="mt-1" />
              </div>
              <div>
                <UILabel className="text-xs">WhatsApp com DDD</UILabel>
                <Input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="Ex: 11 94087 1974" className="mt-1" />
                <p className="mt-1 text-xs text-muted-foreground">É para onde o acesso vai no último passo.</p>
              </div>
              <div>
                <UILabel className="text-xs">Senha (mínimo 6)</UILabel>
                <Input value={password} onChange={e => setPassword(e.target.value)} placeholder="deixe em branco para gerar automaticamente" className="mt-1" />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-2">
              {cargoOptions.map(option => {
                const selected = option.key === cargoKey;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setCargoKey(option.key)}
                    className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                      selected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <span className={`mt-0.5 h-4 w-4 flex-none rounded-full border-2 ${selected ? 'border-primary bg-primary' : 'border-muted-foreground/40'}`} />
                    <span>
                      <span className="block text-sm font-medium">{option.label}</span>
                      {option.description && <span className="block text-xs text-muted-foreground">{option.description}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-2">
              {roleSeesAll ? (
                <p className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                  Administrador vê <strong>todas as instâncias</strong> automaticamente — não há o que escolher aqui.
                </p>
              ) : inboxes.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhuma instância conectada ainda.</p>
              ) : (
                <>
                  {inboxes.map(ib => (
                    <label key={ib.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-2.5 hover:bg-muted/30">
                      <input
                        type="checkbox"
                        checked={inboxIds.has(String(ib.id))}
                        onChange={() => toggleInbox(String(ib.id))}
                        className="h-4 w-4 rounded"
                      />
                      <span className="flex-1 text-sm">{ib.name}</span>
                      <span className="text-xs text-muted-foreground">{ib.channel_type?.split('::')[1] ?? ''}</span>
                    </label>
                  ))}
                  <p className="pt-1 text-xs text-muted-foreground">
                    Marcado = atende essa instância e entra na fila para receber leads novos dela. Dá para
                    mudar depois em Gerenciar acesso.
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button variant="ghost" onClick={() => (step === 0 ? close() : setStep(step - 1))} disabled={saving}>
            {step === 0 ? 'Cancelar' : 'Voltar'}
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canAdvance() || saving}>Continuar</Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => finish(false)} disabled={saving}>
                Só cadastrar
              </Button>
              <Button onClick={() => finish(true)} disabled={saving} className="gap-1.5">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                Cadastrar e enviar acesso
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
