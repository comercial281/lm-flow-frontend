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

/**
 * O contador do cabeçalho conta o que a pessoa VÊ, no mês que está na tela.
 * Antes era o total da história do cliente, de todos os corretores (o "10
 * visitas" do Raio-X, ao lado de um calendário com 2).
 */
export function rotuloContador(total: number, opcoes: { soMinhas: boolean; mes?: Date }): string {
  const base = plural(total, 'visita', 'visitas');
  const dono = opcoes.soMinhas ? (total === 1 ? ' sua' : ' suas') : '';
  const mes = opcoes.mes ? ` em ${MESES[opcoes.mes.getMonth()]}` : '';
  return `${base}${dono}${mes}`;
}
