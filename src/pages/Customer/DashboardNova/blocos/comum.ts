// src/pages/Customer/DashboardNova/blocos/comum.ts
/** "2026-09-24T00:00:00-03:00" → "2026-09-24": o dia do período no fuso do servidor. */
export const diaDoPeriodo = (iso?: string | null): string | undefined =>
  iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10) : undefined;

/**
 * Tempo de negociação ou parado na etapa, do jeito que se fala: "18 dias",
 * "5 h", "menos de 1 h". Dias arredondados (ninguém lê "17,6 dias").
 */
export const tempoEmDias = (segundos: number): string => {
  const s = Math.max(0, segundos);
  if (s < 3600) return 'menos de 1 h';
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  const dias = Math.round(s / 86400);
  return `${dias} ${dias === 1 ? 'dia' : 'dias'}`;
};
