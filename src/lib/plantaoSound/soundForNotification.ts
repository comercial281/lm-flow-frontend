// Qual som o sininho (conexão ao vivo) toca para cada aviso (Som do Plantão,
// 11/11/2026):
// - 'lead': "Lead virou seu" toca o Chegou, obrigatório (não passa pela chave
//   "Alertas de áudio" do Perfil). O anti-duplo do leadAlert evita somar com o
//   mesmo aviso chegando pelo push.
// - 'skip': a oferta da roleta; quem toca é o pop-up, que repete até responder.
// - 'legacy': todo o resto segue a chave "Alertas de áudio", como sempre.
export type NotificationSound = 'lead' | 'skip' | 'legacy';

interface NotificationLike {
  notification_type?: string;
  meta?: { event?: string } | null;
}

export function soundForNotification(data: NotificationLike): NotificationSound {
  const event = data.meta?.event;
  if (event === 'roleta.oferta_recebida') return 'skip';
  if (event === 'lead.atribuido') return 'lead';
  // Aviso antigo, criado fora do catálogo, ainda chega sem `meta.event`.
  if (!event && data.notification_type === 'lead_assigned') return 'lead';
  return 'legacy';
}
