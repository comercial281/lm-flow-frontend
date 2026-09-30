// Textos do bloco "Esgotaram a roleta" (aba Atribuições Recentes).

/**
 * "Passou por 10 corretores: Ana, Bruno, Carla e mais 7".
 *
 * A lista inteira não cabe na linha: uma roleta de dez corretores vira um
 * parágrafo por lead. O total é o que importa ao gestor ("rodou todo mundo"); os
 * nomes completos vão no `title` da linha.
 */
export function passouPorTexto(nomes: string[], visiveis = 3): string {
  const total = nomes.length;
  if (total === 0) return '';

  const rotulo = total === 1 ? '1 corretor' : `${total} corretores`;
  const mostrados = nomes.slice(0, visiveis).join(', ');
  const resto = total - visiveis;
  return `Passou por ${rotulo}: ${mostrados}${resto > 0 ? ` e mais ${resto}` : ''}`;
}

/** Resumo do "Sortear todos de novo", para um toast só em vez de N. */
export function resumoSorteioEmLote(sorteados: number, falharam: number): string {
  const ok = sorteados === 1 ? '1 lead sorteado de novo' : `${sorteados} leads sorteados de novo`;
  if (falharam === 0) return ok;
  const ruim = falharam === 1 ? '1 não saiu' : `${falharam} não saíram`;
  return `${ok}; ${ruim} (o motivo está na linha de cada um)`;
}
