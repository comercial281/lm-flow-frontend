// src/features/visits/contagem.ts
import { plural } from '@/lib/formato';

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

const dia = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** O mês que o calendário está mostrando, no formato que o servidor entende. */
export function intervaloDoMes(d: Date): { desde: string; ate: string } {
  return {
    desde: dia(new Date(d.getFullYear(), d.getMonth(), 1)),
    ate: dia(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
  };
}

/** Um período qualquer (a semana ou o dia do calendário), no mesmo formato. */
export function intervaloDosDias(primeiro: Date, ultimo: Date): { desde: string; ate: string } {
  return { desde: dia(primeiro), ate: dia(ultimo) };
}

/**
 * O contador do cabeçalho conta o que a pessoa VÊ, no mês que está na tela.
 * Antes era o total da história do cliente, de todos os corretores (o "10
 * visitas" do Raio-X, ao lado de um calendário com 2).
 */
export function rotuloContador(
  total: number,
  opcoes: { soMinhas: boolean; mes?: Date; periodo?: string },
): string {
  const base = plural(total, 'visita', 'visitas');
  const dono = opcoes.soMinhas ? (total === 1 ? ' sua' : ' suas') : '';
  // `periodo` (Semana/Dia: "nesta semana", "hoje", "em 02/10") vence o mês.
  const quando = opcoes.periodo ? ` ${opcoes.periodo}` : opcoes.mes ? ` em ${MESES[opcoes.mes.getMonth()]}` : '';
  return `${base}${dono}${quando}`;
}

export interface MetaVisitas {
  total?: number;
  only_mine?: boolean;
  /** Só o servidor novo manda: as visitas não canceladas do recorte pedido. */
  active_total?: number;
}

/**
 * Qual número o contador mostra, a partir do `meta` da lista.
 *
 * - `mesInteiro`: o calendário pedindo o período inteiro (mês, semana ou dia),
 *   sem filtro do link e sem aba de situação. Só aí vale `active_total` (o
 *   período sem as canceladas, o mesmo número da Dashboard). Em todo o resto é `total`, senão a aba
 *   "Canceladas" diria "0 visitas" ao lado de uma lista de canceladas.
 * - `servidorNovo`: o servidor entendeu o recorte do mês (só ele manda
 *   `active_total`). O servidor antigo devolve a história inteira, então o
 *   rótulo não pode dizer "em setembro".
 */
export function lerContador(
  meta: MetaVisitas | undefined,
  opcoes: { mesInteiro: boolean },
): { total: number; servidorNovo: boolean } {
  const servidorNovo = meta?.active_total !== undefined;
  const total = opcoes.mesInteiro && servidorNovo ? (meta?.active_total ?? 0) : (meta?.total ?? 0);
  return { total, servidorNovo };
}
