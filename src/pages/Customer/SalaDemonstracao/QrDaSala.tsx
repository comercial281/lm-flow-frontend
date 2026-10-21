// QR da Sala: o lead aponta a câmera e abre a conversa com a IA no WhatsApp.
// Tela compartilhada no Meet: QR grande, pouco texto.
import { QRCodeSVG } from 'qrcode.react';
import type { DemoSession } from '@/types/demoRoom';

export interface QrDaSalaProps {
  session: DemoSession;
  /** Número do chip da Sala (config.wa_number), só dígitos. */
  waNumber: string | null;
}

/** 5511900000000 vira +55 11 90000-0000. Formato desconhecido volta como veio. */
export function numeroParaLeitura(raw: string | null): string | null {
  if (!raw) return null;
  const d = raw.replace(/\D/g, '');
  const m = /^55(\d{2})(\d{4,5})(\d{4})$/.exec(d);
  return m ? `+55 ${m[1]} ${m[2]}-${m[3]}` : raw;
}

export default function QrDaSala({ session, waNumber }: QrDaSalaProps) {
  const numero = numeroParaLeitura(waNumber);
  return (
    <section aria-label="QR da Sala" data-testid="qr-da-sala" className="flex flex-col items-center gap-5 py-6 text-center">
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <QRCodeSVG
          value={session.wa_link}
          size={320}
          level="M"
          aria-label="QR code para conversar com a IA"
        />
      </div>
      {numero && <p className="text-3xl font-semibold tracking-wide text-foreground">{numero}</p>}
      <p className="text-xl text-muted-foreground">
        {`Aguardando ${session.lead_name} mandar a primeira mensagem…`}
      </p>
      <p className="text-sm text-muted-foreground">
        Código da sessão <span className="font-mono text-base font-semibold text-foreground">{session.code}</span>
      </p>
    </section>
  );
}
