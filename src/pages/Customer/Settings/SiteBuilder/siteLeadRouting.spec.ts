import { describe, expect, it } from 'vitest';
import { siteRoutingFrom, siteRoutingPayload } from './siteLeadRouting';
import type { LeadDestinationOptions } from '@/components/pipelines/useLeadDestinationOptions';
import type { Site } from '@/services/siteBuilder/siteBuilderService';

const tudo: LeadDestinationOptions = { pipelines: [], roletas: [], users: [], labels: [] };

const site = (extra: Partial<Site>): Site => ({
  lead_pipeline_id: 'pipe-1', lead_stage_id: 'st-1', lead_label_id: null, ...extra,
} as Site);

/**
 * O destino do lead do site (spec venda/locação, D6/D10): a venda continua nas
 * colunas de sempre; roleta, responsável e locação vão em `lead_routing`, e só o
 * que a pessoa pôde ver viaja (o servidor grava parcial).
 */
describe('siteLeadRouting', () => {
  it('lê o servidor novo: venda das colunas + roleta; locação do bloco dela', () => {
    const s = siteRoutingFrom(site({
      lead_routing: {
        rent_same_as_sale: false,
        sale: { roleta_config_id: 'rol-1', default_assignee_id: null },
        rent: { pipeline_id: 'pipe-2', stage_id: null, label_id: null, roleta_config_id: null, default_assignee_id: 'u-1' },
      },
    }));

    expect(s.supported).toBe(true);
    expect(s.rentSameAsSale).toBe(false);
    expect(s.sale).toMatchObject({ pipeline_id: 'pipe-1', stage_id: 'st-1', roleta_config_id: 'rol-1' });
    expect(s.rent).toMatchObject({ pipeline_id: 'pipe-2', default_assignee_id: 'u-1' });
  });

  it('servidor antigo (sem lead_routing): só a venda, sem mandar lead_routing', () => {
    const s = siteRoutingFrom(site({}));

    expect(s.supported).toBe(false);
    expect(siteRoutingPayload(s, tudo)).toEqual({ lead_pipeline_id: 'pipe-1', lead_stage_id: 'st-1', lead_label_id: null });
  });

  it('"mesmo destino da venda" manda só a chave e a roleta/responsável de venda', () => {
    const s = siteRoutingFrom(site({
      lead_routing: { rent_same_as_sale: true, sale: { roleta_config_id: 'rol-1' }, rent: {} },
    }));

    expect(siteRoutingPayload(s, tudo).lead_routing).toEqual({
      rent_same_as_sale: true, sale: { roleta_config_id: 'rol-1', default_assignee_id: null },
    });
  });

  it('locação separada manda o bloco dela; coluna sem funil vira nula', () => {
    const s = { ...siteRoutingFrom(site({ lead_routing: { rent_same_as_sale: false, sale: {}, rent: {} } })) };
    s.rent = { ...s.rent, pipeline_id: '', stage_id: 'st-velha', roleta_config_id: 'rol-2' };

    expect(siteRoutingPayload(s, tudo).lead_routing?.rent).toEqual({
      pipeline_id: null, stage_id: null, label_id: null, roleta_config_id: 'rol-2', default_assignee_id: null,
    });
  });

  it('cargo sem acesso às roletas não manda roleta nenhuma (não apaga a gravada)', () => {
    const s = siteRoutingFrom(site({ lead_routing: { rent_same_as_sale: false, sale: {}, rent: {} } }));

    const corpo = siteRoutingPayload(s, { ...tudo, roletas: null }).lead_routing;

    expect(corpo?.sale).not.toHaveProperty('roleta_config_id');
    expect(corpo?.rent).not.toHaveProperty('roleta_config_id');
    expect(corpo?.rent).toHaveProperty('pipeline_id', null);
  });
});
