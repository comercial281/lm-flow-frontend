// src/features/cardDoLead/blocos/BlocoFollowup.tsx
// Follow-up numa linha (a lista abre numa janelinha) — o MESMO FollowupTimeline
// de sempre (decisão de 31/08: uma fonte só).
import FollowupTimeline from '@/components/pipelines/FollowupTimeline';
import { conversaDoCard } from '../cardDoLead';
import type { CardDoLead } from '../useCardDoLead';

export default function BlocoFollowup({ card }: { card: CardDoLead }) {
  const { contato, item } = card;
  return (
    <div className="space-y-1">
      <span className="text-xs font-medium text-muted-foreground">Follow-up</span>
      <FollowupTimeline
        contactId={contato?.id != null ? String(contato.id) : null}
        conversationId={conversaDoCard(item)}
        leadName={contato?.name ?? null}
        compacto
      />
    </div>
  );
}
