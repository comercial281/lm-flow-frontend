import type { PortalTab } from './portalShared';

/**
 * Finalidade do lead do site: comprar (venda) ou alugar (locação).
 *
 * Spec venda/locação (2026-09-30), D3: o formulário só PERGUNTA quando o imóvel
 * não decide sozinho (Venda + Locação) ou quando não há imóvel (home). O servidor
 * faz a mesma leitura (Leads::TransactionIntent); aqui é só o que a tela mostra.
 */
export type Finalidade = 'venda' | 'locacao';

/** Parâmetro de URL que a busca leva até a página do imóvel. */
export const FINALIDADE_PARAM = 'finalidade';

/** O que o imóvel já decide sozinho; `null` = a pessoa escolhe. */
export function finalidadeDoImovel(transactionType?: string | null): Finalidade | null {
  if (transactionType === 'sale') return 'venda';
  if (transactionType === 'rent' || transactionType === 'season') return 'locacao';
  return null;
}

/** Marcação inicial do seletor: a da URL ou a da aba da busca; sem nada, comprar. */
export function finalidadeInicial(valor?: string | null): Finalidade {
  return valor === 'locacao' || valor === 'rent' ? 'locacao' : 'venda';
}

/** Link da página do imóvel, levando a aba Alugar quando a busca estava nela. */
export function imovelHref(tenant: string, code: string, tab?: PortalTab): string {
  const base = `/imovel/${tenant}/${code}`;
  return tab === 'rent' ? `${base}?${FINALIDADE_PARAM}=locacao` : base;
}
