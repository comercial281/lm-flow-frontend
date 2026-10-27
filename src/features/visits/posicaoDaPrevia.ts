// Onde o cartão da prévia do lead abre, ao lado da peça da visita (prévia
// aprovada em 27/10/2026: 10 px de vão, 8 px de margem da tela).
const VAO = 10;
export const MARGEM = 8;

/** À direita da peça; sem espaço, à esquerda. Nunca sai da tela. */
export function posicaoDaPrevia(
  peca: { left: number; right: number; top: number },
  tela: { largura: number; altura: number },
  cartao: { largura: number; altura: number },
): { left: number; top: number } {
  let left = peca.right + VAO;
  if (left + cartao.largura > tela.largura - MARGEM) left = peca.left - cartao.largura - VAO;
  if (left < MARGEM) left = Math.min(Math.max(MARGEM, peca.left), tela.largura - cartao.largura - MARGEM);
  left = Math.max(MARGEM, left);
  const top = Math.max(MARGEM, Math.min(peca.top - 6, tela.altura - cartao.altura - MARGEM));
  return { left, top };
}
