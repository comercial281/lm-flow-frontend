// Listas de escolha do passo a passo. Mesmos valores que o servidor aceita.
// Desde 03/11/2026 toda IA roda no Haiku 5.5 (o padrão); o Sonnet 5.5 fica de reserva pra IA que escorregar.
export const MODELOS: [string, string][] = [
  ['claude-haiku-5-5', 'Econômica (Haiku 5.5, padrão)'],
  ['claude-sonnet-5-5', 'Mais forte (Sonnet 5.5)'],
];

/** Os momentos da conversa que a IA aponta (SalesAgent::PIPELINE_MOVE_STAGES). */
export const MOMENTOS_DO_FUNIL: [string, string][] = [
  ['descobrindo', 'Descobrindo o que o lead quer'],
  ['qualificando', 'Qualificando'],
  ['pronto_para_visita', 'Pronto para visita'],
  ['agendando', 'Combinando dia e hora'],
  ['agendado', 'Visita agendada'],
  ['transferir', 'Passou pro corretor'],
];

export const REACOES_POSSIVEIS = ['👍', '❤️', '😂', '🙏', '🔥', '👏', '😍', '✅', '🎉', '😉'];
