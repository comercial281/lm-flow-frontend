// AGENDAR O INÍCIO E LIMITE POR DIA (10/11/2026).
//
// Quem manda é o servidor: ele grava o início, o limite, anda a fila e prevê o
// término (a prévia recebe `starts_at` e `daily_limit` e devolve o `eta` pronto).
// Aqui mora só o que a janela precisa ANTES de criar: validar a data e o limite
// (com as mesmas frases do servidor) e avisar quando a hora escolhida cai fora
// do horário comercial.
//
// O horário comercial é cópia de `Broadcasts::BusinessClock` (seg a sex 8h às
// 20h, sáb 9h às 18h, domingo fechado, hora de São Paulo) e muda junto.
//
// São Paulo não tem horário de verão desde 2019: o fuso é fixo em -03:00.

const FUSO = '-03:00';
const FUSO_MS = 3 * 60 * 60 * 1000;
const DIA_MS = 24 * 60 * 60 * 1000;

export const LIMITE_MIN = 1;
export const LIMITE_MAX = 1000;
export const LIMITE_PADRAO = 20;

const DIAS_DA_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

/** O relógio de São Paulo como Date "em UTC" (getUTC* = hora de São Paulo). */
const emSp = (d: Date) => new Date(d.getTime() - FUSO_MS);
const deSp = (d: Date) => new Date(d.getTime() + FUSO_MS);
const doisDigitos = (n: number) => String(n).padStart(2, '0');

function janelaDoDia(diaDaSemana: number): [number, number] {
  return diaDaSemana === 6 ? [9, 18] : [8, 20];
}

function inicioDoDiaSeguinte(sp: Date): Date {
  return new Date(Date.UTC(sp.getUTCFullYear(), sp.getUTCMonth(), sp.getUTCDate()) + DIA_MS);
}

/** Próximo horário comercial a partir de `de` (ele mesmo se já estiver dentro). Igual ao servidor. */
export function proximoHorarioComercial(de: Date): Date {
  let t = emSp(de);
  for (let i = 0; i < 14; i++) {
    const dia = t.getUTCDay();
    if (dia === 0) {
      t = new Date(inicioDoDiaSeguinte(t).getTime() + 8 * 60 * 60 * 1000);
      continue;
    }
    const [abre, fecha] = janelaDoDia(dia);
    const h = t.getUTCHours();
    if (h < abre) {
      t = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate(), abre));
      break;
    }
    if (h >= fecha) {
      t = inicioDoDiaSeguinte(t);
      continue;
    }
    break;
  }
  return deSp(t);
}

/** "Até 20 por dia" lido do campo: inteiro de 1 a 1000, ou null quando não vale. */
export function lerLimite(texto: string): number | null {
  if (!/^\d+$/.test(texto.trim())) return null;
  const n = Number(texto.trim());
  return n >= LIMITE_MIN && n <= LIMITE_MAX ? n : null;
}

/** O início escolhido (data AAAA-MM-DD + hora HH:MM, hora de São Paulo), já validado. */
export interface InicioEscolhido {
  /** ISO com o fuso, como o servidor pede: 2026-12-24T09:00:00-03:00. */
  iso: string | null;
  data: Date | null;
  /** Frase embaixo do campo; vazia quando dá pra agendar. */
  erro: string;
}

export function lerInicio(dataEscolhida: string, horaEscolhida: string, agora: Date = new Date()): InicioEscolhido {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataEscolhida) || !/^\d{2}:\d{2}$/.test(horaEscolhida)) {
    return { iso: null, data: null, erro: 'Escolha a data e a hora.' };
  }
  const iso = `${dataEscolhida}T${horaEscolhida}:00${FUSO}`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { iso: null, data: null, erro: 'Escolha a data e a hora.' };
  if (d.getTime() <= agora.getTime()) {
    return { iso, data: d, erro: 'Escolha uma data e hora no futuro.' };
  }
  if (d.getTime() > agora.getTime() + 365 * DIA_MS) {
    return { iso, data: d, erro: 'Escolha uma data e hora até um ano à frente.' };
  }
  return { iso, data: d, erro: '' };
}

/** "8h" · "8h30", hora de São Paulo. */
function horaCurta(d: Date): string {
  const sp = emSp(d);
  const m = sp.getUTCMinutes();
  return `${sp.getUTCHours()}h${m ? doisDigitos(m) : ''}`;
}

/** "24/12" (outro ano: "24/12/2027"), dia de São Paulo. */
function diaMes(d: Date, agora: Date): string {
  const sp = emSp(d);
  const base = `${doisDigitos(sp.getUTCDate())}/${doisDigitos(sp.getUTCMonth() + 1)}`;
  return sp.getUTCFullYear() === emSp(agora).getUTCFullYear() ? base : `${base}/${sp.getUTCFullYear()}`;
}

/**
 * "Fora do horário comercial: começa às 8h de segunda, 24/12." quando o início
 * escolhido cai fora; null quando ele já está dentro.
 */
export function avisoForaDoHorario(inicio: Date, agora: Date = new Date()): string | null {
  const real = proximoHorarioComercial(inicio);
  if (real.getTime() === inicio.getTime()) return null;
  const dia = DIAS_DA_SEMANA[emSp(real).getUTCDay()];
  return `Fora do horário comercial: começa às ${horaCurta(real)} de ${dia}, ${diaMes(real, agora)}.`;
}

/** "24/12 às 09:00" do início real (já no horário comercial), hora de São Paulo. */
export function comecaEm(iso: string, agora: Date = new Date()): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const real = proximoHorarioComercial(d);
  const sp = emSp(real);
  return `${diaMes(real, agora)} às ${doisDigitos(sp.getUTCHours())}:${doisDigitos(sp.getUTCMinutes())}`;
}

/** "amanhã às 8h" · "hoje às 14h" · "segunda às 8h" · "em 24/12 às 8h". */
export function voltaQuando(iso: string, agora: Date = new Date()): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const sp = emSp(d);
  const a = emSp(agora);
  const dias = Math.round(
    (Date.UTC(sp.getUTCFullYear(), sp.getUTCMonth(), sp.getUTCDate()) -
      Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate())) /
      DIA_MS,
  );
  const quando =
    dias <= 0 ? 'hoje' : dias === 1 ? 'amanhã' : dias <= 6 ? DIAS_DA_SEMANA[sp.getUTCDay()] : `em ${diaMes(d, agora)}`;
  return `${quando} às ${horaCurta(d)}`;
}

/** O dia de hoje em São Paulo (AAAA-MM-DD), pro `min` do campo de data. */
export function hojeSp(agora: Date = new Date()): string {
  const sp = emSp(agora);
  return `${sp.getUTCFullYear()}-${doisDigitos(sp.getUTCMonth() + 1)}-${doisDigitos(sp.getUTCDate())}`;
}
