// O que os BotoesDeEscolha e os CartoesDeEscolha dividem: o formato da opção e a
// navegação por setas. Mora fora dos componentes pro Fast Refresh (arquivo de
// componente só exporta componente).

export interface OpcaoDeEscolha<T extends string> {
  valor: T;
  rotulo: string;
  descricao?: string;
  desabilitada?: boolean;
  /** Por que está desabilitada (vai no `title` e, nos cartões, no lugar da frase). */
  motivo?: string;
}

/** A próxima opção habilitada na direção `passo`, dando a volta. */
export function proximaHabilitada<T extends string>(opcoes: OpcaoDeEscolha<T>[], de: number, passo: 1 | -1): number {
  for (let i = 1; i <= opcoes.length; i += 1) {
    const j = (de + passo * i + opcoes.length) % opcoes.length;
    if (!opcoes[j].desabilitada) return j;
  }
  return de;
}
