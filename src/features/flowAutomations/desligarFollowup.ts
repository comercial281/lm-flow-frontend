// Follow-up: uma porta só (Fase 2, 2026-10-20). Desligar (ou arquivar) um
// follow-up com lead dentro tira todo mundo dele e os cards saem da coluna
// Follow-up: a tela avisa quantos antes. O servidor devolve `stopped_count` e
// `remaining` ao lado do `data`; sobra gente (`remaining`) quando o motor ainda
// está terminando de tirar os leads.

import type { PedidoDeConfirmacao } from '@/hooks/useConfirmacao';
import { plural } from '@/lib/formato';

/** Quantos leads estão dentro agora (pausados contam). Só follow-up traz. */
export function leadsDentro(flow: { live_count?: number | null }): number {
  const n = Number(flow.live_count ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function pedidoDesligarFollowup(nome: string, leads: number, acao: 'Desligar' | 'Arquivar' = 'Desligar'): PedidoDeConfirmacao {
  return {
    titulo: `${acao} "${nome}"?`,
    descricao: leads === 1
      ? '1 lead vai sair do follow-up e o card sai da coluna Follow-up.'
      : `${plural(leads, 'lead', 'leads')} vão sair do follow-up e os cards saem da coluna Follow-up.`,
    rotuloDaAcao: acao,
    destrutivo: true,
  };
}

/** O aviso quando o servidor ainda está terminando de tirar leads; null quando já acabou. */
export function avisoLeadsSaindo(remaining: number | null | undefined): string | null {
  const n = Number(remaining ?? 0);
  if (!Number.isFinite(n) || n <= 0) return null;
  return `Desligado. ${plural(n, 'lead', 'leads')} ainda saindo do follow-up; o sistema termina em seguida.`;
}
