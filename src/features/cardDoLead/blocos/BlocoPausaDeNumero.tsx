// Fluxo pausado porque o lead já conversa em outro número (Entrega 4): a ficha
// do card diz qual fluxo e deixa escolher por qual número seguir. Lê dos mesmos
// fluxos do card (`forCard`); sem pausa por número, não desenha nada. O servidor
// decide; "Fazer sempre assim" aparece pra todos e o servidor só honra de quem
// edita o fluxo (o card não tem a permissão de edição do fluxo à mão).
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button, Checkbox } from '@/components/ui/ds';
import {
  flowAutomationInstancesService,
  type RunningFlow,
} from '@/services/flowAutomations/flowAutomationInstancesService';
import { serverMessage } from '@/features/flowAutomations/guide';
import CaixaDoCard from './CaixaDoCard';

interface Props {
  contactId: string | null;
  conversationId: string | null;
  /** Depois de resolver, o card relê o que mostra (selos do quadro). */
  aoResolver?: () => void;
}

const SEM_MENSAGEM = 'Esse número não manda mensagem sozinho.';

export default function BlocoPausaDeNumero({ contactId, conversationId, aoResolver }: Props) {
  const [pausas, setPausas] = useState<RunningFlow[]>([]);
  const [sempre, setSempre] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    if (!contactId && !conversationId) return;
    try {
      const { flows } = await flowAutomationInstancesService.forCard({ contactId, conversationId });
      setPausas(flows.filter(f => f.phase === 'paused' && f.paused_code === 'other_number'));
    } catch {
      setPausas([]);
    }
  }, [contactId, conversationId]);

  useEffect(() => { void carregar(); }, [carregar]);

  async function resolver(id: string, choice: 'conversation' | 'flow') {
    setOcupado(true);
    try {
      const r = await flowAutomationInstancesService.resume(id, { choice, always: sempre });
      toast.success(r.message || 'Pronto.');
      await carregar();
      aoResolver?.();
    } catch (e) {
      toast.error(serverMessage(e, 'Não deu pra resolver agora. Tente de novo.'));
    } finally {
      setOcupado(false);
    }
  }

  if (pausas.length === 0) return null;

  return (
    <CaixaDoCard titulo="Pausado por número">
      <div className="grid gap-3">
        {pausas.map(f => {
          const c = f.number_conflict;
          const final = c?.conversation_final ? ` (final ${c.conversation_final})` : '';
          const finalDoFluxo = c?.flow_final ? ` (final ${c.flow_final})` : '';
          const pelaConversa = c ? c.conversation_sendable : true;
          return (
            <div key={f.id} data-pausa-de-numero className="grid gap-2">
              <p className="text-xs text-foreground">
                {f.flow_name ?? 'Fluxo'} pausado: já conversa em outro número{final}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {pelaConversa ? (
                  <Button size="sm" variant="outline" className="text-xs" disabled={ocupado}
                    onClick={() => void resolver(f.id, 'conversation')}>
                    Mandar pela conversa dele{final}
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">{SEM_MENSAGEM}</span>
                )}
                <Button size="sm" variant="outline" className="text-xs" disabled={ocupado}
                  onClick={() => void resolver(f.id, 'flow')}>
                  Mandar pelo número do fluxo{finalDoFluxo}
                </Button>
              </div>
            </div>
          );
        })}
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <Checkbox checked={sempre} onCheckedChange={v => setSempre(v === true)} />
          Fazer sempre assim neste fluxo
        </label>
      </div>
    </CaixaDoCard>
  );
}
