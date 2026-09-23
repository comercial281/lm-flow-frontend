// Modo Fila da roleta: a ordem da lista É a ordem de entrega
// (Corretor 1 → 2 → 3 → volta ao 1). Quem decide a vez é o servidor, lendo a
// posição de cada corretor; a tela só guarda a ordem — e a posição gravada é o
// índice no array de membros no Salvar. Por isso reordenar é mover no array.

/** Move o item `index` uma casa para cima (-1) ou para baixo (+1). Fora dos
 *  limites devolve a MESMA lista, para o botão desabilitado não virar re-render. */
export function moveMember<T>(list: T[], index: number, delta: -1 | 1): T[] {
  const alvo = index + delta;
  if (index < 0 || index >= list.length || alvo < 0 || alvo >= list.length) return list;
  const next = list.slice();
  [next[index], next[alvo]] = [next[alvo], next[index]];
  return next;
}

/** "1º", "2º"... — como a posição aparece na tela. */
export function queueOrdinal(index: number): string {
  return `${index + 1}º`;
}
