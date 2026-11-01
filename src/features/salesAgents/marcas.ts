/**
 * As MARCAS da IA (o que a casa atende) e os conhecimentos de fábrica que cada uma liga
 * (Tarefa 72, 01/11/2026; fase 3, seção 3).
 *
 * ⚠️ `CONHECIMENTOS_DA_MARCA` é ESPELHO da tabela do servidor, só pra lista mudar na hora ao
 * marcar. Quem decide de verdade é o servidor (`GET /sales_agents/:id/factory_knowledge`,
 * `salesAgentsService.conhecimentosDeFabrica`): depois de gravar, a tela mostra o que ele devolve.
 * (O MCMV também liga por imóvel com MCMV marcado; o espelho não sabe disso.)
 */
import type { Marca, TopicoDeFabrica } from '@/services/salesAgents/salesAgentsService';

export const MARCAS: readonly Marca[] = ['venda', 'locacao', 'leilao', 'empreendimento'];

export const ROTULO_DA_MARCA: Record<Marca, string> = {
  venda: 'Venda',
  locacao: 'Locação',
  leilao: 'Leilão',
  empreendimento: 'Empreendimento',
};

/** Os 8, na ordem da tabela da fase 3. */
export const ORDEM_DOS_CONHECIMENTOS: readonly TopicoDeFabrica[] = [
  'mcmv', 'financiamento', 'fgts', 'compra_planta', 'custos_compra', 'compra_leilao', 'locacao', 'vender_atual',
];

export const TITULO_DO_CONHECIMENTO: Record<TopicoDeFabrica, string> = {
  mcmv: 'Minha Casa Minha Vida',
  financiamento: 'Financiamento',
  fgts: 'FGTS',
  compra_planta: 'Compra na planta',
  custos_compra: 'Custos da compra',
  compra_leilao: 'Compra de leilão',
  locacao: 'Locação',
  vender_atual: 'Vender o atual pra comprar',
};

export const CONHECIMENTOS_DA_MARCA: Record<Marca, readonly TopicoDeFabrica[]> = {
  empreendimento: ['mcmv', 'financiamento', 'fgts', 'compra_planta'],
  venda: ['financiamento', 'fgts', 'custos_compra', 'vender_atual'],
  leilao: ['financiamento', 'custos_compra', 'compra_leilao'],
  locacao: ['locacao'],
};

/** Os conhecimentos que as marcas ligam, sem repetir, na ordem da tabela. */
export function conhecimentosLigados(serves: readonly Marca[] | null | undefined): TopicoDeFabrica[] {
  const marcas = serves ?? [];
  return ORDEM_DOS_CONHECIMENTOS.filter((t) => marcas.some((m) => CONHECIMENTOS_DA_MARCA[m].includes(t)));
}
