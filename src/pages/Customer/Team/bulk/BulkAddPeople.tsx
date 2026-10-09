import { useMemo, useRef, useState } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import {
  Button, Input, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/ds';
import { usersService } from '@/services/users';
import { plural } from '@/lib/formato';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useIsSuperAdmin } from '@/hooks/useIsSuperAdmin';
import { useAuthStore } from '@/store/authStore';
import { resolveActor } from '@/features/users/deactivation/deactivationRules';
import type { BulkAddResult } from '@/types/users';
import type { CustomRole } from '@/types/customRoles';
import type { TeamAccessMember } from '@/types/teamAccess';
import { assignableCargoOptions, buildCargoOptions, cargoPayload } from '../cargoOptions';
import { viewerIsAdmin } from '../person/personSheetRules';
import { digitsOf, national, validPhone } from '../numbers/numberPhone';
import { parsePeopleRows, type ParseError, type PersonRow } from './parsePeopleRows';

/* "Adicionar várias de uma vez": a planilha do cliente vira pessoas num clique,
   todas com o mesmo cargo. O cargo é do lote inteiro de propósito — quem precisa
   de cargos diferentes cadastra em levas. O servidor decide o que cria: ele
   recusa o lote todo se o cargo passa do que o seu cargo pode dar (ninguém é
   criado) e devolve, por pessoa, criada / já existia / e-mail inválido / recusada. */

const MAX = 50;
export const MAX_SENTENCE = 'Adicione até 50 pessoas de uma vez.';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Props {
  open: boolean;
  roles: CustomRole[];
  members: TeamAccessMember[];
  onClose: () => void;
  /** Depois do "Concluir": a lista recarrega. */
  onDone: () => void;
}

interface Row extends PersonRow { id: number }

const emptyRow = (id: number): Row => ({ id, name: '', email: '', whatsapp: '' });

const rowIsBlank = (r: PersonRow) => !r.name.trim() && !r.email.trim() && !r.whatsapp.trim();
const rowIsValid = (r: PersonRow) =>
  EMAIL.test(r.email.trim()) && (!digitsOf(r.whatsapp) || validPhone(national(r.whatsapp)));

export default function BulkAddPeople({ open, roles, members, onClose, onDone }: Props) {
  const { can } = useUserPermissions();
  const { currentUser } = useAuthStore();
  const isSuper = useIsSuperAdmin();
  const canSendAccess = can('users', 'send_access');

  const nextId = useRef(4);
  const [rows, setRows] = useState<Row[]>([emptyRow(1), emptyRow(2), emptyRow(3)]);
  const [pasted, setPasted] = useState('');
  const [parseErrors, setParseErrors] = useState<ParseError[]>([]);
  const [cargoKey, setCargoKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [result, setResult] = useState<{ data: BulkAddResult; sent: boolean; sent_rows: PersonRow[] } | null>(null);
  const busy = useRef(false);

  // Mesma conta do "Adicionar pessoa": quem não é administrador não dá Administrador.
  const viewer = resolveActor(currentUser?.id, members, { isPlatformOwner: isSuper, name: String(currentUser?.name ?? '') });
  const isAdminViewer = viewerIsAdmin(viewer, isSuper);
  const cargoOptions = useMemo(
    () => assignableCargoOptions(buildCargoOptions(roles), { viewerIsAdmin: isAdminViewer, currentKey: null }),
    [roles, isAdminViewer],
  );
  // Corretor já marcado: é o cargo de quase todo lote; trocar é um clique.
  const selectedCargo = useMemo(
    () => cargoOptions.find(o => o.key === cargoKey)
      ?? (cargoKey === null ? cargoOptions.find(o => o.chaveRole === 'agent' && o.customRoleId == null) ?? null : null),
    [cargoOptions, cargoKey],
  );

  const filled = rows.filter(r => !rowIsBlank(r));
  const valid = filled.filter(rowIsValid);
  const invalidCount = filled.length - valid.length;

  // Por que os botões estão parados — dito na tela, nunca botão morto calado.
  const hint = filled.length > MAX ? MAX_SENTENCE
    : valid.length === 0 ? 'Preencha pelo menos uma pessoa com e-mail válido.'
      : invalidCount > 0 ? `${plural(invalidCount, 'linha com e-mail ou celular inválido', 'linhas com e-mail ou celular inválido')} — corrija ou apague.`
        : !selectedCargo ? 'Escolha o cargo.'
          : null;

  const update = (id: number, patch: Partial<PersonRow>) =>
    setRows(rs => rs.map(r => (r.id === id ? { ...r, ...patch } : r)));

  const addPasted = () => {
    const parsed = parsePeopleRows(pasted);
    setParseErrors(parsed.errors);
    if (parsed.rows.length === 0) return;
    setRows(rs => [
      ...rs.filter(r => !rowIsBlank(r)),
      ...parsed.rows.map(p => ({ ...p, id: nextId.current++ })),
    ]);
    setPasted('');
  };

  const submit = async (sendAccess: boolean) => {
    if (busy.current || hint || !selectedCargo) return;
    busy.current = true;
    setSaving(true);
    setFailure(null);
    try {
      const people = valid.map(r => ({
        name: r.name.trim(),
        email: r.email.trim().toLowerCase(),
        // Só os dígitos, igual ao cadastro de uma pessoa só.
        whatsapp_number: digitsOf(r.whatsapp),
      }));
      const data = await usersService.bulkAdd({
        people,
        ...cargoPayload(selectedCargo),
        send_access: sendAccess,
      } as any);
      setResult({ data, sent: sendAccess, sent_rows: valid });
    } catch (e) {
      // Cargo recusado vem aqui com a frase do servidor: ninguém foi criado.
      setFailure(apiErrorMessage(e, 'Não consegui cadastrar agora.'));
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  const close = () => {
    const done = result !== null;
    setRows([emptyRow(1), emptyRow(2), emptyRow(3)]);
    setPasted(''); setParseErrors([]); setCargoKey(null); setFailure(null); setResult(null);
    onClose();
    if (done) onDone();
  };

  if (result) {
    const { data, sent, sent_rows } = result;
    const phoneOf = (email: string) => digitsOf(sent_rows.find(r => r.email.trim().toLowerCase() === email.toLowerCase())?.whatsapp);
    const lines: Array<{ key: string; who: string; text: string; bad?: boolean }> = [
      ...data.invited.map(p => ({
        key: `i-${p.id}`,
        who: p.name || p.email,
        text: sent && p.access === 'sent' ? 'Criada · link enviado'
          : !phoneOf(p.email) ? 'Criada · sem celular — use Copiar link na ficha'
            : 'Criada · link não enviado',
      })),
      ...data.skipped.map(p => ({
        key: `s-${p.email}`, who: p.email,
        text: p.reason === 'exists' ? 'Já existia' : 'E-mail inválido', bad: p.reason !== 'exists',
      })),
      ...data.refused.map(p => ({ key: `r-${p.email}`, who: p.email, text: `Recusada: ${p.message}`, bad: true })),
    ];
    return (
      <Dialog open={open} onOpenChange={o => !o && close()}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Resultado</DialogTitle>
            <DialogDescription>
              {plural(data.invited.length, 'pessoa criada', 'pessoas criadas')}
              {lines.length > data.invited.length ? ` de ${plural(lines.length, 'enviada', 'enviadas')}` : ''}.
            </DialogDescription>
          </DialogHeader>
          <ul className="divide-y divide-border rounded-lg border border-border text-sm">
            {lines.map(l => (
              <li key={l.key} className="flex flex-wrap justify-between gap-2 px-3 py-2">
                <span className="font-medium">{l.who}</span>
                <span className={l.bad ? 'text-destructive' : 'text-muted-foreground'}>{l.text}</span>
              </li>
            ))}
          </ul>
          <DialogFooter><Button onClick={close}>Concluir</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && !saving && close()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar várias pessoas</DialogTitle>
          <DialogDescription>
            Todas entram com o mesmo cargo. Celular é opcional, mas sem ele o link de acesso não vai.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label htmlFor="bulk-paste" className="text-xs font-medium">Colar da planilha</label>
          <textarea
            id="bulk-paste"
            value={pasted}
            onChange={e => setPasted(e.target.value)}
            placeholder={'Nome;E-mail;Celular\nAna Souza;ana@x.com;11 94087-1974'}
            rows={3}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
          />
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" size="sm" onClick={addPasted} disabled={!pasted.trim()}>
              Adicionar as linhas coladas
            </Button>
            <span className="text-xs text-muted-foreground">Nome, e-mail e celular, nessa ordem.</span>
          </div>
          {parseErrors.length > 0 && (
            <ul className="space-y-0.5 text-xs text-destructive" role="alert">
              {parseErrors.map(e => <li key={e.line}>{e.message}</li>)}
            </ul>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="grid grid-cols-[1fr_1.2fr_0.9fr_2rem] gap-2 text-xs text-muted-foreground">
            <span>Nome</span><span>E-mail</span><span>Celular</span><span />
          </div>
          {rows.map((r, i) => {
            const bad = !rowIsBlank(r) && !rowIsValid(r);
            return (
              <div key={r.id} className="grid grid-cols-[1fr_1.2fr_0.9fr_2rem] items-center gap-2">
                <Input aria-label={`Nome da pessoa ${i + 1}`} value={r.name} onChange={e => update(r.id, { name: e.target.value })} />
                <Input aria-label={`E-mail da pessoa ${i + 1}`} value={r.email} aria-invalid={bad} onChange={e => update(r.id, { email: e.target.value })} />
                <Input aria-label={`Celular da pessoa ${i + 1}`} value={r.whatsapp} onChange={e => update(r.id, { whatsapp: e.target.value })} />
                <button
                  type="button"
                  aria-label={`Tirar a pessoa ${i + 1}`}
                  title="Tirar a linha"
                  onClick={() => setRows(rs => (rs.length > 1 ? rs.filter(x => x.id !== r.id) : [emptyRow(nextId.current++)]))}
                  className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}
          <Button type="button" variant="ghost" size="sm" className="gap-1" onClick={() => setRows(rs => [...rs, emptyRow(nextId.current++)])}>
            <Plus className="h-3.5 w-3.5" /> Adicionar linha
          </Button>
        </div>

        <div className="space-y-1.5">
          <span className="text-xs font-medium">Cargo de todas</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {cargoOptions.map(o => {
              const selected = selectedCargo?.key === o.key;
              return (
                <button
                  key={o.key}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setCargoKey(o.key)}
                  className={`rounded-lg border p-2 text-left text-sm transition-colors ${selected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                >
                  <span className="block font-medium">{o.label}</span>
                  {o.description && <span className="block text-xs text-muted-foreground">{o.description}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {failure && <p role="alert" className="text-sm text-destructive">{failure}</p>}
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={close} disabled={saving}>Cancelar</Button>
          <Button variant="outline" onClick={() => submit(false)} disabled={saving || !!hint}>Só cadastrar</Button>
          {canSendAccess && (
            <Button onClick={() => submit(true)} disabled={saving || !!hint}>
              {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Cadastrar e enviar acesso
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
