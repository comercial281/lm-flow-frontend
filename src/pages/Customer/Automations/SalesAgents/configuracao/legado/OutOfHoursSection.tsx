import { useEffect, useState } from 'react';
import { Label, Textarea } from '@/components/ui/ds';
import { type SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { Toggle } from '../comum';

// Fora do horário o lead recebia SILÊNCIO: o sistema só parava de responder e
// ninguém retomava depois. Aqui o dono liga um aviso automático, que não passa
// pelo Claude (custo zero) e sai no máximo uma vez por conversa por dia.
export function OutOfHoursSection({ agent, onSave }: { agent: SalesAgent; onSave: (patch: Partial<SalesAgent>) => void }) {
  const on = !!agent.out_of_hours_reply;
  const [draft, setDraft] = useState(agent.out_of_hours_message ?? '');

  useEffect(() => { setDraft(agent.out_of_hours_message ?? ''); }, [agent.id, agent.out_of_hours_message]);

  return (
    <div className="mt-4 pt-3 border-t border-sidebar-border">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Avisar quem escrever fora do horário</div>
          <div className="text-xs text-muted-foreground">
            Sem isso, o lead que manda mensagem de madrugada não recebe absolutamente nada.
          </div>
        </div>
        <Toggle on={on} onChange={(v) => onSave({ out_of_hours_reply: v })} rotulo="avisar quem escrever fora do horário" />
      </div>

      {on && (
        <div className="mt-2">
          <Label htmlFor="ooh_msg" className="text-xs">Mensagem (opcional)</Label>
          <Textarea
            id="ooh_msg"
            rows={2}
            className="mt-1"
            placeholder="Vazio = a IA escreve sozinha e já diz quando volta (ex: “te respondo amanhã às 8h”)."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => onSave({ out_of_hours_message: draft.trim() || null })}
          />
        </div>
      )}
    </div>
  );
}
