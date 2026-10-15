// src/pages/Customer/Pipelines/quadro/ondeOCardCai.ts
// Onde o card arrastado cai na coluna sob o cursor. A mesma conta desenha o
// esqueleto do destino e grava a posição ao soltar: o que a pessoa vê é o que
// acontece.
import type { PipelineItem } from '@/types/analytics';

export interface AlvoDoArraste {
  stageId: string;
  /** Índice na lista da coluna SEM o card arrastado. */
  indice: number;
}

interface Entrada {
  itens: PipelineItem[];
  arrastadoId: string;
  mesmaColuna: boolean;
  /** Concluído (soltar marca Ganho): o card vai sempre pro topo, como faz o ganhar. */
  colunaDeGanho: boolean;
  /** Card sob o cursor e a metade dele; sem isso o cursor está no espaço vazio da coluna. */
  sobre?: { id: string; metade: 'above' | 'below' };
}

/**
 * Índice onde o card cai, ou null quando soltar ali não muda nada (em cima dele
 * mesmo ou no lugar de onde saiu). Espaço vazio: outra coluna = topo (regra do
 * funil), mesma coluna = fundo.
 */
export function indiceDoArraste({ itens, arrastadoId, mesmaColuna, colunaDeGanho, sobre }: Entrada): number | null {
  const semArrastado = itens.filter(i => i.id !== arrastadoId);
  if (colunaDeGanho && !mesmaColuna) return 0;

  let indice: number;
  if (sobre) {
    if (sobre.id === arrastadoId) return null;
    const em = semArrastado.findIndex(i => i.id === sobre.id);
    if (em < 0) return null;
    indice = sobre.metade === 'above' ? em : em + 1;
  } else {
    if (mesmaColuna && semArrastado.length === 0) return null;
    indice = mesmaColuna ? semArrastado.length : 0;
  }

  if (mesmaColuna && indice === itens.findIndex(i => i.id === arrastadoId)) return null;
  return indice;
}
