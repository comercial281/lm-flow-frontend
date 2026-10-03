// Horas do reengajamento da IA: inteiras, de 1 a 48 (o servidor recusa fora disso).
// Zero, vazio ou inválido volta pro padrão — igual aos campos de dias do
// follow-up (`Number(...) || padrão`). 0h seria retomar no minuto da pergunta.
export const REENGAGEMENT_DEFAULT_FIRST_HOURS = 2;
export const REENGAGEMENT_DEFAULT_SECOND_HOURS = 8;

export function clampReengagementHours(value: unknown, fallback: number): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n === 0) return fallback;
  return Math.min(48, Math.max(1, n));
}
