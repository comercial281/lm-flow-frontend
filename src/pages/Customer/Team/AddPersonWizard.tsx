import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Check, CheckCircle2, Loader2, MessageCircle, ShieldCheck, TriangleAlert, User as UserIcon } from 'lucide-react';
import {
  Button, Input, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  DialogDescription, Label as UILabel,
} from '@/components/ui/ds';
import { usersService } from '@/services/users';
import InboxMembersService from '@/services/channels/inboxMembersService';
import { BrPhoneInput } from '@/components/shared/BrPhoneInput';
import { telefone } from '@/lib/formato';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useIsSuperAdmin } from '@/hooks/useIsSuperAdmin';
import { useAuthStore } from '@/store/authStore';
import { resolveActor } from '@/features/users/deactivation/deactivationRules';
import type { CreatedWhatsappNumber } from '@/types/users';
import type { CustomRole } from '@/types/customRoles';
import type { TeamAccessInbox, TeamAccessMember } from '@/types/teamAccess';
import { assignableCargoOptions, buildCargoOptions, cargoPayload } from './cargoOptions';
import { viewerIsAdmin } from './person/personSheetRules';
import CreateNumberDialog from './numbers/CreateNumberDialog';
import NumberCreatedSummary from './numbers/NumberCreatedSummary';
import { digitsOf, national, qrPath, sendAccessLink, toApiPhone, validPhone, type LinkOutcome } from './numbers/numberPhone';
import { numberState } from './people/peopleFilters';
import { DOT_CLASS, STATE_TEXT } from './people/NumberChip';

/* Cadastrar alguém era o buraco do produto: criar a pessoa numa tela, definir o
   cargo noutra, liberar as instâncias numa terceira e mandar a senha numa quarta
   — e o cargo escolhido no cadastro era descartado pelo caminho. Este passo-a-
   passo faz as quatro coisas em ordem, numa janela só.

   As três etapas são deliberadamente as três perguntas do produto: quem é a
   pessoa, o que ela pode fazer, por onde ela atende. */

/* O que ficou pronto e o que falta depois de cadastrar. `number` nulo = não criou
   número (não pediu ou falhou: `numberFailure`); `link` nulo = não pediu acesso. */
interface WizardResult {
  userId: string;
  cargo: string;
  number: CreatedWhatsappNumber | null;
  numberFailure: string;
  link: LinkOutcome | null;
  /** nomes dos números que não consegui liberar */
  liberateFailures: string[];
}

const STEPS = [
  { key: 'quem', label: 'Quem é', icon: UserIcon },
  { key: 'cargo', label: 'Cargo', icon: ShieldCheck },
  { key: 'instancias', label: 'Números', icon: MessageCircle },
] as const;

interface AddPersonWizardProps {
  open: boolean;
  roles: CustomRole[];
  inboxes: TeamAccessInbox[];
  /** a equipe carregada: serve para saber se quem está na tela é administrador */
  members?: TeamAccessMember[];
  /** "Adicionar várias de uma vez" (F1-T6). Sem ele, o link não aparece. */
  onBulk?: () => void;
  onClose: () => void;
  /** chamado depois que a pessoa está criada e configurada, para recarregar a lista */
  onCreated: () => void;
}

export default function AddPersonWizard({ open, roles, inboxes, members = [], onBulk, onClose, onCreated }: AddPersonWizardProps) {
  const { can } = useUserPermissions();
  const { currentUser } = useAuthStore();
  const isSuper = useIsSuperAdmin();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [cargoKey, setCargoKey] = useState<string | null>(null);
  const [inboxIds, setInboxIds] = useState<Set<string>>(new Set());

  // Passo Números: criar o número da pessoa já aqui. Nome e telefone nascem do
  // que foi digitado no passo 1 e só viram "valor próprio" se a pessoa editar.
  // null = ainda não mexeu: o padrão depende de haver celular válido no passo 1.
  const [makeNumberEdit, setMakeNumberEdit] = useState<boolean | null>(null);
  const [numberNameEdit, setNumberNameEdit] = useState<string | null>(null);
  const [numberPhoneEdit, setNumberPhoneEdit] = useState<string | null>(null);

  // Depois de criar: o resumo (número criado) ou o aviso de número não criado.
  const [result, setResult] = useState<WizardResult | null>(null);
  const [retryOpen, setRetryOpen] = useState(false);
  const [retryingLink, setRetryingLink] = useState(false);
  // Guarda contra duplo clique (o `saving` só vale no render seguinte).
  const busyRef = useRef(false);

  const canCreateNumber = can('channels', 'create');
  const canLiberate = can('inboxes', 'update');
  const canSendAccess = can('users', 'send_access');

  // Os três de fábrica sempre aparecem, mesmo no cliente que não tem cargo
  // nenhum gravado no banco (ver cargoOptions) — senão este passo fica vazio e
  // não dá para cadastrar ninguém.
  const viewer = resolveActor(currentUser?.id, members, { isPlatformOwner: isSuper, name: String(currentUser?.name ?? '') });
  const isAdminViewer = viewerIsAdmin(viewer, isSuper);
  // Quem não é administrador não dá Administrador nem cargo que muda permissões
  // (o servidor recusa; a tela só não oferece).
  const cargoOptions = useMemo(
    () => assignableCargoOptions(buildCargoOptions(roles), { viewerIsAdmin: isAdminViewer, currentKey: null }),
    [roles, isAdminViewer],
  );
  const selectedCargo = useMemo(
    () => cargoOptions.find(o => o.key === cargoKey) ?? null,
    [cargoOptions, cargoKey],
  );
  // Administrador alcança toda instância sozinho — pedir para escolher instância
  // seria oferecer uma decisão que não tem efeito.
  const roleSeesAll = selectedCargo?.seesAllInboxes ?? false;

  const celularNational = national(whatsapp);
  const numberName = numberNameEdit ?? name.trim();
  const numberPhone = numberPhoneEdit ?? (validPhone(celularNational) ? celularNational : '');
  // Sem celular válido no passo 1 não há telefone para sugerir: o bloco nasce
  // desmarcado (a pessoa marca e digita se quiser).
  const makeNumber = makeNumberEdit ?? validPhone(celularNational);
  const willMakeNumber = canCreateNumber && makeNumber;
  // Por que o botão final está parado — dito na tela, nunca botão morto calado.
  const numberHint = !willMakeNumber ? null
    : numberName.trim().length === 0 ? 'Falta o nome do número.'
      : numberPhone.length === 0 ? 'Falta o telefone do número.'
        : !validPhone(numberPhone) ? 'Telefone incompleto.'
          : null;
  const numberReady = numberHint === null;

  const reset = () => {
    setStep(0); setName(''); setEmail(''); setWhatsapp('');
    setCargoKey(null); setInboxIds(new Set());
    setMakeNumberEdit(null); setNumberNameEdit(null); setNumberPhoneEdit(null);
    setResult(null); setRetryOpen(false); setRetryingLink(false);
    busyRef.current = false;
  };

  const close = () => { reset(); onClose(); };

  // Reabrir nunca mostra o resumo de uma pessoa anterior.
  useEffect(() => {
    if (open) { setResult(null); setRetryOpen(false); }
  }, [open]);

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
    if (busyRef.current) return;
    busyRef.current = true;
    setSaving(true);
    try {
      const celular = digitsOf(whatsapp);
      let created: any;
      try {
        created = await usersService.createUser({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          whatsapp_number: celular,
          // Sem senha: quem a define é a própria pessoa, ao abrir o link de
          // acesso. O servidor gera uma provisória que ninguém precisa saber.
          ...(selectedCargo ? cargoPayload(selectedCargo) : {}),
        } as any);
      } catch (e: any) {
        toast.error(apiErrorMessage(e, 'Não consegui criar a pessoa.'));
        return;
      }

      // Daqui em diante a pessoa existe: nada abaixo pode desfazê-la nem fechar
      // a janela sem dizer o que ficou pendente.
      const userId = String(created?.id ?? '');
      const cargo = selectedCargo?.label ?? '';

      let number: CreatedWhatsappNumber | null = null;
      let numberFailure = '';
      if (userId && willMakeNumber && validPhone(numberPhone)) {
        try {
          number = await usersService.createWhatsappNumber(userId, {
            name: numberName.trim(), phone_number: toApiPhone(numberPhone),
          });
        } catch (e) {
          numberFailure = apiErrorMessage(e, 'Não consegui criar o número agora.');
        }
      }

      const liberateFailures: string[] = [];
      if (userId && canLiberate && !roleSeesAll && inboxIds.size > 0) {
        // Uma chamada por número porque é assim que a API de membros funciona
        // (a lista é por número, não por pessoa). Falha em uma não pode perder
        // a pessoa que acabou de ser criada — por isso o aviso é parcial.
        //
        // Só ADICIONA esta pessoa (POST). O antigo "lê a lista e regrava com
        // mais um" apagava todo mundo do número quando a leitura falhava (ela
        // devolve [] no erro) e promovia à distribuição quem só tinha acesso
        // automático.
        for (const inboxId of inboxIds) {
          try {
            await InboxMembersService.add(inboxId, [userId]);
          } catch {
            liberateFailures.push(inboxes.find(i => String(i.id) === inboxId)?.name ?? inboxId);
          }
        }
      }

      // Link de acesso: fala com o mundo de fora, por isso é o último passo.
      let link: LinkOutcome | null = null;
      if (sendAccess && userId) {
        link = validPhone(national(celular))
          ? await sendAccessLink(userId, national(celular))
          : { state: 'skipped', error: `falta o celular de ${name.trim()}` };
      }

      onCreated();
      // Só o caminho 100% limpo e sem número fecha com aviso rápido; qualquer
      // pendência fica numa tela que não some sozinha.
      const clean = !number && !numberFailure && liberateFailures.length === 0 && (!link || link.state === 'sent');
      if (clean) {
        toast.success(link ? `Cadastro criado e link enviado para o celular de ${name.trim()}.` : `${name.trim()} está na equipe.`);
        close();
      } else {
        setResult({ userId, cargo, number, numberFailure, link, liberateFailures });
      }
    } finally {
      busyRef.current = false;
      setSaving(false);
    }
  };

  // A pessoa recém-criada no formato mínimo que a janela "Criar número para
  // {nome}" lê (id, nome, celular) — evita recarregar a equipe só para achá-la.
  const createdMember = result
    ? ({ id: result.userId, name: name.trim(), email: email.trim(), whatsapp_number: digitsOf(whatsapp) || null } as unknown as TeamAccessMember)
    : null;

  const retryLink = async () => {
    if (!result) return;
    setRetryingLink(true);
    try {
      const link = await sendAccessLink(result.userId, celularNational);
      setResult({ ...result, link });
    } finally {
      setRetryingLink(false);
    }
  };

  if (result && createdMember) {
    const liberateWarning = result.liberateFailures.length > 0 ? [`Não consegui liberar: ${result.liberateFailures.join(', ')}`] : [];
    const openQr = () => { const id = result.number?.inbox_id; close(); if (id) navigate(qrPath(id)); };
    return (
      <>
        <Dialog open={open && !retryOpen} onOpenChange={o => !o && !saving && close()}>
          <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{name.trim()} entrou na equipe</DialogTitle>
              <DialogDescription>O que ficou pronto e o que falta.</DialogDescription>
            </DialogHeader>
            {result.number ? (
              <NumberCreatedSummary
                personName={name.trim()}
                numberName={result.number.name}
                phone={celularNational}
                linkSent={result.link?.state ?? 'sent'}
                linkError={result.link?.error}
                hideLink={!result.link}
                inboxId={result.number.inbox_id}
                extraLines={[`Cadastrado como ${result.cargo}`]}
                warnings={liberateWarning}
                onOpenQr={openQr}
                onDone={close}
                onRetryLink={result.link?.state === 'error' && canSendAccess ? retryLink : undefined}
                retrying={retryingLink}
              />
            ) : (
              <div className="space-y-4">
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                    <span>Cadastrado como {result.cargo}</span>
                  </li>
                  {liberateWarning.map(w => (
                    <li key={w} className="flex items-start gap-2">
                      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                      <span>{w}</span>
                    </li>
                  ))}
                  {result.numberFailure && (
                    <li className="flex items-start gap-2">
                      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                      <span>
                        Número não criado: {result.numberFailure}
                        <Button variant="outline" size="sm" className="ml-2 h-7" onClick={() => setRetryOpen(true)}>
                          Tentar de novo
                        </Button>
                      </span>
                    </li>
                  )}
                  {result.link && (
                    <li className="flex items-start gap-2">
                      {result.link.state === 'sent' ? (
                        <>
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                          <span>Link de acesso enviado para {telefone(celularNational) || 'o celular'} · vale 24 h</span>
                        </>
                      ) : (
                        <>
                          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                          <span>
                            Link não enviado: {result.link.error || 'Não consegui enviar o link agora.'}
                            {result.link.state === 'error' && canSendAccess && (
                              <Button variant="outline" size="sm" className="ml-2 h-7" onClick={retryLink} disabled={retryingLink}>
                                Tentar de novo
                              </Button>
                            )}
                          </span>
                        </>
                      )}
                    </li>
                  )}
                </ul>
                <div className="flex justify-end">
                  <Button onClick={close}>Concluir</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
        {retryOpen && (
          <CreateNumberDialog
            member={createdMember}
            open
            onClose={() => setRetryOpen(false)}
            onDone={() => { onCreated(); close(); }}
            // O link já saiu: o segundo invalidaria o primeiro.
            linkAlreadySent={result.link?.state === 'sent'}
          />
        )}
      </>
    );
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && !saving && close()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar pessoa</DialogTitle>
          <DialogDescription>
            Cadastro, cargo e números — e, no fim, o acesso vai pelo celular informado.
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
                <UILabel className="text-xs">E-mail (vira o login)</UILabel>
                <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="ana@imobiliaria.com.br" className="mt-1" />
              </div>
              <div>
                <UILabel className="text-xs">Celular com DDD</UILabel>
                <Input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="Ex: 11 94087 1974" className="mt-1" />
                <p className="mt-1 text-xs text-muted-foreground">
                  É para onde vai o link de acesso, no último passo. Quem cria a senha é a própria
                  pessoa, ao abrir o link.
                </p>
              </div>
              {onBulk && (
                <button type="button" onClick={onBulk} className="text-xs font-medium text-primary hover:underline">
                  Adicionar várias de uma vez
                </button>
              )}
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
            <div className="space-y-4">
              {canCreateNumber && (
                <div className="space-y-2 rounded-lg border border-border p-3">
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={makeNumber}
                      onChange={e => setMakeNumberEdit(e.target.checked)}
                      className="h-4 w-4 rounded"
                    />
                    Criar um número novo para {name.trim()}
                  </label>
                  {makeNumber && (
                    <div className="space-y-2 pl-6">
                      <div>
                        <UILabel htmlFor="wizard-number-name" className="text-xs">Nome do número</UILabel>
                        <Input id="wizard-number-name" value={numberName} onChange={e => setNumberNameEdit(e.target.value)} className="mt-1" />
                      </div>
                      <div>
                        <UILabel htmlFor="wizard-number-phone" className="text-xs">Telefone do número</UILabel>
                        <BrPhoneInput
                          id="wizard-number-phone"
                          value={numberPhone}
                          onChange={setNumberPhoneEdit}
                          className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                          O telefone do chip que vai ficar conectado ao WhatsApp. {name.trim()} fica como dono do número.
                        </p>
                      </div>
                    </div>
                  )}
                  {numberHint && <p role="status" className="pl-6 text-xs text-amber-700 dark:text-amber-400">{numberHint}</p>}
                </div>
              )}

              {roleSeesAll ? (
                <p className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                  Administrador vê <strong>todos os números</strong> automaticamente — não há o que escolher aqui.
                </p>
              ) : canLiberate && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Também atende números que já existem</p>
                  {inboxes.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhum número conectado ainda.</p>
                  ) : (
                    <>
                      {inboxes.map(ib => {
                        const state = numberState({ connection: ib.connection ?? null, never_connected: false });
                        return (
                          <label key={ib.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-2.5 hover:bg-muted/30">
                            <input
                              type="checkbox"
                              checked={inboxIds.has(String(ib.id))}
                              onChange={() => toggleInbox(String(ib.id))}
                              className="h-4 w-4 rounded"
                            />
                            <span className="flex-1 text-sm">
                              {ib.name}
                              {ib.phone && <span className="ml-2 text-xs text-muted-foreground">{telefone(ib.phone) || ib.phone}</span>}
                            </span>
                            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <span className={`h-2 w-2 rounded-full ${DOT_CLASS[state]}`} aria-hidden="true" />
                              {STATE_TEXT[state]}
                            </span>
                          </label>
                        );
                      })}
                      <p className="pt-1 text-xs text-muted-foreground">
                        Marcado = atende esse número e entra na fila para receber leads novos desse número. Dá para
                        mudar depois na ficha da pessoa.
                      </p>
                    </>
                  )}
                </div>
              )}

              {!canCreateNumber && !canLiberate && !roleSeesAll && (
                <p className="text-xs text-muted-foreground">
                  Seu cargo não cria nem libera números. Dá para cadastrar a pessoa agora e ajustar depois.
                </p>
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
              <Button variant="outline" onClick={() => finish(false)} disabled={saving || !numberReady}>
                Só cadastrar
              </Button>
              {canSendAccess && (
                <Button onClick={() => finish(true)} disabled={saving || !numberReady} className="gap-1.5">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                  Cadastrar e enviar acesso
                </Button>
              )}
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
