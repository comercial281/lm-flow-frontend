// Faixas prontas do campo "Faixa de preço" da busca do site público. Uma faixa
// vira `price_min`/`price_max` na URL (ponta aberta fica de fora); a página de
// busca lê a URL de volta com `faixaDaBusca` para marcar a opção certa.
// Divisa: o filtro é inclusivo nas duas pontas (igual às vitrines), então as faixas
// são disjuntas por construção: o piso de cada faixa é o teto da anterior + 1 centavo.
// Um imóvel de R$ 200 mil está só em 'Até R$ 200 mil'.
import type { AbaId } from './homeConfig';
import { dinheiro } from '@/lib/formato';

export interface FaixaDePreco { valor: string; rotulo: string; price_min: number | null; price_max: number | null }

const centavo = (teto: number) => (teto * 100 + 1) / 100;
const faixa = (rotulo: string, min: number | null, max: number | null): FaixaDePreco =>
  ({ valor: `${min ?? ''}-${max ?? ''}`, rotulo, price_min: min, price_max: max });

const COMPRA: FaixaDePreco[] = [
  faixa('Até R$ 200 mil', null, 200_000),
  faixa('R$ 200 mil a R$ 400 mil', centavo(200_000), 400_000),
  faixa('R$ 400 mil a R$ 700 mil', centavo(400_000), 700_000),
  faixa('R$ 700 mil a R$ 1 mi', centavo(700_000), 1_000_000),
  faixa('R$ 1 mi a R$ 2 mi', centavo(1_000_000), 2_000_000),
  faixa('Acima de R$ 2 mi', centavo(2_000_000), null),
];

const ALUGUEL: FaixaDePreco[] = [
  faixa('Até R$ 1.500', null, 1_500),
  faixa('R$ 1.500 a R$ 3.000', centavo(1_500), 3_000),
  faixa('R$ 3.000 a R$ 5.000', centavo(3_000), 5_000),
  faixa('Acima de R$ 5.000', centavo(5_000), null),
];

/** Aluguel tem faixas próprias; Comprar e Lançamentos usam as de compra. */
export function faixasDePreco(tab: AbaId): FaixaDePreco[] {
  return tab === 'rent' ? ALUGUEL : COMPRA;
}

/** Parâmetros de URL da faixa escolhida; valor desconhecido → nenhum. */
export function precoDaFaixa(tab: AbaId, valor: string): { price_min?: string; price_max?: string } {
  const f = faixasDePreco(tab).find(x => x.valor === valor);
  if (!f) return {};
  return {
    ...(f.price_min != null ? { price_min: String(f.price_min) } : {}),
    ...(f.price_max != null ? { price_max: String(f.price_max) } : {}),
  };
}

/** A faixa que a URL descreve ('' quando o preço não bate com nenhuma faixa pronta). */
export function faixaDaBusca(tab: AbaId, min?: string | null, max?: string | null): string {
  if (!min && !max) return '';
  return faixasDePreco(tab).find(f => String(f.price_min ?? '') === (min ?? '') && String(f.price_max ?? '') === (max ?? ''))?.valor ?? '';
}

const numeroDaUrl = (v?: string | null) => (v && !Number.isNaN(Number(v)) ? Number(v) : null);
const reais = (n: number) => dinheiro(n, { centavos: false });

/**
 * Opções do campo "Faixa de preço" e a marcada. Preço da URL que não é faixa
 * pronta (vitrine, atalho, link colado) ganha uma opção própria com o valor
 * ("Até R$ 350.000"), senão o campo mostraria "Faixa de preço" com o filtro ativo.
 */
export function opcoesDePreco(tab: AbaId, min?: string | null, max?: string | null): { valor: string; opcoes: [string, string][] } {
  const opcoes = faixasDePreco(tab).map((f): [string, string] => [f.valor, f.rotulo]);
  const pronta = faixaDaBusca(tab, min, max);
  const pMin = numeroDaUrl(min), pMax = numeroDaUrl(max);
  if (pronta || (pMin == null && pMax == null)) return { valor: pronta, opcoes };
  const rotulo = pMin != null && pMax != null ? `${reais(pMin)} a ${reais(pMax)}`
    : pMax != null ? `Até ${reais(pMax)}` : `A partir de ${reais(pMin!)}`;
  const valor = `${pMin ?? ''}-${pMax ?? ''}`;
  // "200000.0" é a faixa pronta de 200 mil escrita de outro jeito: marca a pronta.
  if (opcoes.some(([v]) => v === valor)) return { valor, opcoes };
  return { valor, opcoes: [...opcoes, [valor, rotulo]] };
}
