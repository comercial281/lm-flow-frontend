// ── FORMATO BRASILEIRO: UM LUGAR SÓ ─────────────────────────────────────────
//
// POR QUE ISTO EXISTE
// O Raio-X (25/09) achou "0.0%", "US$ 0.00", "imóvels", telefone cru e hora em
// AM/PM, e o código tinha 17 funções próprias de R$ espalhadas. Cada tela
// formatava do seu jeito; qualquer uma podia esquecer o 'pt-BR'.
//
// A regra agora: número, dinheiro, data, hora, telefone e plural que aparecem
// na tela do cliente saem DAQUI. O `conferir-padrao` do build conta
// toLocaleString/Intl/'BRL' fora deste arquivo e não deixa o número subir.
//
// Valor vazio ou inválido vira '—' (travessão), nunca "NaN", "Invalid date",
// "R$ 0,00" inventado ou string vazia que some com o rótulo.

export const VAZIO = '—';
const NBSP = ' ';

// ── Datas ────────────────────────────────────────────────────────────────────
// Datas chegam do backend como epoch em SEGUNDOS, epoch em MILISSEGUNDOS ou ISO
// (ver o histórico em utils/dateUtils). E "2026-09-30" puro é DIA DE CALENDÁRIO:
// `new Date('2026-09-30')` é meia-noite em UTC, que em São Paulo é 29/09 às 21h
// — o dia errado na tela. Esse caso é lido como data local.
export function toDate(value: unknown): Date | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    // < 1e12 = epoch em segundos (timestamps em ms são ~1.7e12).
    return new Date(value < 1e12 ? value * 1000 : value);
  }
  const s = String(value).trim();
  const soDia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (soDia) return new Date(Number(soDia[1]), Number(soDia[2]) - 1, Number(soDia[3]));
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    return new Date(n < 1e12 ? n * 1000 : n);
  }
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t) : null;
}

const fmtData = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtDataCurta = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });
const fmtHora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });

/** 30/09/2026 */
export function data(valor: unknown): string {
  const d = toDate(valor);
  return d ? fmtData.format(d) : VAZIO;
}

/** 30/09 — pra listas e cards, onde o ano atrapalha. */
export function dataCurta(valor: unknown): string {
  const d = toDate(valor);
  return d ? fmtDataCurta.format(d) : VAZIO;
}

/** 14:32 — sempre 24h. */
export function hora(valor: unknown): string {
  const d = toDate(valor);
  return d ? fmtHora.format(d) : VAZIO;
}

/**
 * Quando algo mudou, curto, pra coluna de lista: "hoje 14:32" · "ontem" ·
 * "28/09" · "28/09/2025" (outro ano). Comparação pelo dia do calendário local.
 */
export function quandoMudou(valor: unknown, agora: Date = new Date()): string {
  const d = toDate(valor);
  if (!d) return VAZIO;
  const dia = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dias = Math.round((dia(agora) - dia(d)) / 86_400_000);
  if (dias === 0) return `hoje ${fmtHora.format(d)}`;
  if (dias === 1) return 'ontem';
  return d.getFullYear() === agora.getFullYear() ? fmtDataCurta.format(d) : fmtData.format(d);
}

/** 30/09/2026 às 14:32 */
export function dataHora(valor: unknown): string {
  const d = toDate(valor);
  return d ? `${fmtData.format(d)} às ${fmtHora.format(d)}` : VAZIO;
}

// ── Números e dinheiro ──────────────────────────────────────────────────────
// A API às vezes manda número como texto ("450000.00", decimal do Rails).
function paraNumero(valor: unknown): number | null {
  if (valor == null || valor === '') return null;
  const n = typeof valor === 'number' ? valor : Number(valor);
  return Number.isFinite(n) ? n : null;
}

/** 1.234 · 12,5 — `casas` é o máximo de casas decimais (padrão 0). */
export function numero(valor: unknown, casas = 0): string {
  const n = paraNumero(valor);
  if (n === null) return VAZIO;
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: casas }).format(n);
}

/**
 * Recebe o valor JÁ em porcento (12.5 → "12,5%"), que é como as telas calculam.
 * Uma casa decimal por padrão; zero sai "0%", nunca "0.0%".
 */
export function porcentagem(valor: unknown, casas = 1): string {
  const n = paraNumero(valor);
  return n === null ? VAZIO : `${numero(n, casas)}%`;
}

export type Moeda = 'BRL' | 'USD' | 'EUR';

// Moeda gravada no item pode vir de qualquer lugar (jsonb do backend, digitação
// livre); desconhecida vira real em vez de quebrar a tela (Intl.NumberFormat
// lança RangeError pra código de moeda inválido).
export function moedaValida(codigo: unknown): Moeda {
  return codigo === 'USD' || codigo === 'EUR' ? codigo : 'BRL';
}

const formatadorDeMoeda = (moeda: Moeda, centavos: boolean) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: moeda,
    ...(centavos ? {} : { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
  });

export interface OpcoesDinheiro {
  /** false = sem centavos (preço de imóvel: "R$ 450.000"). Padrão: com centavos. */
  centavos?: boolean;
  /** Painel: "R$ 1,2 mi" a partir de 1 milhão, "R$ 45 mil" a partir de 10 mil. Só em reais. */
  compacto?: boolean;
  /** Item do funil pode ter outra moeda: 'USD' → "US$ 1.234,56", 'EUR' → "€ 1.234,56". Padrão BRL. */
  moeda?: Moeda;
}

/** R$ 1.234,56 */
export function dinheiro(valor: unknown, opcoes: OpcoesDinheiro = {}): string {
  const n = paraNumero(valor);
  if (n === null) return VAZIO;
  const moeda = opcoes.moeda ?? 'BRL';
  if (opcoes.compacto && moeda === 'BRL') {
    const abs = Math.abs(n);
    const sinal = n < 0 ? '-' : '';
    if (abs >= 1_000_000) return `${sinal}R$${NBSP}${numero(abs / 1_000_000, 1)} mi`;
    if (abs >= 10_000) return `${sinal}R$${NBSP}${numero(abs / 1_000, 0)} mil`;
  }
  return formatadorDeMoeda(moeda, opcoes.centavos !== false).format(n);
}

/**
 * US$ 1,23 — só pra valor COBRADO em dólar de verdade (custo do Meta, custo da
 * IA). Formato brasileiro, moeda americana. `casas` fixas (padrão 2).
 */
export function dolar(valor: unknown, casas = 2): string {
  const n = paraNumero(valor);
  if (n === null) return VAZIO;
  const corpo = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }).format(
    Math.abs(n),
  );
  return `${n < 0 ? '-' : ''}US$${NBSP}${corpo}`;
}

/** "1 imóvel" · "3 imóveis" · "0 imóveis" · "1.234 imóveis" */
export function plural(quantidade: number, singular: string, pluralDaPalavra: string): string {
  return `${numero(quantidade)} ${quantidade === 1 ? singular : pluralDaPalavra}`;
}

// ── Telefone ─────────────────────────────────────────────────────────────────
// Única implementação (a aba Números, `numberTexts.formatPhone`, delega pra cá).
// Brasileiro com ou sem 55 vira (11) 91234-1234 / (11) 3333-4444. Estrangeiro
// com + fica como veio. Qualquer outra coisa volta como veio: melhor mostrar o
// que está gravado do que inventar um número.
export function telefone(valor: string | null | undefined): string {
  const bruto = (valor ?? '').trim();
  if (!bruto) return '';
  const digitosBrutos = bruto.replace(/\D/g, '');
  if (bruto.startsWith('+') && !digitosBrutos.startsWith('55')) return bruto;
  let digitos = digitosBrutos;
  if (digitos.startsWith('55') && (digitos.length === 12 || digitos.length === 13)) digitos = digitos.slice(2);
  if (digitos.length !== 10 && digitos.length !== 11) return bruto;
  const ddd = digitos.slice(0, 2);
  const resto = digitos.slice(2);
  const corte = resto.length === 9 ? 5 : 4;
  return `(${ddd}) ${resto.slice(0, corte)}-${resto.slice(corte)}`;
}

// ── Tempo decorrido ──────────────────────────────────────────────────────────
/** "agora" · "há 5 min" · "há 3 h" · "há 1 dia" · "há 4 dias". Número = segundos Unix. */
export function tempoDesde(desde: Date | string | number, agora: Date = new Date()): string {
  const d = toDate(desde);
  if (!d) return VAZIO;
  const minutos = Math.floor((agora.getTime() - d.getTime()) / 60_000);
  if (minutos < 1) return 'agora';
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? 'há 1 dia' : `há ${dias} dias`;
}
