// src/features/cardDoLead/pagina/formaDaSeta.ts
// Recorte das setas encaixadas da faixa de etapas (10/10).

/** Profundidade da ponta da seta (e do encaixe na seguinte), em px. */
const PONTA = 12;

/**
 * Recorte da seta: ponta à direita e encaixe à esquerda. A primeira não tem
 * encaixe e a última não tem ponta (as duas ficam retas na borda da faixa).
 */
export function formaDaSeta(indice: number, total: number): string {
  const primeira = indice === 0;
  const ultima = indice === total - 1;
  const direita = ultima
    ? ['100% 0', '100% 100%']
    : [`calc(100% - ${PONTA}px) 0`, '100% 50%', `calc(100% - ${PONTA}px) 100%`];
  const esquerda = primeira ? [] : [`${PONTA}px 50%`];
  return `polygon(${['0 0', ...direita, '0 100%', ...esquerda].join(', ')})`;
}
