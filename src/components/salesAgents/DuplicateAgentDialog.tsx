import { useState } from 'react';
import { toast } from 'sonner';
import { Copy, Loader2 } from 'lucide-react';
import {
  Button, Input, Label,
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/ds';
import {
  salesAgentsService,
  type DuplicatedSalesAgent,
  type SalesAgent,
} from '@/services/salesAgents/salesAgentsService';
import { defaultCopyName, duplicateSummary } from '@/features/salesAgents/duplicateAgent';
import { motivoDaFalha } from '@/features/salesAgents/erroDoServidor';

interface Props {
  agent: SalesAgent;
  inboxes: { id: string | number; name: string }[];
  onClose: () => void;
  onDuplicated: (copy: DuplicatedSalesAgent) => void;
}

/**
 * "Montei a IA num número, quero a mesma no outro." A cópia leva tudo (configuração,
 * lições, base de conhecimento) e nasce DESLIGADA — duas IAs ligadas no mesmo número
 * brigariam pela conversa.
 */
export default function DuplicateAgentDialog({ agent, inboxes, onClose, onDuplicated }: Props) {
  const [name, setName] = useState(defaultCopyName(agent.name));
  const [inboxId, setInboxId] = useState('');
  const [saving, setSaving] = useState(false);

  const sameNumber = inboxId !== '' && String(agent.inbox_id ?? '') === inboxId;

  const submit = async () => {
    setSaving(true);
    try {
      const copy = await salesAgentsService.duplicate(agent.id, {
        name: name.trim() || undefined,
        inbox_id: inboxId || null,
      });
      toast.success(duplicateSummary(copy), { duration: 8000 });
      (copy.duplicated?.warnings ?? []).forEach((w) => toast.warning(w, { duration: 10000 }));
      onDuplicated(copy);
    } catch (e) {
      // Clique explícito: aqui o motivo do servidor aparece, nos dois formatos da API.
      toast.error(motivoDaFalha(e, 'Não consegui duplicar a IA.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v && !saving) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Duplicar IA</DialogTitle>
          <DialogDescription>
            Cria uma cópia de <strong>{agent.name}</strong> com toda a configuração, as lições do
            Aprendizado e a Base de Conhecimento. O histórico de conversas não vai junto.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="dup_name">Nome da cópia</Label>
            <Input id="dup_name" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
          </div>

          <div>
            <Label htmlFor="dup_inbox">Número em que a cópia vai atender</Label>
            <select
              id="dup_inbox"
              value={inboxId}
              onChange={(e) => setInboxId(e.target.value)}
              className="mt-1 w-full rounded-md border border-sidebar-border bg-background px-3 py-2 text-sm"
            >
              <option value="">— Escolher depois —</option>
              {inboxes.map((i) => (
                <option key={i.id} value={String(i.id)}>{i.name}</option>
              ))}
            </select>
            {sameNumber && (
              <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                É o mesmo número da IA original. Se as duas ficarem ligadas nele, quem atende
                cada lead depende dos gatilhos e da prioridade de cada uma.
              </p>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            A cópia nasce <strong>desligada</strong>. Confira principalmente <em>Para quem ela passa o lead</em> e
            o follow-up — se a original entrega para uma roleta específica, a cópia entrega para a mesma.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
            Duplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
