// Listas de escolha do passo a passo. Mesmos valores que o servidor aceita.
export const MODELOS: [string, string][] = [
  ['claude-sonnet-4-5-20250929', 'Equilibrada (Sonnet, padrão)'],
  ['claude-haiku-4-5-20251001', 'Mais rápida e barata (Haiku)'],
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
