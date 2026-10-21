import type { Backstage } from '@/types/demoRoom';

// Placeholder da Task 9: o que a IA está entendendo do lead.
export interface BastidoresProps {
  behind: Backstage | null;
}

export default function Bastidores(_props: BastidoresProps) {
  return <section aria-label="Bastidores" data-testid="bastidores" />;
}
