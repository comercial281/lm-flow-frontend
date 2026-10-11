// ── GRÁFICO (o desenho do Painel, nas cores do tema) ────────────────────────
//
// Escolha do dono em 10/10/2026 (GLOSSARIO.md → As peças da casa, 21): todo
// gráfico (recharts) segue o desenho do Painel. Sem grade; barras na cor do
// tema com cantos de 4 px no topo; eixo com texto cinza de 11 px, sem linha;
// dica com borda e cantos de 10 px.
//
// As cores saem de `--chart-1` a `--chart-5` (globals.css), que mudam sozinhas
// no tema escuro. Nunca hex fixo (`#3b82f6`, `#059669`…): a trava
// `corFixaEmGrafico` do conferir-padrao reprova.
//
// O Painel (DashboardNova) fica com as variáveis `--lmf-*` dele (padrão próprio).
//
// Uso:
//   <XAxis dataKey="dia" {...EIXO_DO_GRAFICO} />
//   <YAxis {...EIXO_DO_GRAFICO} allowDecimals={false} width={32} />
//   <Tooltip {...DICA_DO_GRAFICO} />            (ou content={…} com CLASSE_DA_DICA)
//   <Bar dataKey="leads" fill={CORES_DO_GRAFICO[0]} radius={CANTOS_DA_BARRA} />
import type { CSSProperties } from 'react';

/** Uma cor por série, na ordem. */
export const CORES_DO_GRAFICO = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
] as const;

/** Cinza do texto dos eixos e da linha do cursor. */
export const COR_DO_EIXO = 'var(--muted-foreground)';

/** Eixo: texto cinza de 11 px, sem linha e sem tracinho. */
export const EIXO_DO_GRAFICO = {
  tick: { fill: COR_DO_EIXO, fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;

/** Barra com cantos de 4 px no topo. */
export const CANTOS_DA_BARRA: [number, number, number, number] = [4, 4, 0, 0];

const caixaDaDica: CSSProperties = {
  background: 'var(--popover)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  fontSize: 12,
  color: 'var(--popover-foreground)',
};

/** Dica padrão do recharts (`<Tooltip {...DICA_DO_GRAFICO} />`). */
export const DICA_DO_GRAFICO = {
  contentStyle: caixaDaDica,
  labelStyle: { color: 'var(--muted-foreground)', marginBottom: 4 },
  itemStyle: { color: 'var(--popover-foreground)' },
} as const;

/** A mesma dica, pra quem monta o conteúdo (`<Tooltip content={…} />`). */
export const CLASSE_DA_DICA = 'rounded-[10px] border border-border bg-popover px-3 py-2 text-xs text-popover-foreground';
