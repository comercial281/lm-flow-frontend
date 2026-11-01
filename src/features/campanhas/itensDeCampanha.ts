/** Montagem e leitura de itens da lista de Campanhas (Tarefa 77). Só apresentação; o servidor monta a lista. */
import type { ItemDeCampanha, TipoDoImovel } from '@/services/campanhas/campanhasService';
import type { LeadAdsFormConfig } from '@/services/leadAds/leadAdsFormsService';

export const MAX_DE_IMOVEIS = 10;
export const TIPOS_DE_IMOVEL: Record<TipoDoImovel, string> = { development: 'Empreendimentos', resale: 'Revenda', auction: 'Leilão' };

export function itemEmBranco(sobre: Partial<ItemDeCampanha> = {}): ItemDeCampanha {
  return {
    key: '', kind: 'form', label: null, form_config_id: null, link_id: null, keyword_rule: false, property_ids: [],
    sells_scope: null, sells_listing_kind: null, offer_condition: null, audience_intents: [], leads_count: 0,
    last_lead_at: null, ad_title: null, ad_body: null, campaign_name: null, match_kind: null, match_value: null,
    is_active: null, agents: [], ...sobre,
  };
}

/** O item de uma ficha de formulário quando a lista do servidor ainda não chegou (ou não existe: tela sozinha). */
export function itemDaFicha(cfg: LeadAdsFormConfig, nome: string, daLista?: ItemDeCampanha): ItemDeCampanha {
  if (daLista) return daLista;
  return itemEmBranco({
    key: `form:${cfg.form_id}`, kind: 'form', label: nome, form_config_id: cfg.id, keyword_rule: false,
    property_ids: cfg.property_ids?.length ? cfg.property_ids.map(String) : cfg.property_id ? [String(cfg.property_id)] : [],
    sells_scope: cfg.sells_scope ?? null, sells_listing_kind: cfg.sells_listing_kind ?? null,
    offer_condition: cfg.offer_condition ?? null, audience_intents: cfg.audience_intents ?? [], is_active: cfg.is_active,
  });
}

/** A campanha não diz o que vende: sem tipo, ou "imóveis" sem nenhum imóvel. */
export function semOferta(it: Pick<ItemDeCampanha, 'sells_scope' | 'property_ids'>): boolean {
  if (!it.sells_scope) return true;
  return it.sells_scope === 'properties' && it.property_ids.length === 0;
}

/** O que vende, em uma frase da coluna "Vende". Nulo = não diz. */
export function vendeEmTexto(it: ItemDeCampanha, nomes: Record<string, string> = {}): string | null {
  if (semOferta(it)) return null;
  if (it.sells_scope === 'catalog') return 'Todo o catálogo';
  if (it.sells_scope === 'listing_kind') return it.sells_listing_kind ? `Todo o tipo ${TIPOS_DE_IMOVEL[it.sells_listing_kind]}` : 'Um tipo inteiro';
  const achados = it.property_ids.map((id) => nomes[String(id)]).filter(Boolean);
  const n = it.property_ids.length;
  if (achados.length === n && n === 1) return achados[0];
  if (achados.length) return `${achados[0]} +${n - 1}`;
  return `${n} ${n === 1 ? 'imóvel' : 'imóveis'}`;
}

const SETE_DIAS = 7 * 24 * 3600 * 1000;
/** Campanha que trouxe lead nos últimos 7 dias e não diz o que vende (o aviso do topo). */
export function semOfertaComLeadRecente(itens: readonly ItemDeCampanha[], agora = Date.now()): ItemDeCampanha[] {
  return itens.filter((it) => semOferta(it) && it.leads_count > 0 && !!it.last_lead_at && agora - Date.parse(it.last_lead_at) <= SETE_DIAS);
}

export function nomeDoItem(it: ItemDeCampanha): string {
  return it.label || it.ad_title || it.campaign_name || it.match_value || 'Sem nome';
}
