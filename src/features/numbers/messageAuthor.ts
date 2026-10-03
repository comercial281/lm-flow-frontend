// O nome ao lado do selo "Atendente" numa mensagem nossa (fase 2b.2, E41).
//
// - Autor gravado como o CONTATO (histórico antigo de mensagem automática):
//   sem nome — mensagem nossa nunca é assinada pelo lead.
// - Marca `automated` (IA, follow-up, automação, campanha): sem nome.
// - Marca `device_sent`: digitada no CELULAR de um número sem dono (regra do
//   dono ligada). Não se sabe quem digitou — "· pelo celular", nunca um nome
//   inventado (era o 1º admin do cliente).
// - Pessoa da equipe: o nome dela.

export const DEVICE_SENT_LABEL = '· pelo celular';

export interface MessageAuthorLike {
  sender?: { type?: string | null; name?: string | null } | null;
  content_attributes?: Record<string, unknown> | null;
}

export function agentDisplayNameFor(message: MessageAuthorLike): string {
  const tipo = String(message.sender?.type ?? '').toLowerCase();
  const attrs = message.content_attributes ?? {};
  if (tipo === 'contact' || attrs.automated) return '';
  if (attrs.device_sent) return DEVICE_SENT_LABEL;
  return message.sender?.name ?? '';
}

// Follow-up automático (02/10/2026): a bolha troca o selo "Atendente" pelo selo
// amarelo "Follow-up automático". Duas marcas, uma por caminho no servidor:
// - `followup_job_id`: follow-up de funil (Followup::SendStep), gravada desde 31/08;
// - `followup`: follow-up da IA Vendedora (SalesAgents::FollowupRunner).
export function isFollowupMessage(message: MessageAuthorLike): boolean {
  const attrs = message.content_attributes ?? {};
  return Boolean(attrs.followup_job_id || attrs.followup);
}

// Reengajamento da IA Vendedora (03/10/2026): a retomada da pergunta que ficou no
// ar, antes do follow-up (SalesAgents::ReengagementRunner, marca `reengagement`).
// Selo próprio "🤖 Reengajamento", azul, no lugar de "Atendente".
export function isReengagementMessage(message: MessageAuthorLike): boolean {
  const attrs = message.content_attributes ?? {};
  return Boolean(attrs.reengagement);
}
