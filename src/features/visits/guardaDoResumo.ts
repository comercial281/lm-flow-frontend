// Resumo do lead de cada visita, guardado enquanto a página vive.
//
// Varrer o mouse pelo mês não pode virar dezenas de pedidos (spec da Agenda,
// "O que não pode acontecer"): o atraso de 450 ms fica no usePreviaComAtraso;
// aqui o resumo de cada visita vale 2 minutos e o pedido que já está saindo é
// reaproveitado. Erro não fica guardado: a próxima parada do mouse tenta de novo.
import { visitsService, type LeadSummary } from '@/services/visits/visitsService';

export const RESUMO_VALE_MS = 120_000;

const guardados = new Map<string, { em: number; resumo: LeadSummary }>();
const emAndamento = new Map<string, Promise<LeadSummary>>();

/** O resumo ainda valendo, sem pedir nada (pra abrir a prévia sem esqueleto). */
export function resumoGuardado(id: string, agora: () => number = Date.now): LeadSummary | undefined {
  const g = guardados.get(id);
  if (!g) return undefined;
  if (agora() - g.em >= RESUMO_VALE_MS) {
    guardados.delete(id);
    return undefined;
  }
  return g.resumo;
}

export function lerResumoDoLead(id: string, agora: () => number = Date.now): Promise<LeadSummary> {
  const valendo = resumoGuardado(id, agora);
  if (valendo) return Promise.resolve(valendo);
  const saindo = emAndamento.get(id);
  if (saindo) return saindo;

  const pedido = visitsService
    .leadSummary(id)
    .then((resumo) => {
      guardados.set(id, { em: agora(), resumo });
      return resumo;
    })
    .finally(() => emAndamento.delete(id));
  emAndamento.set(id, pedido);
  return pedido;
}

/** Pros testes. */
export function esquecerResumos(): void {
  guardados.clear();
  emAndamento.clear();
}
