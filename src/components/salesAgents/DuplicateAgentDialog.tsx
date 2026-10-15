import { useState } from 'react';
import { toast } from 'sonner';
import { Copy, Loader2 } from 'lucide-react';
import {
  Button, Input,
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/ds';
import {
  salesAgentsService,
  type DuplicatedSalesAgent,
  type SalesAgent,
} from '@/services/salesAgents/salesAgentsService';
import { defaultCopyName, duplicateSummary } from '@/features/salesAgents/duplicateAgent';
import { motivoDaFalha } from '@/features/salesAgents/erroDoServidor';
import { Seletor } from '@/components/base/Seletor';
import Aviso from '@/components/base/Aviso';
import { CampoDaJanela, GrupoDaJanela } from '@/components/base/janela';

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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Duplicar IA</DialogTitle>
          <DialogDescription>
            Cria uma cópia de <strong>{agent.name}</strong> com toda a configuração, as lições do
            aprendizado e a base de conhecimento. O histórico de conversas não vai junto.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5">
          <GrupoDaJanela titulo="A cópia">
            <CampoDaJanela rotulo="Nome da cópia" htmlFor="dup_name">
              <Input id="dup_name" className="w-full" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
            </CampoDaJanela>

            <CampoDaJanela rotulo="Número em que a cópia vai atender" htmlFor="dup_inbox">
              <Seletor
                id="dup_inbox"
                value={inboxId}
                onChange={(e) => setInboxId(e.target.value)}
                className="w-full"
              >
                <option value="">— Escolher depois —</option>
                {inboxes.map((i) => (
                  <option key={i.id} value={String(i.id)}>{i.name}</option>
                ))}
              </Seletor>
            </CampoDaJanela>
            {sameNumber && (
              <Aviso tom="atencao" compacto>
                É o mesmo número da IA original. Se as duas ficarem ligadas nele, quem atende
                cada lead depende dos gatilhos e da prioridade de cada uma.
              </Aviso>
            )}
          </GrupoDaJanela>

          <Aviso tom="info" compacto>
            A cópia nasce <strong>desligada</strong>. Confira principalmente para quem ela passa o lead e
            o follow-up: se a original entrega para uma roleta específica, a cópia entrega para a mesma.
          </Aviso>
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
