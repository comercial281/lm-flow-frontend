// src/features/cardDoLead/blocos/BlocoOQueAIAEntendeu.tsx
// O que a IA entendeu da conversa. empty:hidden: a caixa some quando a IA não
// tem o que dizer.
import AiUnderstandingPanel from '@/components/chat/contact-sidebar/AiUnderstandingPanel';
import type { PipelineItem } from '@/types/analytics';
import type { Conversation } from '@/types/chat/api';

export default function BlocoOQueAIAEntendeu({ item }: { item: PipelineItem }) {
  const conversa = (item.conversation ?? null) as unknown as Conversation | null;
  if (!conversa) return null;
  return (
    <div className="rounded-xl border border-border p-4 empty:hidden">
      <AiUnderstandingPanel conversation={conversa} embutido />
    </div>
  );
}
