import api from '@/services/core/api';
import type { Intencao } from '@/services/salesAgents/salesAgentsService';

// Campanhas (fase 4/5): a lista que junta formulários, campanhas e anúncios, as linhas de
// campanha e "qual IA atende". Toda regra mora no servidor; aqui só entra e sai o contrato.

export type TipoDaLinha = 'campaign' | 'ad';
export type EscopoDaOferta = 'properties' | 'listing_kind' | 'catalog';
export type TipoDoImovel = 'resale' | 'development' | 'auction';

/** O que a campanha oferece de condição. Nulo = sem condição. */
export interface CondicaoDaOferta {
  down_payment_from: number | null;
  installment_from: number | null;
  min_income: number | null;
  payment_terms: string | null;
  note: string | null;
}

/** Quem atende o item na coluna "qual IA atende". */
export interface IaDaCampanha {
  sales_agent_id: string;
  name: string;
  /** Nulo = o formulário vem com os números herdando (uma entrada só). */
  sales_agent_number_id: string | null;
  number_label: string | null;
  whole_number: boolean;
  note: string | null;
}

/** Um item da lista de Campanhas: formulário (`form:<id>`), campanha (`campaign:<nome>`) ou anúncio (`ad:<id>`). */
export interface ItemDeCampanha {
  key: string;
  kind: 'form' | TipoDaLinha;
  label: string | null;
  form_config_id: string | null;
  link_id: string | null;
  keyword_rule: boolean;
  property_ids: string[];
  sells_scope: EscopoDaOferta | null;
  sells_listing_kind: TipoDoImovel | null;
  offer_condition: CondicaoDaOferta | null;
  audience_intents: Intencao[];
  leads_count: number;
  last_lead_at: string | null;
  ad_title: string | null;
  ad_body: string | null;
  campaign_name: string | null;
  match_kind: TipoDaLinha | null;
  match_value: string | null;
  is_active: boolean | null;
  agents: IaDaCampanha[];
}

/** A linha de campanha ou de anúncio (`campaign_links`). Sem destroy: desligar é `is_active: false`. */
export interface LinhaDeCampanha {
  id: string;
  match_kind: TipoDaLinha;
  match_value: string;
  label: string | null;
  property_ids: string[];
  sells_scope: EscopoDaOferta | null;
  sells_listing_kind: TipoDoImovel | null;
  offer_condition: CondicaoDaOferta | null;
  audience_intents: Intencao[];
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface NovaLinha {
  match_kind: TipoDaLinha;
  match_value: string;
  label?: string | null;
  property_ids?: string[];
  sells_scope?: EscopoDaOferta | null;
  sells_listing_kind?: TipoDoImovel | null;
  offer_condition?: Partial<CondicaoDaOferta> | null;
  audience_intents?: Intencao[];
  is_active?: boolean;
}
/** O par tipo + valor identifica a linha e não muda. */
export type MudancaDaLinha = Partial<Omit<NovaLinha, 'match_kind' | 'match_value'>>;

/** Uma opção do seletor "qual IA atende": uma por IA, ou por número quando ele tem gatilho próprio. */
export interface OpcaoDeIa {
  sales_agent_id: string;
  number_id: string | null;
  label: string;
  serves_all: boolean;
  /** `all_mode` = a IA atende todo lead do número e não aceita campanha avulsa. */
  locked: 'all_mode' | null;
  enabled: boolean;
}

/** `form` = formulário do Meta (id do formulário); `campaign_link` = linha de campanha ou anúncio. */
export interface ReferenciaDaCampanha {
  kind: 'form' | 'campaign_link';
  id: string;
}

export interface PedidoDeIa {
  ref: ReferenciaDaCampanha;
  sales_agent_id: string;
  number_id?: string | null;
  /** Confirma mover a campanha de outra IA do mesmo número. */
  confirm_move?: boolean;
}

export interface DonosDaCampanha {
  holders: IaDaCampanha[];
  /** Campanhas que ficaram sem nenhuma IA depois da mudança. */
  left_empty: string[];
  warning: string | null;
}

export interface QuemSai { sales_agent_id: string; number_id: string | null }

export type RespostaDoPedidoDeIa =
  | ({ ok: true } & DonosDaCampanha)
  | { ok: false; moveNeeded: true; message: string; conflicts: QuemSai[] };

const LINKS = '/campaign_links';

type ErroHttp = { response?: { status?: number; data?: { error?: string; message?: string; conflicts?: QuemSai[] } } };

export const campanhasService = {
  /** `salesAgentId` recorta pra aba Campanhas da IA (60 dias; sem ele, 90). */
  async lista(opts: { salesAgentId?: string } = {}): Promise<ItemDeCampanha[]> {
    const params: Record<string, string> = {};
    if (opts.salesAgentId) params.sales_agent_id = opts.salesAgentId;
    const res = await api.get('/campaigns', { params });
    return (res.data as { data?: ItemDeCampanha[] }).data ?? [];
  },

  async criarLinha(body: NovaLinha): Promise<LinhaDeCampanha> {
    const res = await api.post(LINKS, body);
    return (res.data as { data: LinhaDeCampanha }).data;
  },

  async atualizarLinha(id: string, body: MudancaDaLinha): Promise<LinhaDeCampanha> {
    const res = await api.patch(`${LINKS}/${id}`, body);
    return (res.data as { data: LinhaDeCampanha }).data;
  },

  /** "Preencher com o anúncio": a IA lê o texto e propõe a condição. Não grava nada. */
  async condicaoDoTexto(text: string): Promise<CondicaoDaOferta> {
    const res = await api.post(`${LINKS}/condition_from_text`, { text });
    return (res.data as { data: CondicaoDaOferta }).data;
  },

  async opcoesDeIa(): Promise<OpcaoDeIa[]> {
    const res = await api.get('/campaigns/agent_options');
    return (res.data as { data?: OpcaoDeIa[] }).data ?? [];
  },

  /**
   * Põe a IA na campanha. Campanha que já é de outra IA no mesmo número pede
   * `confirm_move: true`: o servidor responde 409, e aqui vira `moveNeeded` pra tela perguntar.
   */
  async escolherIa(pedido: PedidoDeIa): Promise<RespostaDoPedidoDeIa> {
    try {
      const res = await api.put('/campaigns/agent', pedido);
      return { ok: true, ...(res.data as DonosDaCampanha) };
    } catch (erro) {
      const r = (erro as ErroHttp).response;
      if (r?.status === 409 && r.data?.error === 'move_needed') {
        return { ok: false, moveNeeded: true, message: r.data.message ?? '', conflicts: r.data.conflicts ?? [] };
      }
      throw erro;
    }
  },

  async tirarIa(pedido: Omit<PedidoDeIa, 'confirm_move'>): Promise<DonosDaCampanha> {
    const res = await api.delete('/campaigns/agent', { data: pedido });
    return res.data as DonosDaCampanha;
  },
};
