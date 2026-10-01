// src/pages/Customer/DashboardNova/blocos/comum.ts
/** "2026-09-24T00:00:00-03:00" → "2026-09-24": o dia do período no fuso do servidor. */
export const diaDoPeriodo = (iso?: string | null): string | undefined =>
  iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10) : undefined;
