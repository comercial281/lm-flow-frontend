import type { FollowupStep } from '@/types/demoRoom';

// Placeholder da Task 9: a sequência de follow-up e o botão "Agora".
export interface FollowupDaSalaProps {
  steps: FollowupStep[];
  onAgora: () => void | Promise<void>;
}

export default function FollowupDaSala(_props: FollowupDaSalaProps) {
  return <section aria-label="Follow-up" data-testid="followup-da-sala" />;
}
