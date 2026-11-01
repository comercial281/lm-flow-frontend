/**
 * A condição que a campanha ou o anúncio tem (Tarefa 77, 01/11/2026). Só apresentação: quem decide o que a IA
 * fala é o servidor (campanha, depois cadastro do imóvel, depois documento). Aqui a tela mostra de onde cada
 * número vem e converte o que a pessoa digitou. "Preencher com o texto do anúncio" é do servidor
 * (`campanhasService.condicaoDoTexto`); nada de ler texto de anúncio na tela.
 */
import type { CondicaoDaOferta } from '@/services/campanhas/campanhasService';

export type CampoDaCondicao = 'down_payment_from' | 'installment_from' | 'min_income' | 'payment_terms';
export type DeOndeVem = 'do anúncio' | 'do imóvel' | 'o corretor simula';

export const TETO_DA_OBSERVACAO = 300;

export const CAMPOS_DA_CONDICAO: { campo: CampoDaCondicao; rotulo: string; dinheiro: boolean }[] = [
  { campo: 'down_payment_from', rotulo: 'Entrada a partir de', dinheiro: true },
  { campo: 'installment_from', rotulo: 'Parcela a partir de', dinheiro: true },
  { campo: 'min_income', rotulo: 'Renda mínima', dinheiro: true },
  { campo: 'payment_terms', rotulo: 'Fluxo de pagamento', dinheiro: false },
];

type Parcial = Partial<CondicaoDaOferta> | null | undefined;

export const dinheiro = (n: number) => `R$ ${Number(n).toLocaleString('pt-BR')}`;

const preenchido = (v: unknown) => (typeof v === 'string' ? v.trim() !== '' : v != null);

export interface LinhaDeCondicao { campo: CampoDaCondicao; rotulo: string; valor: string; de: DeOndeVem }

/** A linha vence o imóvel; vazio vem do imóvel; vazio nos dois é "não informado". */
export function condicaoDaLinha(linha: { offer_condition?: Parcial }, imovel: Parcial): LinhaDeCondicao[] {
  return CAMPOS_DA_CONDICAO.map(({ campo, rotulo, dinheiro: eDinheiro }) => {
    const mostra = (v: unknown) => (eDinheiro ? dinheiro(Number(v)) : String(v));
    const daLinha = linha.offer_condition?.[campo];
    if (preenchido(daLinha)) return { campo, rotulo, valor: mostra(daLinha), de: 'do anúncio' as const };
    const doImovel = imovel?.[campo];
    if (preenchido(doImovel)) return { campo, rotulo, valor: mostra(doImovel), de: 'do imóvel' as const };
    return { campo, rotulo, valor: 'não informado', de: 'o corretor simula' as const };
  });
}

/** Os selos da coluna "Condição do anúncio": só o que a linha preencheu, ou "A do imóvel". */
export function resumoDaCondicao(c: Parcial): string[] {
  const selos: string[] = [];
  if (preenchido(c?.down_payment_from)) selos.push(`Entrada ${dinheiro(c!.down_payment_from!)}`);
  if (preenchido(c?.installment_from)) selos.push(`Parcela ${dinheiro(c!.installment_from!)}`);
  if (preenchido(c?.min_income)) selos.push(`Renda ${dinheiro(c!.min_income!)}`);
  if (preenchido(c?.payment_terms)) selos.push('Fluxo próprio');
  if (preenchido(c?.note)) selos.push('Observação');
  return selos.length ? selos : ['A do imóvel'];
}

/** Os campos da janela (tudo texto, como a pessoa digita). */
export interface CondicaoEmEdicao {
  down_payment_from: string;
  installment_from: string;
  min_income: string;
  payment_terms: string;
  note: string;
}

export const vazioDaCondicao = (): CondicaoEmEdicao => ({
  down_payment_from: '', installment_from: '', min_income: '', payment_terms: '', note: '',
});

const textoDe = (v: unknown) => (v == null ? '' : String(v));

export function condicaoEmEdicao(c: Parcial): CondicaoEmEdicao {
  return {
    down_payment_from: textoDe(c?.down_payment_from), installment_from: textoDe(c?.installment_from),
    min_income: textoDe(c?.min_income), payment_terms: textoDe(c?.payment_terms), note: textoDe(c?.note),
  };
}

/** "R$ 1.500" ou "1500,50" -> número; vazio ou sem dígito -> nulo. */
export function numeroDoCampo(texto: string): number | null {
  const limpo = texto.replace(/R\$/gi, '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  if (!/\d/.test(limpo)) return null;
  const n = Number(limpo.replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** O que vai pro servidor. Tudo vazio = nulo (a campanha não tem condição própria). */
export function condicaoParaGravar(c: CondicaoEmEdicao): CondicaoDaOferta | null {
  const out: CondicaoDaOferta = {
    down_payment_from: numeroDoCampo(c.down_payment_from),
    installment_from: numeroDoCampo(c.installment_from),
    min_income: numeroDoCampo(c.min_income),
    payment_terms: c.payment_terms.trim() || null,
    note: c.note.trim().slice(0, TETO_DA_OBSERVACAO) || null,
  };
  return Object.values(out).every((v) => v == null) ? null : out;
}
