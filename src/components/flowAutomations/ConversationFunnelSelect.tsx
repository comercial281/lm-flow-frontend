import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/ds';
import { flowAutomationsService } from '@/services/flowAutomations/flowAutomationsService';
import type { FlowAutomation } from '@/types/flowAutomations';
import type { FunnelItemKind } from '@/types/messageFunnels';
import type { SequenceDraftItem } from '@/components/messaging/MessageSequenceEditor';
import {
  draftFromConversationFunnel,
  draftNotice,
  pickableFunnels,
} from '@/features/flowAutomations/conversationFunnelDraft';
import { serverMessage } from '@/features/flowAutomations/guide';

// "USAR FUNIL" nos modais de sequência (disparo em massa do Funil de vendas e
// Agendar envio), 05/10/2026: lista os funis de conversa (Funis de mensagem)
// ligados e prontos, em "Meus funis" e "Da equipe", e carrega o escolhido na
// sequência do editor (conversationFunnelDraft). Sem funil pronto, não aparece.

interface Props {
  /** Carrega a lista quando vira true (o modal abriu). */
  enabled: boolean;
  /** Os itens do funil escolhido, já no formato do editor. */
  onLoad: (items: SequenceDraftItem[], funnel: FlowAutomation) => void;
  /** Tipos que a tela não manda (ficam de fora, com aviso). */
  skipKinds?: FunnelItemKind[];
  className?: string;
}

export function ConversationFunnelSelect({ enabled, onLoad, skipKinds, className }: Props) {
  const [funnels, setFunnels] = useState<FlowAutomation[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    flowAutomationsService
      .list({ kind: 'conversation' })
      .then(list => alive && setFunnels(Array.isArray(list) ? list : []))
      .catch(() => alive && setFunnels([]));
    return () => {
      alive = false;
    };
  }, [enabled]);

  const { mine, team } = pickableFunnels(funnels);
  if (mine.length + team.length === 0) return null;

  const load = async (id: string) => {
    if (!id) return;
    try {
      const flow = await flowAutomationsService.get(id);
      const result = draftFromConversationFunnel(flow, { skipKinds });
      if (!result.items.length) {
        toast.error(`O funil "${flow.name}" não tem mensagem que dê pra mandar aqui.`);
        return;
      }
      onLoad(result.items, flow);
      const notice = draftNotice(result);
      if (notice) toast.warning(`Funil "${flow.name}" carregado. ${notice}`);
      else toast.success(`Funil "${flow.name}" carregado`);
    } catch (e) {
      toast.error(serverMessage(e, 'Não consegui carregar o funil.'));
    }
  };

  return (
    <Select value="" onValueChange={v => void load(v)}>
      <SelectTrigger className={className ?? 'h-7 w-40 text-xs'} aria-label="Usar funil">
        <SelectValue placeholder="Usar funil" />
      </SelectTrigger>
      <SelectContent>
        {mine.length > 0 && (
          <SelectGroup>
            <SelectLabel>Meus funis</SelectLabel>
            {mine.map(f => (
              <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
            ))}
          </SelectGroup>
        )}
        {team.length > 0 && (
          <SelectGroup>
            <SelectLabel>Da equipe</SelectLabel>
            {team.map(f => (
              <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
            ))}
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  );
}
