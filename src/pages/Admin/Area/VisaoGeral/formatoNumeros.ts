import { tempoDesde } from '@/lib/formato';
import type { LinhaCliente, PeriodoNumeros } from '@/types/admin/overview';

export const OPCOES_PERIODO: { valor: PeriodoNumeros; rotulo: string }[] = [
  { valor: 'hoje', rotulo: 'Hoje' },
  { valor: '7d', rotulo: '7 dias' },
  { valor: '30d', rotulo: '30 dias' },
  { valor: 'mes_atual', rotulo: 'Mês atual' },
  { valor: 'mes_passado', rotulo: 'Mês passado' },
];
export const PERIODO_PADRAO: PeriodoNumeros = '7d';

export function periodoValido(v: string | null): PeriodoNumeros {
  return OPCOES_PERIODO.some((o) => o.valor === v) ? (v as PeriodoNumeros) : PERIODO_PADRAO;
}

export function variacao(atual: number | null, anterior: number | null): { texto: string; sentido: 'sobe' | 'desce' | 'igual' } | null {
  if (atual === null || anterior === null) return null;
  if (anterior === 0) return atual === 0 ? null : { texto: 'novo', sentido: 'sobe' };
  const pct = Math.round(((atual - anterior) / anterior) * 100);
  if (pct === 0) return { texto: '0%', sentido: 'igual' };
  return { texto: `${pct > 0 ? '+' : ''}${pct}%`, sentido: pct > 0 ? 'sobe' : 'desce' };
}

export function rotuloDoBalde(bucket: string, tipo: 'hour' | 'day'): string {
  if (tipo === 'hour') return `${parseInt(bucket.slice(11, 13), 10)}h`;
  return `${bucket.slice(8, 10)}/${bucket.slice(5, 7)}`;
}

export function atualizadoHa(iso: string, agora: Date = new Date()): string {
  const t = tempoDesde(iso, agora);
  return t === 'agora' ? 'Atualizado agora' : `Atualizado ${t}`;
}

export const COLUNAS_ORDENAVEIS: { chave: keyof LinhaCliente; rotulo: string }[] = [
  { chave: 'leads', rotulo: 'Leads' },
  { chave: 'conversations', rotulo: 'Conversas' },
  { chave: 'users_active', rotulo: 'Usuários ativos' },
  { chave: 'ai_attended', rotulo: 'Atendidos pela IA' },
  { chave: 'ai_visits', rotulo: 'Visitas pela IA' },
  { chave: 'ai_cost_brl', rotulo: 'Custo da IA' },
];
