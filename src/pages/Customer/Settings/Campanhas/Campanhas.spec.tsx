// Configurações > Campanhas (Tarefa 77): as duas partes, a linha, o aviso do topo e o "Ver como" por cargo.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ItemDeCampanha } from '@/services/campanhas/campanhasService';
import type { LeadAdsFormConfig } from '@/services/leadAds/leadAdsFormsService';

const camp = vi.hoisted(() => ({ lista: vi.fn(), opcoesDeIa: vi.fn() }));
vi.mock('@/services/campanhas/campanhasService', () => ({ campanhasService: camp }));
const svc = vi.hoisted(() => ({ getAll: vi.fn(), syncMetaForms: vi.fn(), update: vi.fn(), create: vi.fn(), delete: vi.fn() }));
vi.mock('@/services/leadAds/leadAdsFormsService', () => ({ leadAdsFormsService: svc }));
vi.mock('@/services/integrations/metaPagesService', () => ({ metaPagesService: { getAll: vi.fn().mockResolvedValue([]) } }));
vi.mock('@/services/properties/propertiesService', () => ({
  propertiesService: {
    list: vi.fn().mockResolvedValue({ data: [{ id: 'p1', title: 'Residencial Teste', code: 'AB01' }] }),
    get: vi.fn().mockResolvedValue({ id: 'p1', title: 'Residencial Teste', code: 'AB01' }),
  },
}));
vi.mock('@/hooks/useIsSuperAdmin', () => ({ useIsSuperAdmin: () => false }));
vi.mock('@/services/roletaConfig/roletaConfigService', async (orig) => {
  const real = await orig<typeof import('@/services/roletaConfig/roletaConfigService')>();
  return { ...real, roletaConfigService: { getAll: vi.fn().mockResolvedValue([]) } };
});
const recursos = vi.hoisted(() => ({
  labels: [], followupFlows: [], quickReplies: [], adOrigins: [], formOrigins: [], messageFunnels: [], conversationFunnels: [],
  evolutionInstances: [], loading: false, users: [], pipelines: [{ id: 'p1', name: 'Vendas' }], stagesByPipeline: { p1: [{ id: 's1', name: 'Novo' }] },
  reloadLabels: () => {}, reloadFunnels: () => {},
}));
vi.mock('@/features/flowAutomations/editores/LeadAutomationsEditors', () => ({ useAutomationResources: () => recursos }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const cargo = vi.hoisted(() => ({ chaves: new Set<string>() }));
vi.mock('@/hooks/useCan', () => ({ useCan: () => (r: string, a: string) => cargo.chaves.has(`${r}.${a}`) }));

import Campanhas from './Campanhas';

const ADMIN = ['lead_ads_form_configs.read', 'lead_ads_form_configs.create', 'lead_ads_form_configs.update', 'lead_ads_form_configs.delete', 'campaign_links.read', 'campaign_links.create', 'campaign_links.update'];
const GERENTE = ADMIN.filter((k) => k !== 'lead_ads_form_configs.delete');

const ficha = (extra: Partial<LeadAdsFormConfig> = {}): LeadAdsFormConfig => ({
  id: 'cfg-1', form_id: 'f-1', form_name: 'Formulário Teste', meta_page_id: null, page_name: null, pipeline_id: 'p1', pipeline_stage_id: 's1',
  label_ids: [], default_assignee_id: null, roleta_config_id: null, property_id: null, match_keyword: null, after_hours_message: null,
  is_active: true, created_at: '2026-10-01', ...extra,
});
const item = (extra: Partial<ItemDeCampanha> = {}): ItemDeCampanha => ({
  key: 'form:f-1', kind: 'form', label: 'Formulário Teste', form_config_id: 'cfg-1', link_id: null, keyword_rule: false, property_ids: ['p1'],
  sells_scope: 'properties', sells_listing_kind: null, offer_condition: null, audience_intents: [], leads_count: 12, last_lead_at: new Date().toISOString(),
  ad_title: null, ad_body: null, campaign_name: 'Campanha A', match_kind: null, match_value: null, is_active: true,
  agents: [{ sales_agent_id: 'a1', name: 'Agente A', sales_agent_number_id: null, number_label: null, whole_number: false, note: null }], ...extra,
});
const anuncio = (extra: Partial<ItemDeCampanha> = {}): ItemDeCampanha => item({
  key: 'campaign:Campanha B', kind: 'campaign', label: 'Campanha B', form_config_id: null, property_ids: [], sells_scope: null, leads_count: 7,
  campaign_name: 'Campanha B', match_kind: 'campaign', match_value: 'Campanha B', agents: [], ...extra,
});

const tela = () => render(<MemoryRouter><Campanhas /></MemoryRouter>);

beforeEach(() => {
  cargo.chaves = new Set(ADMIN);
  camp.lista.mockReset().mockResolvedValue([item(), anuncio()]);
  camp.opcoesDeIa.mockReset().mockResolvedValue([{ sales_agent_id: 'a1', number_id: null, label: 'Agente A', serves_all: false, locked: null, enabled: true }]);
  svc.getAll.mockReset().mockResolvedValue([ficha()]);
  svc.syncMetaForms.mockReset().mockResolvedValue({ data: [], errors: [], ignored_leads: [] });
  svc.delete.mockReset();
});

describe('Campanhas', () => {
  it('tem as duas partes: Formulários do Meta e Anúncios de WhatsApp', async () => {
    tela();
    expect(await screen.findByRole('heading', { name: 'Formulários do Meta' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Anúncios de WhatsApp' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Campanhas' })).toBeInTheDocument();
  });

  it('a linha do formulário mostra leads, o que vende, a condição ("A do imóvel" quando vazia) e qual IA atende', async () => {
    tela();
    expect(await screen.findByText('12 leads em 90 dias')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Residencial Teste')).toBeInTheDocument());
    expect(screen.getAllByText('A do imóvel').length).toBeGreaterThan(0);
    expect(screen.getByText('Agente A')).toBeInTheDocument();
  });

  it('campanha sem linha: "Não diz o que vende" e o aviso no topo', async () => {
    tela();
    const bloco = await screen.findByTestId('anuncios-de-whatsapp');
    expect(within(bloco).getByText('Campanha B')).toBeInTheDocument();
    expect(within(bloco).getByText('Não diz o que vende')).toBeInTheDocument();
    expect(screen.getByText('1 campanha trouxe lead esta semana e não diz o que vende.')).toBeInTheDocument();
  });

  it('sem campanha parada, não tem aviso', async () => {
    camp.lista.mockResolvedValue([item(), anuncio({ sells_scope: 'catalog' })]);
    tela();
    await screen.findByText('Campanha B');
    expect(screen.queryByText(/não dizem o que vendem|não diz o que vende\./)).toBeNull();
  });

  it('lista que falha mostra Tentar de novo na parte dos anúncios', async () => {
    camp.lista.mockRejectedValueOnce(new Error('500'));
    tela();
    const botoes = await screen.findAllByRole('button', { name: 'Tentar de novo' });
    expect(botoes.length).toBeGreaterThan(0);
  });

  it('Editar um anúncio abre a janela dele', async () => {
    tela();
    fireEvent.click(await screen.findByRole('button', { name: 'Editar Campanha B' }));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText('Editar anúncio de WhatsApp')).toBeInTheDocument();
  });
});

describe('Campanhas · por cargo (Ver como)', () => {
  it('administrador vê tudo: Conectar o Meta e Excluir ficha', async () => {
    tela();
    expect(await screen.findByRole('link', { name: 'Conectar o Meta' })).toHaveAttribute('href', '/settings/facebook');
    fireEvent.click(await screen.findByTitle('Editar'));
    expect(await screen.findByRole('button', { name: 'Excluir ficha' })).toBeInTheDocument();
  });

  it('gerente edita sem "Excluir ficha" e sem "Conectar o Meta"', async () => {
    cargo.chaves = new Set(GERENTE);
    tela();
    await screen.findByRole('heading', { name: 'Formulários do Meta' });
    expect(screen.queryByRole('link', { name: 'Conectar o Meta' })).toBeNull();
    fireEvent.click(await screen.findByTitle('Editar'));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByRole('button', { name: 'Salvar' })).toBeInTheDocument();
    expect(within(dialogo).queryByRole('button', { name: 'Excluir ficha' })).toBeNull();
  });

  it('corretor cai no NoAccessState e nada é pedido ao servidor', async () => {
    cargo.chaves = new Set();
    tela();
    expect(await screen.findByRole('status')).toHaveTextContent(/permiss|acesso/i);
    expect(camp.lista).not.toHaveBeenCalled();
    expect(svc.getAll).not.toHaveBeenCalled();
    expect(screen.queryByRole('heading', { name: 'Formulários do Meta' })).toBeNull();
  });

  it('só leitura: o botão vira "Ver" e a janela não tem Salvar', async () => {
    cargo.chaves = new Set(['campaign_links.read', 'lead_ads_form_configs.read']);
    tela();
    fireEvent.click(await screen.findByRole('button', { name: 'Ver Campanha B' }));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).queryByRole('button', { name: 'Salvar' })).toBeNull();
  });
});

describe('Menu e endereço', () => {
  it('o endereço /automations/origem renderiza Campanhas', async () => {
    const { default: Origem } = await import('@/pages/Customer/Automations/Origem/Origem');
    render(<MemoryRouter><Origem /></MemoryRouter>);
    expect(await screen.findByRole('heading', { level: 1, name: 'Campanhas' })).toBeInTheDocument();
  });
});
