// ── IMÓVEIS: EMPREENDIMENTO OU REVENDA (Fase 4, 02/10/2026) ─────────────────
// Regras puras da lista nova de Imóveis: aba, fase, situação por tipo,
// tipologias e filtros. A tela só desenha; nada de regra no JSX.
// Spec: LM FLOW/specs/2026-10-02-fase-4-imoveis-empreendimento-revenda-design.md
import { dinheiro, numero, plural } from '@/lib/formato';
import type { PropertyTypology } from './typologies';

export type ListingKind = 'development' | 'resale';
export type Stage = 'pre_launch' | 'launch' | 'in_construction' | 'ready';
export type Tom = 'ok' | 'alerta' | 'neutro' | 'info' | 'marca';

/** Servidor antigo não manda o campo: tudo cai em Revenda, sem tela em branco. */
export function tipoDoImovel(p: { listing_kind?: string | null }): ListingKind {
  return p.listing_kind === 'development' ? 'development' : 'resale';
}

export const ABA_NA_URL: Record<ListingKind, string> = { development: 'empreendimentos', resale: 'revenda' };

export function lerAba(sp: URLSearchParams): ListingKind | null {
  const v = sp.get('aba');
  if (v === ABA_NA_URL.development) return 'development';
  if (v === ABA_NA_URL.resale) return 'resale';
  return null;
}

/**
 * Link da lista já na aba certa e com a busca preenchida (busca global, Ctrl+K).
 * Sem a aba, a tela abriria na aba com mais cadastros e buscaria só nela.
 */
export function linkNaLista(p: { listing_kind?: string | null; code?: string | null; title?: string | null }): string {
  return `/properties?aba=${ABA_NA_URL[tipoDoImovel(p)]}&q=${encodeURIComponent(p.code || p.title || '')}`;
}

/** Abre na aba com mais cadastros; empate abre Empreendimentos. */
export function abaPadrao(c: { development: number; resale: number }): ListingKind {
  return c.resale > c.development ? 'resale' : 'development';
}

export const FASES: { valor: Stage; rotulo: string }[] = [
  { valor: 'pre_launch', rotulo: 'Pré-lançamento' },
  { valor: 'launch', rotulo: 'Na planta' },
  { valor: 'in_construction', rotulo: 'Em obra' },
  { valor: 'ready', rotulo: 'Pronto para morar' },
];

export function rotuloDaFase(stage: string): string {
  return FASES.find(f => f.valor === stage)?.rotulo ?? 'Pronto para morar';
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** '2027-12-01' → 'dez/2027'. Lê o texto, sem fuso: é mês de calendário. */
export function mesAno(iso?: string | null): string | null {
  const m = /^(\d{4})-(\d{2})/.exec(iso ?? '');
  if (!m) return null;
  const mes = Number(m[2]);
  return mes >= 1 && mes <= 12 ? `${MESES[mes - 1]}/${m[1]}` : null;
}

/** Valor guardado no formulário (mês e ano da previsão): '2027-12-01' → '2027-12'. */
export function paraCampoMes(iso?: string | null): string {
  const m = /^(\d{4}-\d{2})/.exec(iso ?? '');
  return m ? m[1] : '';
}

export const MESES_DO_ANO = MESES.map((rotulo, i) => ({ valor: String(i + 1).padStart(2, '0'), rotulo }));

/** '2027-12' → { ano: '2027', mes: '12' }; vazio ou inválido → os dois vazios. */
export function separarMesAno(v?: string | null): { ano: string; mes: string } {
  const m = /^(\d{4})-(\d{2})/.exec(v ?? '');
  return m ? { ano: m[1], mes: m[2] } : { ano: '', mes: '' };
}

/** Mês e ano escolhidos → 'AAAA-MM'. Falta um dos dois → '' (sem previsão). */
export function juntarMesAno(ano: string, mes: string): string {
  return ano && mes ? `${ano}-${mes}` : '';
}

/** Anos da previsão: do ano passado até 8 à frente (e o já salvo, se estiver fora). */
export function anosDaPrevisao(hoje: number, salvo?: string): string[] {
  const anos = Array.from({ length: 10 }, (_, i) => String(hoje - 1 + i));
  return salvo && !anos.includes(salvo) ? [...anos, salvo].sort() : anos;
}

export function seloDaFase(stage: string, entrega?: string | null): string {
  const fase = rotuloDaFase(stage);
  const quando = stage !== 'ready' ? mesAno(entrega) : null;
  return quando ? `${fase} · entrega ${quando}` : fase;
}

export const SITUACOES: Record<ListingKind, { valor: string; rotulo: string; tom: Tom }[]> = {
  resale: [
    { valor: 'active', rotulo: 'Disponível', tom: 'ok' },
    { valor: 'reserved', rotulo: 'Reservado', tom: 'alerta' },
    { valor: 'sold', rotulo: 'Vendido', tom: 'neutro' },
    { valor: 'rented', rotulo: 'Alugado', tom: 'neutro' },
    { valor: 'inactive', rotulo: 'Inativo', tom: 'neutro' },
    { valor: 'draft', rotulo: 'Rascunho', tom: 'neutro' },
  ],
  development: [
    { valor: 'active', rotulo: 'À venda', tom: 'ok' },
    { valor: 'sold', rotulo: 'Esgotado', tom: 'neutro' },
    { valor: 'inactive', rotulo: 'Inativo', tom: 'neutro' },
    { valor: 'draft', rotulo: 'Rascunho', tom: 'neutro' },
  ],
};

export function rotuloDaSituacao(kind: ListingKind, status: string): string {
  return SITUACOES[kind].find(s => s.valor === status)?.rotulo
    ?? SITUACOES.resale.find(s => s.valor === status)?.rotulo
    ?? status;
}

export function tomDaSituacao(kind: ListingKind, status: string): Tom {
  return SITUACOES[kind].find(s => s.valor === status)?.tom ?? 'neutro';
}

function faixa(valores: number[], unidade: (n: number) => string): string | null {
  if (!valores.length) return null;
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  return min === max ? unidade(min) : `${unidade(min).replace(/ .*/, '')} a ${unidade(max)}`;
}

export function linhaDasTipologias(list?: PropertyTypology[] | null): string | null {
  const t = list ?? [];
  if (!t.length) return null;
  const partes = [plural(t.length, 'tipologia', 'tipologias')];
  const dorms = faixa(t.map(x => Number(x.bedrooms)).filter(n => n > 0), n => (n === 1 ? '1 dorm' : `${n} dorms`));
  const areas = faixa(t.map(x => Number(x.useful_area_m2)).filter(n => n > 0), n => `${numero(n, 2)} m²`);
  if (dorms) partes.push(dorms);
  if (areas) partes.push(areas);
  return partes.join(' · ');
}

export function textoDasUnidades(total?: number | null, status?: string): string | null {
  if (status === 'sold') return 'Esgotado';
  if (total == null) return null;
  return total === 1 ? '1 unidade disponível' : `${total} unidades disponíveis`;
}

// ── Filtros ─────────────────────────────────────────────────────────────────
export interface FiltrosRevenda {
  finalidade: '' | 'venda' | 'locacao';
  tipo: string;
  bairro: string;
  situacao: string;
  precoMin: string;
  precoMax: string;
  quartos: number[];
  vagas: number[];
  captador: string;
}

export interface FiltrosEmpreendimento {
  fases: string[];
  bairro: string;
  situacao: string;
  precoMin: string;
  precoMax: string;
  quartos: number[];
  entregaAte: string;
}

export type Filtros = FiltrosRevenda | FiltrosEmpreendimento;

export const FILTROS_VAZIOS: { development: FiltrosEmpreendimento; resale: FiltrosRevenda } = {
  development: { fases: [], bairro: '', situacao: '', precoMin: '', precoMax: '', quartos: [], entregaAte: '' },
  resale: { finalidade: '', tipo: '', bairro: '', situacao: '', precoMin: '', precoMax: '', quartos: [], vagas: [], captador: '' },
};

export function paramsDosFiltros(kind: ListingKind, f: Filtros): Record<string, string | string[]> {
  const p: Record<string, string | string[]> = {};
  const comum = f as FiltrosEmpreendimento & FiltrosRevenda;
  if (comum.bairro) p.neighborhood = comum.bairro;
  if (comum.situacao) p.status = comum.situacao;
  if (comum.precoMin) p.min_price = comum.precoMin;
  if (comum.precoMax) p.max_price = comum.precoMax;
  if (comum.quartos?.length) p['bedrooms[]'] = comum.quartos.map(String);
  if (kind === 'development') {
    const e = f as FiltrosEmpreendimento;
    if (e.fases.length) p['stage[]'] = e.fases;
    if (e.entregaAte) p.delivery_until = e.entregaAte;
  } else {
    const r = f as FiltrosRevenda;
    // Imóvel de Venda e locação aparece nos dois filtros, como no site.
    if (r.finalidade === 'venda') p['transaction_type[]'] = ['sale', 'sale_rent'];
    if (r.finalidade === 'locacao') p['transaction_type[]'] = ['rent', 'sale_rent', 'season'];
    if (r.tipo) p.property_type = r.tipo;
    if (r.vagas.length) p['parking[]'] = r.vagas.map(String);
    if (r.captador) p.captor_id = r.captador;
  }
  return p;
}

const quartosTexto = (l: number[]) => l.map(n => (n >= 4 ? '4+' : String(n))).join(', ');

export function filtrosAtivos(
  kind: ListingKind,
  f: Filtros,
  rotuloTipo: (v: string) => string = v => v,
  rotuloCaptador: (id: string) => string = id => id,
): { chave: string; rotulo: string }[] {
  const out: { chave: string; rotulo: string }[] = [];
  const preco = (min: string, max: string) =>
    min && max ? `${dinheiro(Number(min), { centavos: false })} a ${dinheiro(Number(max), { centavos: false })}`
      : min ? `a partir de ${dinheiro(Number(min), { centavos: false })}` : `até ${dinheiro(Number(max), { centavos: false })}`;
  if (kind === 'development') {
    const e = f as FiltrosEmpreendimento;
    if (e.fases.length) out.push({ chave: 'fases', rotulo: `Fase: ${e.fases.map(rotuloDaFase).join(', ')}` });
    if (e.bairro) out.push({ chave: 'bairro', rotulo: `Bairro: ${e.bairro}` });
    if (e.situacao) out.push({ chave: 'situacao', rotulo: `Situação: ${rotuloDaSituacao('development', e.situacao)}` });
    if (e.precoMin || e.precoMax) out.push({ chave: 'preco', rotulo: `Preço: ${preco(e.precoMin, e.precoMax)}` });
    if (e.quartos.length) out.push({ chave: 'quartos', rotulo: `Dorms: ${quartosTexto(e.quartos)}` });
    if (e.entregaAte) out.push({ chave: 'entregaAte', rotulo: `Entrega até ${e.entregaAte}` });
    return out;
  }
  const r = f as FiltrosRevenda;
  if (r.finalidade) out.push({ chave: 'finalidade', rotulo: r.finalidade === 'venda' ? 'Venda' : 'Locação' });
  if (r.tipo) out.push({ chave: 'tipo', rotulo: `Tipo: ${rotuloTipo(r.tipo)}` });
  if (r.bairro) out.push({ chave: 'bairro', rotulo: `Bairro: ${r.bairro}` });
  if (r.situacao) out.push({ chave: 'situacao', rotulo: `Situação: ${rotuloDaSituacao('resale', r.situacao)}` });
  if (r.precoMin || r.precoMax) out.push({ chave: 'preco', rotulo: `Preço: ${preco(r.precoMin, r.precoMax)}` });
  if (r.quartos.length) out.push({ chave: 'quartos', rotulo: `Dorms: ${quartosTexto(r.quartos)}` });
  if (r.vagas.length) out.push({ chave: 'vagas', rotulo: `Vagas: ${quartosTexto(r.vagas)}` });
  if (r.captador) out.push({ chave: 'captador', rotulo: `Captador: ${rotuloCaptador(r.captador)}` });
  return out;
}

export function tirarFiltro(kind: ListingKind, f: Filtros, chave: string): Filtros {
  const vazio = FILTROS_VAZIOS[kind] as unknown as Record<string, unknown>;
  if (chave === 'preco') return { ...f, precoMin: '', precoMax: '' } as Filtros;
  return { ...f, [chave]: vazio[chave] } as Filtros;
}
