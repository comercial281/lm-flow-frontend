import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import {
  Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label,
} from '@/components/ui/ds';
import { BrPhoneInput } from '@/components/shared/BrPhoneInput';
import { usersService } from '@/services/users';
import { apiErrorMessage } from '@/utils/apiHelpers';
import type { CreatedWhatsappNumber } from '@/types/users';
import type { TeamAccessMember } from '@/types/teamAccess';
import NumberCreatedSummary, { type LinkSent } from './NumberCreatedSummary';

/* Atalho "Criar número para {nome}": cria o número já com a pessoa como dona.

   Duas formas de conectar (quem lê o QR code):
   - no primeiro acesso (padrão): o link vai para o CELULAR da pessoa e ela mesma
     conecta. Por isso este caminho exige um celular válido ANTES de criar — sem
     destino, o link não sai e o número nasce sem ninguém para conectá-lo;
   - agora, nesta tela: vai direto ao QR code, com a pessoa ao lado.

   O limite do plano não aparece aqui de propósito: a tela do cliente não conhece
   esse número. Quando o servidor recusa, a frase dele (já em português) é mostrada
   como veio. Nunca mostrar o código da recusa. */

interface Props {
  member: TeamAccessMember;
  open: boolean;
  onClose: () => void;
  /** Chamado uma vez, quando o número foi criado e a lista precisa recarregar. */
  onDone: (result: CreatedWhatsappNumber) => void;
}

type Who = 'first' | 'now';

const digitsOf = (v?: string | null) => (v ?? '').replace(/\D/g, '');
/** Tira o 55 do país: o campo e o envio do link trabalham com DDD + número. */
const national = (v?: string | null) => {
  const d = digitsOf(v);
  return d.startsWith('55') && (d.length === 12 || d.length === 13) ? d.slice(2) : d;
};
const validPhone = (v: string) => v.length === 10 || v.length === 11;
const qrPath = (inboxId: string) => `/channels/${inboxId}/settings?tab=configuration&connect=1`;

export default function CreateNumberDialog({ member, open, onClose, onDone }: Props) {
  const navigate = useNavigate();
  const memberPhone = national(member.whatsapp_number);
  const hasCelular = validPhone(memberPhone);

  const [name, setName] = useState(member.name);
  const [phone, setPhone] = useState(memberPhone);
  const [who, setWho] = useState<Who>('first');
  const [sameAsNumber, setSameAsNumber] = useState(true);
  const [otherCelular, setOtherCelular] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedWhatsappNumber | null>(null);
  const [link, setLink] = useState<{ state: LinkSent; error?: string }>({ state: 'sent' });
  const [retrying, setRetrying] = useState(false);

  // Reabrir recomeça do zero (e para outra pessoa, com os dados dela).
  useEffect(() => {
    if (!open) return;
    setName(member.name);
    setPhone(national(member.whatsapp_number));
    setWho('first');
    setSameAsNumber(true);
    setOtherCelular('');
    setBusy(false);
    setError(null);
    setCreated(null);
    setLink({ state: 'sent' });
  }, [open, member.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const needsCelular = who === 'first' && !hasCelular;
  // Celular que recebe o link: o que a pessoa já tem; sem ele, o pedido no bloco amarelo.
  const celular = hasCelular ? memberPhone : (sameAsNumber ? phone : otherCelular);
  const canCreate = name.trim().length > 0 && validPhone(phone) && (!needsCelular || validPhone(celular));

  const finish = (result: CreatedWhatsappNumber) => { onDone(result); onClose(); };

  const sendLink = async (): Promise<{ state: LinkSent; error?: string }> => {
    try {
      const res = await usersService.sendAccess(member.id, { whatsapp_number: celular });
      const wa = res.whatsapp;
      if (wa?.sent) return { state: 'sent' };
      if (wa?.error) return { state: 'error', error: wa.error };
      return { state: 'skipped', error: wa?.skipped };
    } catch (e) {
      return { state: 'error', error: apiErrorMessage(e, 'Não consegui enviar o link agora.') };
    }
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    let result: CreatedWhatsappNumber;
    try {
      result = await usersService.createWhatsappNumber(member.id, { name: name.trim(), phone_number: `55${phone}` });
    } catch (e) {
      setError(apiErrorMessage(e, 'Não consegui criar o número agora.'));
      setBusy(false);
      return;
    }
    if (who === 'now') {
      onDone(result);
      onClose();
      navigate(qrPath(result.inbox_id));
      return;
    }
    // O número já existe daqui em diante: falha do link NÃO desfaz nada.
    const sent = await sendLink();
    setCreated(result);
    setLink(sent);
    setBusy(false);
  };

  const retry = async () => {
    setRetrying(true);
    setLink(await sendLink());
    setRetrying(false);
  };

  // Fechar pelo X/Esc depois de criado também recarrega a lista.
  const close = () => { if (created) finish(created); else onClose(); };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o && !busy) close(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Criar número para {member.name}</DialogTitle>
          <DialogDescription>{member.name} fica como dono do número e atende por ele.</DialogDescription>
        </DialogHeader>

        {created ? (
          <NumberCreatedSummary
            personName={member.name}
            numberName={created.name}
            phone={celular}
            linkSent={link.state}
            linkError={link.error}
            inboxId={created.inbox_id}
            onOpenQr={() => { finish(created); navigate(qrPath(created.inbox_id)); }}
            onDone={() => finish(created)}
            onRetryLink={retry}
            retrying={retrying}
          />
        ) : (
          <>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="new-number-name">Nome do número</Label>
                <Input id="new-number-name" value={name} onChange={e => setName(e.target.value)} disabled={busy} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="new-number-phone">Telefone do número</Label>
                <BrPhoneInput
                  id="new-number-phone"
                  value={phone}
                  onChange={setPhone}
                  disabled={busy}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                />
                <p className="text-xs text-muted-foreground">O telefone do chip que vai ficar conectado ao WhatsApp.</p>
              </div>

              <fieldset className="space-y-2" disabled={busy}>
                <legend className="text-sm font-medium">Quem lê o QR code</legend>
                <Option checked={who === 'first'} onSelect={() => setWho('first')} label={`${member.name}, no primeiro acesso`}
                  hint={`O link de acesso vai para o celular de ${member.name}, que conecta o número ao entrar.`} />
                <Option checked={who === 'now'} onSelect={() => setWho('now')} label="Agora, nesta tela"
                  hint="Abre o QR code assim que o número for criado." />
              </fieldset>

              {needsCelular && (
                <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                  <p>{member.name} ainda não tem celular cadastrado, e precisa de um celular para receber o link de acesso.</p>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={sameAsNumber}
                      onChange={e => setSameAsNumber(e.target.checked)}
                      aria-label="É o mesmo telefone do número"
                    />
                    <span>É o mesmo telefone do número</span>
                  </label>
                  {!sameAsNumber && (
                    <>
                      <Label htmlFor="new-number-celular" className="sr-only">Celular de {member.name}</Label>
                      <BrPhoneInput
                        id="new-number-celular"
                        value={otherCelular}
                        onChange={setOtherCelular}
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                      />
                    </>
                  )}
                </div>
              )}

              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button>
              <Button onClick={submit} disabled={!canCreate || busy}>
                {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />}
                Criar número
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Option({ checked, onSelect, label, hint }: { checked: boolean; onSelect: () => void; label: string; hint: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded-md border p-2.5 text-sm has-[:checked]:border-primary">
      <input type="radio" name="who-reads-qr" className="mt-1" checked={checked} onChange={onSelect} aria-label={label} />
      <span>
        <span className="block font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </label>
  );
}
