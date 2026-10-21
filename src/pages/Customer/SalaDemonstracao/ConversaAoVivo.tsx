// Placeholder da Task 9: a conversa do lead ao vivo.
export interface ConversaAoVivoProps {
  conversationId: string | null;
}

export default function ConversaAoVivo(_props: ConversaAoVivoProps) {
  return <section aria-label="Conversa ao vivo" data-testid="conversa-ao-vivo" />;
}
