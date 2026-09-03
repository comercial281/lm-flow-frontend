import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/ds';
import { Loader2, Shuffle } from 'lucide-react';
import { toast } from 'sonner';
import InboxesService from '@/services/channels/inboxesService';
import inboxMembersService from '@/services/channels/inboxMembersService';
import { getMessagingInboxes } from '@/components/scheduledActions/scheduledActionChannelUtils';
import type { Inbox } from '@/types/channels/inbox';
import type { User } from '@/types/users';
import { roletaConfigService, type RoletaConfig } from '@/services/roletaConfig/roletaConfigService';

interface CreateRoletaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: User[];
  /** Chamado com a roleta recém-criada pra atualizar a lista no card. */
  onCreated: (roleta: RoletaConfig) => void;
}

/**
 * Criação de roleta direto do card do lead (sem ir pra tela de config).
 * Enxuto: escolhe o canal (inbox), marca os corretores (WhatsApp já vem do
 * cadastro do usuário quando existe) e salva. Defaults: ativa, timeout 30min,
 * peso 1 por corretor. Ajustes finos ficam na tela de Roleta em Configurações.
 */
export default function CreateRoletaModal({ open, onOpenChange, users, onCreated }: CreateRoletaModalProps) {
  const [inboxes, setInboxes] = useState<Inbox[]>([]);
  const [loadingInboxes, setLoadingInboxes] = useState(false);
  const [inboxId, setInboxId] = useState('');
  // Nome da roleta. Em branco ela se chama pelo nome do NÚMERO de entrada — que
  // é exatamente o que fazia o seletor do card listar
  // "apto-premium-bernardo-numero-principal" em vez de uma roleta reconhecível.
  const [nome, setNome] = useState('');
  const [timeoutMin, setTimeoutMin] = useState(30);
  const [gestorNum, setGestorNum] = useState('');
  // user_id -> whatsapp (marcado quando presente no map)
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  // Quem um humano liberou no número escolhido. Só esses podem entrar na
  // roleta (o servidor recusa os demais); o acesso automático — a pessoa virou
  // dona de um lead ali — não conta. `null` = ainda não sabemos (sem número
  // escolhido, ou carregando): a lista inteira aparece, como antes.
  const [liberados, setLiberados] = useState<Set<string> | null>(null);

  useEffect(() => {
    if (!inboxId) { setLiberados(null); return; }
    let cancelled = false;
    inboxMembersService.get(inboxId)
      .then(list => {
        if (cancelled) return;
        setLiberados(new Set(list.filter(m => m.auto_granted !== true).map(m => String(m.id))));
      })
      .catch(() => { if (!cancelled) setLiberados(null); });
    return () => { cancelled = true; };
  }, [inboxId]);

  useEffect(() => {
    if (!open) return;
    // reset ao abrir
    setInboxId('');
    setNome('');
    setTimeoutMin(30);
    setGestorNum('');
    setSelected({});
    setLoadingInboxes(true);
    InboxesService.list()
      .then(res => setInboxes(getMessagingInboxes(res.data || [])))
      .catch(() => setInboxes([]))
      .finally(() => setLoadingInboxes(false));
  }, [open]);

  const toggleMember = (u: User) => {
    setSelected(prev => {
      const next = { ...prev };
      if (u.id in next) {
        delete next[u.id];
      } else {
        next[u.id] = u.whatsapp_number || '';
      }
      return next;
    });
  };

  const setMemberWhats = (userId: string, value: string) => {
    setSelected(prev => ({ ...prev, [userId]: value }));
  };

  const selectedIds = useMemo(() => Object.keys(selected), [selected]);

  async function handleSave() {
    if (!inboxId) {
      toast.error('Escolha o canal (inbox) da roleta.');
      return;
    }
    const members = selectedIds
      .filter(id => (selected[id] || '').trim())
      .map((id, i) => ({
        user_id: id,
        weight: 1,
        is_active: true,
        position: i,
        personal_whatsapp_number: selected[id].trim(),
      }));
    if (members.length === 0) {
      toast.error('Marque ao menos um corretor com número de WhatsApp.');
      return;
    }
    setSaving(true);
    try {
      const created = await roletaConfigService.create({
        // Vazio = sem apelido: o backend resolve pro nome do número de entrada.
        name: nome.trim() || null,
        inbox_id: inboxId,
        is_active: true,
        // Atalho rápido cria no Rodízio. O modo (inclusive Leilão) se troca na
        // tela Automações > Distribuição de Leads.
        distribution_mode: 'rodizio',
        timeout_minutes: timeoutMin,
        gestor_whatsapp_number: gestorNum.trim(),
        notification_inbox_id: null,
        members,
      });
      // o create às vezes não devolve inbox_name — completa pro select mostrar bonito
      const inboxName = inboxes.find(i => i.id === inboxId)?.name;
      onCreated({
        ...created,
        inbox_name: created.inbox_name || inboxName || null,
        // Mesma razão: sem o resolvido, a roleta recém-criada entrava na lista do
        // card com o nome do canal mesmo tendo sido batizada agora.
        display_name: created.display_name || nome.trim() || inboxName || null,
      });
      toast.success('Roleta criada.');
      onOpenChange(false);
    } catch (e) {
      console.error('Erro ao criar roleta:', e);
      toast.error('Não foi possível criar a roleta.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Shuffle className="h-4 w-4" />
            Nova roleta
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Nome — o que vai aparecer no card, no board e na lista de roletas. */}
          <div className="grid gap-1.5">
            <Label className="text-xs">Nome da roleta</Label>
            <Input
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder={inboxes.find(i => i.id === inboxId)?.name || 'Ex.: Plantão do fim de semana'}
              className="h-9 text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              É por este nome que ela aparece no card do lead. Em branco, usa o nome do canal.
            </p>
          </div>

          {/* Canal */}
          <div className="grid gap-1.5">
            <Label className="text-xs">Canal (inbox)</Label>
            <Select value={inboxId} onValueChange={setInboxId} disabled={loadingInboxes}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder={loadingInboxes ? 'Carregando…' : 'Escolha o canal'} />
              </SelectTrigger>
              <SelectContent>
                {inboxes.map(ib => (
                  <SelectItem key={ib.id} value={ib.id}>{ib.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Corretores */}
          <div className="grid gap-1.5">
            <Label className="text-xs">Corretores na roleta</Label>
            <div className="rounded-lg border border-border divide-y divide-border max-h-56 overflow-y-auto">
              {users.length === 0 && (
                <p className="text-xs text-muted-foreground p-3">Nenhum usuário cadastrado.</p>
              )}
              {users.map(u => {
                const checked = u.id in selected;
                const semAcesso = liberados !== null && !liberados.has(String(u.id));
                return (
                  <div key={u.id} className="p-2.5 space-y-2">
                    <label className={`flex items-center gap-2 ${semAcesso ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={semAcesso}
                        onChange={() => toggleMember(u)}
                        className="h-4 w-4 accent-primary"
                      />
                      <span className="text-sm font-medium truncate">{u.name}</span>
                      {semAcesso && (
                        <span className="text-[10px] text-muted-foreground">sem acesso a este número</span>
                      )}
                    </label>
                    {checked && (
                      <Input
                        value={selected[u.id]}
                        onChange={e => setMemberWhats(u.id, e.target.value)}
                        placeholder="WhatsApp do corretor (ex: 5511999999999)"
                        className="h-8 text-xs"
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground">
              O WhatsApp já vem do cadastro do usuário quando existe. Cada corretor recebe leads em rodízio.
            </p>
          </div>

          {/* Timeout + gestor */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs">Tempo p/ aceitar (min)</Label>
              <Input
                type="number"
                min={1}
                value={timeoutMin}
                onChange={e => setTimeoutMin(Number(e.target.value) || 30)}
                className="h-9 text-sm"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">WhatsApp do gestor (opcional)</Label>
              <Input
                value={gestorNum}
                onChange={e => setGestorNum(e.target.value)}
                placeholder="Alertas de roleta"
                className="h-9 text-sm"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Criar roleta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
