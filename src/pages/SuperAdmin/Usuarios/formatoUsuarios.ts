import type { UserSituation } from '@/types/admin/users';
import { VAZIO } from '@/lib/formato';

const ROTULOS: Record<UserSituation, string> = {
  ativo: 'Ativo',
  sumido: 'Sumido há 7+ dias',
  nunca_entrou: 'Nunca entrou',
  desativado: 'Desativado',
};

export const rotuloSituacao = (s: UserSituation): string => ROTULOS[s] ?? s;

export function statusDaSituacao(s: UserSituation): 'success' | 'warning' | 'pending' | 'inactive' {
  if (s === 'ativo') return 'success';
  if (s === 'sumido') return 'warning';
  if (s === 'nunca_entrou') return 'pending';
  return 'inactive';
}

export const OPCOES_SITUACAO: { valor: '' | UserSituation; rotulo: string }[] = [
  { valor: '', rotulo: 'Todas' },
  { valor: 'ativo', rotulo: 'Ativo' },
  { valor: 'sumido', rotulo: ROTULOS.sumido },
  { valor: 'nunca_entrou', rotulo: ROTULOS.nunca_entrou },
  { valor: 'desativado', rotulo: ROTULOS.desativado },
];

/** 4800 → "1 h 20 min" · 720 → "12 min" · 0/nulo → "—" */
export function duracao(segundos: number | null | undefined): string {
  const min = Math.round((segundos ?? 0) / 60);
  if (min <= 0) return VAZIO;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** O cliente principal (schema public) aparece com nome próprio. */
export const nomeDoCliente = (schema: string, nome: string): string =>
  schema === 'public' ? 'Leal Mídia (principal)' : nome;
