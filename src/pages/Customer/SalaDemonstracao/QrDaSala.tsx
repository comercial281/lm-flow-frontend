import type { DemoSession } from '@/types/demoRoom';

// Placeholder da Task 8: QR e link de WhatsApp enquanto a sessão espera o lead.
export interface QrDaSalaProps {
  session: DemoSession;
}

export default function QrDaSala(_props: QrDaSalaProps) {
  return <section aria-label="QR da Sala" data-testid="qr-da-sala" />;
}
