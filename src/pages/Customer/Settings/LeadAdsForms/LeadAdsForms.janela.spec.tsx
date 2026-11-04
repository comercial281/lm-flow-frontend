// A janela do formulário do Meta (04/11/2026): sem o "nome do imóvel para reconhecer os formulários", sem
// `match_keyword` no Salvar, e ficha sem etapa abre e pede a etapa.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { LeadAdsFormConfig } from '@/services/leadAds/leadAdsFormsService';
import type { ItemDeCampanha, OpcaoDeIa } from '@/services/campanhas/campanhasService';

const svc = vi.hoisted(() => ({ getAll: vi.fn(), syncMetaForms: vi.fn(), update: vi.fn(), create: vi.fn() }));
vi.mock('@/services/leadAds/leadAdsFormsService', () => ({ leadAdsFormsService: svc }));
vi.mock('@/services/integrations/metaPagesService', () => ({ metaPagesService: { getAll: vi.fn().mockResolvedValue([]) } }));
vi.mock('@/services/properties/propertiesService', () => ({
  propertiesService: { list: vi.fn().mockResolvedValue({ data: [], meta: { total: 0 } }), get: vi.fn() },
}));
vi.mock('@/services/campanhas/campanhasService', () => ({ campanhasService: { escolherIa: vi.fn(), tirarIa: vi.fn() } }));
vi.mock('@/hooks/useIsSuperAdmin', () => ({ useIsSuperAdmin: () => false }));
vi.mock('@/hooks/useCan', () => ({ useCan: () => () => true }));
vi.mock('@/services/roletaConfig/roletaConfigService', async (orig) => {
  const real = await orig<typeof import('@/services/roletaConfig/roletaConfigService')>();
  return { ...real, roletaConfigService: { getAll: vi.fn().mockResolvedValue([]) } };
});
const recursos = vi.hoisted(() => ({
  labels: [], followupFlows: [], quickReplies: [], adOrigins: [], formOrigins: [],
  messageFunnels: [], conversationFunnels: [], evolutionInstances: [], loading: false,
  users: [{ id: 'u1', name: 'Ana Corretora' }],
  pipelines: [{ id: 'p1', name: 'Vendas' }],
  stagesByPipeline: { p1: [{ id: 's1', name: 'Novo' }] },
  reloadLabels: () => {}, reloadFunnels: () => {},
}));
vi.mock('@/features/flowAutomations/editores/LeadAutomationsEditors', () => ({ useAutomationResources: () => recursos }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

import LeadAdsForms from './LeadAdsForms';

const cadastro = (extra: Partial<LeadAdsFormConfig> = {}): LeadAdsFormConfig => ({
  id: 'cfg-1', form_id: 'f-1', form_name: '[03/11] [LINE PARADA INGLESA]', meta_page_id: null, page_name: null,
  pipeline_id: 'p1', pipeline_stage_id: 's1', label_ids: [], default_assignee_id: null,
  roleta_config_id: null, property_id: null, match_keyword: 'line', after_hours_message: null,
  is_active: true, created_at: '2026-10-01', ...extra,
});
const itemDaLista = (extra: Partial<ItemDeCampanha> = {}): ItemDeCampanha => ({
  key: 'form:f-1', kind: 'form', label: '[03/11] [LINE PARADA INGLESA]', form_config_id: 'cfg-1', link_id: null, keyword_rule: false,
  property_ids: [], sells_scope: null, sells_listing_kind: null, offer_condition: null, audience_intents: [], leads_count: 4,
  last_lead_at: null, ad_title: null, ad_body: null, campaign_name: null, match_kind: null, match_value: null, is_active: true,
  agents: [{ sales_agent_id: 'a1', name: 'Agente A', sales_agent_number_id: null, number_label: null, whole_number: false, note: null, kind: 'broad', reason: 'atende todo lead do funil', removable: false }],
  ...extra,
});
const opcoes: OpcaoDeIa[] = [{ sales_agent_id: 'a1', number_id: null, label: 'Agente A', serves_all: false, locked: null, enabled: true }];

beforeEach(() => {
  svc.getAll.mockReset().mockResolvedValue([cadastro()]);
  svc.syncMetaForms.mockReset().mockResolvedValue({ data: [], errors: [], ignored_leads: [] });
  svc.update.mockReset().mockImplementation(async (_id: string, d: object) => ({ ...cadastro(), ...d }));
  svc.create.mockReset().mockImplementation(async (d: object) => ({ ...cadastro({ id: 'novo-1' }), ...d }));
  toast.success.mockReset(); toast.error.mockReset();
});

// Formulário do Facebook sem ficha e sem lead fica recolhido: abre a lista e devolve o Plugar dele.
const plugarOutro = async () => {
  fireEvent.click(await screen.findByRole('button', { name: /formulário.* no Facebook, ainda sem ficha/ }));
  return screen.findByRole('button', { name: /^Plugar/ });
};

const abrir = async (itens: ItemDeCampanha[] = [itemDaLista()]) => {
  render(<MemoryRouter><LeadAdsForms campanhas={{ itens, listaPronta: true, opcoesDeIa: opcoes, aoMudar: vi.fn() }} /></MemoryRouter>);
  fireEvent.click(await screen.findByTitle('Editar'));
  return screen.findByRole('dialog');
};

describe('Formulários do Meta · janela da campanha', () => {
  it('não existe mais o "nome do imóvel para reconhecer os formulários" nem o grupo Como identificar', async () => {
    const dialogo = await abrir();
    expect(within(dialogo).queryByLabelText(/Nome do imóvel para reconhecer os formulários/)).toBeNull();
    expect(within(dialogo).queryByRole('group', { name: 'Como identificar' })).toBeNull();
    for (const nome of ['Para onde vai', 'Quem assume', 'Complemento', 'Estado', 'Quem atende']) {
      expect(within(dialogo).getByRole('group', { name: nome })).toBeInTheDocument();
    }
  });

  it('Salvar não manda match_keyword, mesmo com a ficha tendo uma palavra gravada', async () => {
    const dialogo = await abrir();
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(svc.update).toHaveBeenCalled());
    expect(svc.update.mock.calls[0][1]).not.toHaveProperty('match_keyword');
  });

  it('ficha sem etapa: a janela abre, Quem atende aparece e Salvar pede a etapa sem gravar', async () => {
    svc.getAll.mockResolvedValue([cadastro({ pipeline_stage_id: null })]);
    const dialogo = await abrir();
    expect(within(dialogo).getByRole('group', { name: 'Quem atende' })).toBeInTheDocument();
    expect(within(dialogo).getByText('Atende todo lead do funil')).toBeInTheDocument();
    expect(within(dialogo).getByLabelText(/Etapa/)).toHaveValue('');
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Selecione uma etapa'));
    expect(svc.update).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('ficha sem funil nem etapa também abre e pede o funil', async () => {
    svc.getAll.mockResolvedValue([cadastro({ pipeline_id: null, pipeline_stage_id: null })]);
    const dialogo = await abrir([itemDaLista({ agents: [] })]);
    expect(within(dialogo).getByText('Sem IA')).toBeInTheDocument();
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Selecione um funil'));
  });

  it('formulário novo: Criar manda a ficha sem match_keyword', async () => {
    svc.getAll.mockResolvedValue([]);
    svc.syncMetaForms.mockResolvedValue({ data: [{ id: 'f-2', name: '05/10 - ALMA', status: 'ACTIVE', leads_count: 3 }], errors: [], ignored_leads: [] });
    render(<MemoryRouter><LeadAdsForms /></MemoryRouter>);
    fireEvent.click(await plugarOutro());
    const dialogo = await screen.findByRole('dialog');
    fireEvent.change(within(dialogo).getByLabelText(/Funil/), { target: { value: 'p1' } });
    fireEvent.change(await within(dialogo).findByLabelText(/Etapa/), { target: { value: 's1' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Criar' }));
    await waitFor(() => expect(svc.create).toHaveBeenCalled());
    expect(svc.create.mock.calls[0][0]).toMatchObject({ form_id: 'f-2', form_name: '05/10 - ALMA', pipeline_id: 'p1', pipeline_stage_id: 's1' });
    expect(svc.create.mock.calls[0][0]).not.toHaveProperty('match_keyword');
  });

  it('o resumo do rodapé sempre diz o mesmo que os campos de funil e etapa', async () => {
    svc.getAll.mockResolvedValue([]);
    svc.syncMetaForms.mockResolvedValue({ data: [{ id: 'f-2', name: '05/10 - ALMA', status: 'ACTIVE', leads_count: 3 }], errors: [], ignored_leads: [] });
    render(<MemoryRouter><LeadAdsForms /></MemoryRouter>);
    fireEvent.click(await plugarOutro());
    const dialogo = await screen.findByRole('dialog');
    const rodape = () => within(dialogo).getByTestId('resumo-do-rodape');
    // sem funil: o campo mostra o convite e o rodapé não afirma funil nenhum
    expect(within(dialogo).getByLabelText(/Funil/)).toHaveValue('');
    expect(within(dialogo).queryByLabelText(/Etapa/)).toBeNull();
    expect(rodape()).toHaveTextContent('Funil ainda não escolhido');
    expect(rodape()).not.toHaveTextContent('Vendas');
    // funil sem etapa
    fireEvent.change(within(dialogo).getByLabelText(/Funil/), { target: { value: 'p1' } });
    expect(rodape()).toHaveTextContent('Vendas (falta a etapa)');
    // funil e etapa
    fireEvent.change(await within(dialogo).findByLabelText(/Etapa/), { target: { value: 's1' } });
    expect(rodape()).toHaveTextContent('Vendas > Novo');
    // volta o funil pra nada: some a etapa e o rodapé acompanha
    fireEvent.change(within(dialogo).getByLabelText(/Funil/), { target: { value: '' } });
    expect(within(dialogo).queryByLabelText(/Etapa/)).toBeNull();
    expect(rodape()).toHaveTextContent('Funil ainda não escolhido');
  });

  it('Copiar a configuração leva funil, etapa, etiquetas e quem assume ao que o Criar manda, sem mexer na identidade do formulário', async () => {
    recursos.labels = [{ id: 'l1', title: 'Castelo' }] as never;
    svc.getAll.mockResolvedValue([cadastro({
      id: 'cfg-o', form_id: 'f-o', form_name: '[06/10] [CASTELO]', label_ids: ['l1'], default_assignee_id: 'u1', pipeline_id: 'p1', pipeline_stage_id: 's1',
    })]);
    svc.syncMetaForms.mockResolvedValue({ data: [{ id: 'f-2', name: '[03/11] [CASTELO 2.0]', status: 'ACTIVE', leads_count: 3, meta_page_id: 'pg-2' }], errors: [], ignored_leads: [] });
    render(<MemoryRouter><LeadAdsForms /></MemoryRouter>);
    fireEvent.click(await plugarOutro());
    const dialogo = await screen.findByRole('dialog');
    fireEvent.click(await within(dialogo).findByRole('button', { name: 'Copiar a configuração' }));
    await waitFor(() => expect(within(dialogo).getByLabelText(/Funil/)).toHaveValue('p1'));
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Criar' }));
    await waitFor(() => expect(svc.create).toHaveBeenCalled());
    expect(svc.create.mock.calls[0][0]).toMatchObject({
      form_id: 'f-2', form_name: '[03/11] [CASTELO 2.0]', meta_page_id: 'pg-2',
      pipeline_id: 'p1', pipeline_stage_id: 's1', label_ids: ['l1'], default_assignee_id: 'u1', roleta_config_id: null,
    });
    recursos.labels = [];
  });
});
