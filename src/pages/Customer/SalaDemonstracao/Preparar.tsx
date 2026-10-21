import type { DemoRoomState } from '@/types/demoRoom';

// Placeholder da Task 8: preparar a Sala (conferência, configuração e nome do lead).
export interface PrepararProps {
  state: DemoRoomState;
  onStart: (leadName: string) => void | Promise<void>;
}

export default function Preparar(_props: PrepararProps) {
  return <section aria-label="Preparar a demonstração" data-testid="preparar" />;
}
