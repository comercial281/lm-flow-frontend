// src/features/cardDoLead/blocos/BlocoFollowup.tsx
// Follow-up numa linha (a lista abre numa janelinha) — o MESMO FollowupTimeline
// de sempre (decisão de 31/08: uma fonte só).
import FollowupTimeline from '@/components/pipelines/FollowupTimeline';
import { conversaDoCard } from '../cardDoLead';
import type { CardDoLead } from '../useCardDoLead';

export default function BlocoFollowup({ card }: { card: CardDoLead }) {
  const { contato, item } = card;
  return (
    // O título "Follow-up" é do grupo da janela.
    <div>
      <FollowupTimeline
        contactId={contato?.id != null ? String(contato.id) : null}
        conversationId={conversaDoCard(item)}
        // Card sem funil tem id vazio: aí a janela vai só com o lead.
        pipelineItemId={item?.id ? String(item.id) : null}
        aoColocar={card.etapa.aoColocarEmFollowup}
        compacto
      />
    </div>
  );
}
