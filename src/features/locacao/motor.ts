// Contas de data e de valor da Locação, portadas do protótipo. O servidor é quem
// decide o que vale (boleto, reajuste, acerto); aqui só entra o que a tela
// precisa calcular antes de salvar (prévia do 1º boleto) e para os chips.
// Datas são "AAAA-MM-DD" (dia de calendário), sempre em UTC para não escorregar.

import type { ItemDoAluguel, ModoDeCobranca } from './tipos';

export const R = (v: number): number => Math.round((v + Number.EPSILON) * 100) / 100;
export const pad = (n: number): string => String(n).padStart(2, '0');
const D = (s: string): Date => new Date(`${s}T00:00:00Z`);
const F = (d: Date): string => d.toISOString().slice(0, 10);

export function addDays(s: string, n: number): string {
  const d = D(s);
  d.setUTCDate(d.getUTCDate() + n);
  return F(d);
}
/** Quantos dias tem o mês (m de 1 a 12). */
export const dim = (y: number, m: number): number => new Date(Date.UTC(y, m, 0)).getUTCDate();

export function addMonths(s: string, n: number): string {
  const [y0, m0, dd] = s.split('-').map(Number);
  let y = y0;
  let m = m0 + n;
  y += Math.floor((m - 1) / 12);
  m = ((((m - 1) % 12) + 12) % 12) + 1;
  return `${y}-${pad(m)}-${pad(Math.min(dd, dim(y, m)))}`;
}
/** Dias de a até b (b depois de a = positivo). */
export const diff = (a: string, b: string): number => Math.round((D(b).getTime() - D(a).getTime()) / 864e5);
/** "2026-11-04" → "2026-11". */
export const mk = (s: string): string => s.slice(0, 7);
export const primeiroDia = (mes: string): string => `${mes}-01`;
export const ultimoDia = (mes: string): string => `${mes}-${pad(dim(+mes.slice(0, 4), +mes.slice(5, 7)))}`;

export const fimContrato = (inicio: string, meses: number): string => addDays(addMonths(inicio, meses), -1);
export const proximoAniversario = (ultimoReajuste: string | null | undefined, inicio: string): string =>
  addMonths(ultimoReajuste || inicio, 12);

/** Aluguel que valia em `dia`: o último reajuste com `desde` até aquele dia. */
export function aluguelEm(historico: Pick<ItemDoAluguel, 'desde' | 'valor'>[], dia: string): number {
  let v = historico[0]?.valor ?? 0;
  for (const h of historico) if (h.desde <= dia) v = h.valor;
  return v;
}

/** Aluguel dos dias de ini a fim, dia a dia (cada dia vale aluguel ÷ dias do mês). */
export function prorataAluguel(historico: Pick<ItemDoAluguel, 'desde' | 'valor'>[], ini: string, fim: string): number {
  let s = 0;
  let d = ini;
  while (d <= fim) {
    const [y, m] = d.split('-').map(Number);
    s += aluguelEm(historico, d) / dim(y, m);
    d = addDays(d, 1);
  }
  return R(s);
}

/** Quanto de um mês cheio cabe em ini..fim (0 a 1). */
export function fracao(ini: string, fim: string): number {
  let s = 0;
  let d = ini;
  while (d <= fim) {
    const [y, m] = d.split('-').map(Number);
    s += 1 / dim(y, m);
    d = addDays(d, 1);
  }
  return s;
}

export interface PeriodoDeCobranca {
  ini: string;
  fim: string;
}

/** Período de aluguel que o boleto de `vencMk` cobra: o mês que passou (vencido) ou o do vencimento (antecipado). */
export function periodoDe(
  c: { inicio: string; cobranca: ModoDeCobranca; saida?: string | null },
  vencMk: string,
): PeriodoDeCobranca | null {
  const cov = c.cobranca === 'antecipado' ? vencMk : mk(addMonths(`${vencMk}-01`, -1));
  const primeiro = primeiroDia(cov);
  const ini = primeiro > c.inicio ? primeiro : c.inicio;
  let fim = ultimoDia(cov);
  if (c.saida && c.saida < fim) fim = c.saida;
  return ini <= fim ? { ini, fim } : null;
}

// ── Valor por extenso (contrato) ────────────────────────────────────────────
const UNIDADES = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

function ate999(n: number): string {
  if (n === 100) return 'cem';
  const c = Math.floor(n / 100);
  const r = n % 100;
  const p: string[] = [];
  if (c) p.push(CENTENAS[c]);
  if (r) {
    if (r < 20) p.push(UNIDADES[r]);
    else p.push(DEZENAS[Math.floor(r / 10)] + (r % 10 ? ` e ${UNIDADES[r % 10]}` : ''));
  }
  return p.join(' e ');
}

function inteiro(n: number): string {
  if (n === 0) return 'zero';
  const grupos: [number, string, string][] = [
    [1e6, 'milhão', 'milhões'],
    [1e3, 'mil', 'mil'],
  ];
  const p: string[] = [];
  let x = n;
  for (const [b, um, varios] of grupos) {
    const q = Math.floor(x / b);
    if (q) {
      p.push(b === 1e3 && q === 1 ? 'mil' : `${ate999(q)} ${q === 1 ? um : varios}`);
      x %= b;
    }
  }
  if (x) p.push(ate999(x));
  return p.length > 1 && (x < 100 || x % 100 === 0) && x ? `${p.slice(0, -1).join(' ')} e ${p[p.length - 1]}` : p.join(' ');
}

/** 2800 → "dois mil e oitocentos reais" · 1,5 → "um real e cinquenta centavos". */
export function extenso(valor: number): string {
  const cent = Math.round((Number(valor) || 0) * 100);
  const r = Math.floor(cent / 100);
  const cv = cent % 100;
  let t = '';
  if (r) t = inteiro(r) + (r >= 1e6 && r % 1e6 === 0 ? ' de' : '') + (r === 1 ? ' real' : ' reais');
  if (cv) t += (r ? ' e ' : '') + inteiro(cv) + (cv === 1 ? ' centavo' : ' centavos');
  return t || 'zero real';
}
