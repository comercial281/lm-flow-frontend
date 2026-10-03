// BLOCO "MARCAR COMO RECUPERADO PELO FOLLOW-UP" (Automações · sprint 3, spec 03/10/2026).
//
// Faz o mesmo que o follow-up antigo fazia quando o lead respondia. O servidor
// executa pelo mesmo serviço do follow-up antigo; o bloco não tem config. Os
// cinco efeitos aparecem na janela do bloco, pra ninguém ter que adivinhar.

export const RECOVERED_LABEL = 'recuperado-pelo-follow-up';

export const RECOVERED_EFFECTS: string[] = [
  `Aplica a etiqueta "${RECOVERED_LABEL}".`,
  'Tira a etiqueta "follow-up".',
  'Registra no histórico do lead (entra nos números do relatório semanal).',
  'Avisa a equipe ("lead recuperado").',
  'Manda WhatsApp pro corretor responsável pelo lead.',
];

export const RECOVERED_SUMMARY = `Etiqueta "${RECOVERED_LABEL}", histórico e avisos pra equipe e pro corretor`;
