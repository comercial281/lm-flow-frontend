import { EMPTY_DESTINATION, type LeadDestinationValue } from '@/components/pipelines/LeadDestinationFields';
import type { LeadDestinationOptions } from '@/components/pipelines/useLeadDestinationOptions';
import type { Site, SiteFormData, SiteLeadRoutingPayload, SiteLeadRoutingSide } from '@/services/siteBuilder/siteBuilderService';

/** O que a tela do Site Builder edita no bloco Destino do lead. */
export interface SiteRoutingState {
  /** O servidor conhece venda/locação (manda `lead_routing`). */
  supported: boolean;
  rentSameAsSale: boolean;
  sale: LeadDestinationValue;
  rent: LeadDestinationValue;
}

const t = (v?: string | null) => v ?? '';
const n = (v: string) => v || null;

export function siteRoutingFrom(site?: Site | null): SiteRoutingState {
  const r = site?.lead_routing;
  const rent: SiteLeadRoutingSide = r?.rent ?? {};
  return {
    supported: !!r,
    rentSameAsSale: r ? r.rent_same_as_sale !== false : true,
    sale: {
      ...EMPTY_DESTINATION,
      pipeline_id: t(site?.lead_pipeline_id),
      stage_id: t(site?.lead_stage_id),
      label_id: t(site?.lead_label_id),
      roleta_config_id: t(r?.sale?.roleta_config_id),
      default_assignee_id: t(r?.sale?.default_assignee_id),
    },
    rent: {
      pipeline_id: t(rent.pipeline_id),
      stage_id: t(rent.stage_id),
      label_id: t(rent.label_id),
      roleta_config_id: t(rent.roleta_config_id),
      default_assignee_id: t(rent.default_assignee_id),
    },
  };
}

/**
 * O que viaja no salvar do site. Funil, coluna e etiqueta de venda seguem nas
 * colunas de sempre (sempre viajaram). O resto vai em `lead_routing`, e só o que
 * a pessoa pôde ver: o servidor grava parcial, então o seletor escondido por
 * recusa de cargo não apaga a escolha de ninguém.
 */
export function siteRoutingPayload(s: SiteRoutingState, o: LeadDestinationOptions): Partial<SiteFormData> {
  const out: Partial<SiteFormData> = {
    lead_pipeline_id: n(s.sale.pipeline_id),
    lead_stage_id: s.sale.pipeline_id ? n(s.sale.stage_id) : null,
    lead_label_id: n(s.sale.label_id),
  };
  if (!s.supported) return out;

  const sale: SiteLeadRoutingSide = {};
  if (o.roletas !== null) sale.roleta_config_id = n(s.sale.roleta_config_id);
  if (o.users !== null) sale.default_assignee_id = n(s.sale.default_assignee_id);
  const routing: SiteLeadRoutingPayload = { rent_same_as_sale: s.rentSameAsSale, sale };

  if (!s.rentSameAsSale) {
    const rent: SiteLeadRoutingSide = {};
    if (o.pipelines !== null) {
      rent.pipeline_id = n(s.rent.pipeline_id);
      rent.stage_id = s.rent.pipeline_id ? n(s.rent.stage_id) : null;
    }
    if (o.labels !== null) rent.label_id = n(s.rent.label_id);
    if (o.roletas !== null) rent.roleta_config_id = n(s.rent.roleta_config_id);
    if (o.users !== null) rent.default_assignee_id = n(s.rent.default_assignee_id);
    routing.rent = rent;
  }

  out.lead_routing = routing;
  return out;
}
