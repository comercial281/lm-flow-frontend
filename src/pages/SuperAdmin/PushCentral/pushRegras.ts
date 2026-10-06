// src/pages/SuperAdmin/PushCentral/pushRegras.ts
import type { PedidoDeConfirmacao } from '@/hooks/useConfirmacao';
import { plural } from '@/lib/formato';
import type { AudienceCount, PushAudience, PushLog } from '@/services/push/pushCentralService';

// Status do histórico só com cores do tema (nada de verde/âmbar/vermelho fixo).
export const STATUS_CLASS: Record<PushLog['status'], string> = {
  sent: 'border-primary/30 bg-primary/10 text-primary',
  partial: 'border-border bg-muted text-foreground',
  failed: 'border-destructive/30 bg-destructive/10 text-destructive',
  no_subscription: 'border-border bg-muted text-muted-foreground',
};

// Para quem vai, em português de gente. "Para mim" do servidor é TODO aparelho
// da Leal Mídia (o public): com mais de uma pessoa, dizer "você" seria mentir.
function quem(publico: PushAudience, conta: AudienceCount, cliente: string): string {
  const aparelhos = plural(conta.devices, 'aparelho', 'aparelhos');
  if (publico === 'admin') {
    return conta.people <= 1
      ? `você (${aparelhos})`
      : `${plural(conta.people, 'pessoa', 'pessoas')} da Leal Mídia (${aparelhos})`;
  }
  return `${plural(conta.people, 'pessoa', 'pessoas')} (${aparelhos}) de ${cliente}`;
}

export function textoDoPublico(publico: PushAudience, conta: AudienceCount, cliente: string): string {
  return `Vai para ${quem(publico, conta, cliente)}.`;
}

export function pedidoDeDisparo(publico: PushAudience, conta: AudienceCount, cliente: string): PedidoDeConfirmacao {
  return {
    titulo: `Enviar para ${quem(publico, conta, cliente)}?`,
    descricao: 'O push sai na hora e não dá para desfazer.',
    rotuloDaAcao: 'Enviar',
  };
}
