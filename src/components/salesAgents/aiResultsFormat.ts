// Duas identidades, e só duas: roxo = o que a IA atendeu, verde = visita marcada.
// O par passa nas seis checagens de daltonismo e contraste NOS DOIS TEMAS (claro
// e escuro), então a tela não precisa trocar de cor junto com o tema — uma cor
// por entidade, sempre a mesma, é também o que faz o gráfico e o número lá em
// cima serem lidos como a mesma coisa.
export const COLOR_LEADS = '#7c3aed';
export const COLOR_VISITS = '#059669';

// ── Formatação ──────────────────────────────────────────────────────────────

export function int(value: number): string {
  return (value ?? 0).toLocaleString('pt-BR');
}

// "—" e não "0%": sem atendimento no período não existe taxa, e mostrar zero
// seria afirmar um fracasso que não aconteceu.
export function pct(value: number | null): string {
  if (value === null || value === undefined) return '—';
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}

export function latency(ms: number | null): string {
  if (!ms) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} s`;
}

// A data vem como "2026-08-14". `new Date("2026-08-14")` é lido como MEIA-NOITE
// EM UTC, que em Brasília é 21h do dia 13 — o eixo inteiro andaria um dia pra
// trás. Montar a data pelos pedaços resolve, e é o que mantém o gráfico alinhado
// com a série que o backend já agrupou no fuso de São Paulo.
//
// ⚠️ Nos eixos, chame como `(value) => dayLabel(value)`, nunca
// `tickFormatter={dayLabel}`: o Recharts passa `(valor, ÍNDICE)`, e o índice
// cairia no `long` — todo rótulo menos o do índice 0 sairia por extenso e o eixo
// viraria uma parede de texto.
export function dayLabel(iso: string, long = false): string {
  const [year, month, day] = String(iso).split('-').map(Number);
  if (!year || !month || !day) return String(iso);
  const date = new Date(year, month - 1, day);
  return long
    ? date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })
    : date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}
