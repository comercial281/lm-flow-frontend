// Configurações > Campanhas (Tarefa 77): as duas partes, a linha, o aviso do topo e o "Ver como" por cargo.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ItemDeCampanha } from '@/services/campanhas/campanhasService';
import type { IgnoredLeadForm, LeadAdsFormConfig } from '@/services/leadAds/leadAdsFormsService';

const camp = vi.hoisted(() => ({ lista: vi.fn(), opcoesDeIa: vi.fn(), criarLinha: vi.fn(), atualizarLinha: vi.fn(), escolherIa: vi.fn(), tirarIa: vi.fn(), condicaoDoTexto: vi.fn() }));
vi.mock('@/services/campanhas/campanhasService', () => ({ campanhasService: camp }));
const svc = vi.hoisted(() => ({ getAll: vi.fn(), syncMetaForms: vi.fn(), update: vi.fn(), create: vi.fn(), delete: vi.fn() }));
vi.mock('@/services/leadAds/leadAdsFormsService', () => ({ leadAdsFormsService: svc }));
const paginas = vi.hoisted(() => ({ getAll: vi.fn(), update: vi.fn() }));
vi.mock('@/services/integrations/metaPagesService', () => ({ metaPagesService: paginas }));
vi.mock('@/services/properties/propertiesService', () => ({
  propertiesService: {
    list: vi.fn().mockResolvedValue({ data: [{ id: 'p1', title: 'Residencial Teste', code: 'AB01' }] }),
    get: vi.fn().mockResolvedValue({ id: 'p1', title: 'Residencial Teste', code: 'AB01' }),
  },
}));
const sup = vi.hoisted(() => ({ valor: false }));
vi.mock('@/hooks/useIsSuperAdmin', () => ({ useIsSuperAdmin: () => sup.valor }));
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
  sup.valor = false;
  paginas.getAll.mockReset().mockResolvedValue([]);
  paginas.update.mockReset().mockResolvedValue({});
  cargo.chaves = new Set(ADMIN);
  camp.lista.mockReset().mockResolvedValue([item(), anuncio()]);
  camp.opcoesDeIa.mockReset().mockResolvedValue([{ sales_agent_id: 'a1', number_id: null, label: 'Agente A', serves_all: false, locked: null, enabled: true }]);
  svc.getAll.mockReset().mockResolvedValue([ficha()]);
  svc.syncMetaForms.mockReset().mockResolvedValue({ data: [], errors: [], ignored_leads: [] });
  svc.delete.mockReset();
  svc.create.mockReset();
  svc.update.mockReset();
});

describe('Campanhas', () => {
  it('tem as duas partes: Formulários do Meta e Anúncios de WhatsApp', async () => {
    tela();
    expect(await screen.findByRole('heading', { name: 'Formulários do Meta' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Anúncios de WhatsApp' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Campanhas' })).toBeInTheDocument();
  });

  it('a linha do formulário mostra imóvel, leads em 90 dias, quem atende e a data do último lead', async () => {
    tela();
    const linha = await screen.findByTestId('linha-do-formulario');
    expect(within(linha).getByText('12 leads')).toBeInTheDocument();
    await waitFor(() => expect(within(linha).getByText('Residencial Teste')).toBeInTheDocument());
    expect(within(linha).getByText('Agente A')).toBeInTheDocument();
    expect(within(linha).getByText('Vendas → Novo')).toBeInTheDocument();
    expect(within(linha).getByText('Último lead agora')).toBeInTheDocument();
  });

  it('a página usa a largura toda (sem o estreita de max-w-4xl)', async () => {
    const { container } = tela();
    await screen.findByRole('heading', { name: 'Formulários do Meta' });
    expect(container.querySelector('.max-w-4xl')).toBeNull();
  });

  it('anúncio sem oferta: selo "Não diz o que oferece" e "Parece: <imóvel>" pelo nome; o aviso do topo não existe mais', async () => {
    tela();
    const bloco = await screen.findByTestId('anuncios-de-whatsapp');
    expect(within(bloco).getByText('Campanha B')).toBeInTheDocument();
    expect(within(bloco).getByText('Não diz o que oferece')).toBeInTheDocument();
    expect(await within(bloco).findByText('Parece: Residencial Teste')).toBeInTheDocument();
    expect(screen.queryByText(/não dizem o que vendem|não diz o que vende\./)).toBeNull();
  });

  it('clicar na linha do formulário abre a janela dele', async () => {
    tela();
    fireEvent.click(await screen.findByTestId('linha-do-formulario'));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByRole('button', { name: 'Salvar' })).toBeInTheDocument();
  });

  it('mexer na chave Ativo não abre a janela e grava na hora', async () => {
    svc.update.mockResolvedValue(ficha({ is_active: false }));
    tela();
    const linha = await screen.findByTestId('linha-do-formulario');
    fireEvent.click(within(linha).getByRole('switch', { name: 'Ficha ativa de Formulário Teste' }));
    await waitFor(() => expect(svc.update).toHaveBeenCalled());
    expect(svc.update.mock.calls[0][1]).toMatchObject({ is_active: false });
    expect(screen.queryByRole('dialog')).toBeNull();
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

describe('Campanhas · rodada 1', () => {
  it('escolhe a IA num anúncio sem linha, fecha, reabre e salva: a linha é criada uma vez só', async () => {
    camp.criarLinha.mockReset().mockResolvedValue({ id: 'l9' });
    camp.atualizarLinha.mockReset().mockResolvedValue({ id: 'l9' });
    camp.escolherIa.mockReset().mockResolvedValue({ ok: true, holders: [], left_empty: [], warning: null });
    tela();
    fireEvent.click(await screen.findByRole('button', { name: 'Editar Campanha B' }));
    let dialogo = await screen.findByRole('dialog');
    await waitFor(() => expect(within(dialogo).getByLabelText('Pôr numa IA')).toBeInTheDocument());
    fireEvent.change(within(dialogo).getByLabelText('Pôr numa IA'), { target: { value: 'a1|' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Pôr' }));
    await waitFor(() => expect(camp.escolherIa).toHaveBeenCalled());
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Editar Campanha B' }));
    dialogo = await screen.findByRole('dialog');
    fireEvent.click(within(dialogo).getByRole('radio', { name: 'Todo o catálogo' }));
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(camp.atualizarLinha).toHaveBeenCalled());
    expect(camp.criarLinha).toHaveBeenCalledTimes(1);
    expect(camp.atualizarLinha.mock.calls[0][0]).toBe('l9');
  });

  it('lista que falha: o cartão do formulário não afirma "0 leads" nem "Nenhuma" IA', async () => {
    camp.lista.mockRejectedValue(new Error('500'));
    tela();
    expect(await screen.findByText(/Não deu pra carregar o resumo das campanhas/)).toBeInTheDocument();
    expect(screen.queryByText(/0 leads em 90 dias/)).toBeNull();
    expect(screen.queryByText('Nenhuma')).toBeNull();
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

const barrado = (extra: Partial<IgnoredLeadForm> = {}): IgnoredLeadForm => ({
  form_id: 'f-9', form_name: '[03/11] [CASTELO 2.0]', page_id: 'pg-1', lead_count: 5, recent_count: 3, last_lead_at: new Date().toISOString(), ...extra,
});
const comBarrados = (ignored_leads: IgnoredLeadForm[], extra: object = {}) =>
  svc.syncMetaForms.mockResolvedValue({ data: [], errors: [], ignored_leads, ...extra });

describe('Campanhas · Pra resolver', () => {
  it('sem lead barrado, o bloco nem existe', async () => {
    tela();
    await screen.findByRole('heading', { name: 'Formulários do Meta' });
    await waitFor(() => expect(svc.syncMetaForms).toHaveBeenCalled());
    expect(screen.queryByText('Pra resolver')).toBeNull();
  });

  it('lista só o formulário barrado, com a contagem, o texto dos 2 dias e a separação do que só entra por importação', async () => {
    comBarrados([barrado()]);
    tela();
    const bloco = await screen.findByTestId('pra-resolver');
    expect(within(bloco).getByText('[03/11] [CASTELO 2.0]')).toBeInTheDocument();
    expect(within(bloco).getByText(/Plugue em até 2 dias/)).toBeInTheDocument();
    expect(within(bloco).getByText(/3 leads entram sozinhos ao plugar · 2 leads só entram por importação manual/)).toBeInTheDocument();
    expect(within(bloco).getByText('5 leads não entraram')).toBeInTheDocument();
    expect(within(bloco).queryByText('Formulário Teste')).toBeNull();
  });

  it('servidor antigo (sem recent_count): só a contagem, sem separar e sem erro', async () => {
    comBarrados([{ form_id: 'f-9', form_name: 'Antigo', page_id: 'pg-1', lead_count: 4 }]);
    tela();
    const bloco = await screen.findByTestId('pra-resolver');
    expect(within(bloco).getByText('4 leads esperando')).toBeInTheDocument();
    expect(within(bloco).queryByText(/Plugue em até 2 dias/)).toBeNull();
    expect(within(bloco).queryByText(/importação manual/)).toBeNull();
    expect(screen.queryByText(/Não foi possível/)).toBeNull();
  });

  it('só importação: recent_count 0 não promete entrada sozinha', async () => {
    comBarrados([barrado({ recent_count: 0, lead_count: 6 })]);
    tela();
    const bloco = await screen.findByTestId('pra-resolver');
    expect(within(bloco).queryByText(/Plugue em até 2 dias/)).toBeNull();
    expect(within(bloco).getByText(/6 leads esperando · Só entram por importação manual/)).toBeInTheDocument();
  });

  it('Plugar abre a janela de formulário novo; o Criar grava a ficha de verdade', async () => {
    comBarrados([barrado()]);
    svc.getAll.mockResolvedValue([]);
    camp.lista.mockResolvedValue([]);
    svc.create.mockResolvedValue(ficha({ id: 'novo', form_id: 'f-9' }));
    tela();
    fireEvent.click(await screen.findByRole('button', { name: 'Plugar [03/11] [CASTELO 2.0]' }));
    const dialogo = await screen.findByRole('dialog');
    fireEvent.change(within(dialogo).getByLabelText(/Funil/), { target: { value: 'p1' } });
    fireEvent.change(await within(dialogo).findByLabelText(/Etapa/), { target: { value: 's1' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Criar' }));
    await waitFor(() => expect(svc.create).toHaveBeenCalled());
    expect(svc.create.mock.calls[0][0]).toMatchObject({ form_id: 'f-9', form_name: '[03/11] [CASTELO 2.0]', pipeline_id: 'p1', pipeline_stage_id: 's1', is_active: true });
  });

  it('o caminho inteiro: Plugar, Copiar, Criar, IA gravada, e o formulário sai de Pra resolver (o total acompanha)', async () => {
    const origem = ficha({ id: 'cfg-o', form_id: 'f-o', form_name: '[06/10] [CASTELO]' });
    svc.getAll.mockResolvedValue([origem]);
    camp.lista.mockResolvedValue([item({
      key: 'form:f-o', label: '[06/10] [CASTELO]', form_config_id: 'cfg-o',
      agents: [{ sales_agent_id: 'a1', name: 'Agente A', sales_agent_number_id: null, number_label: null, whole_number: false, note: null, kind: 'campaign', reason: 'na lista', removable: true }],
    })]);
    comBarrados([barrado(), barrado({ form_id: 'f-8', form_name: 'Outro barrado', lead_count: 2, recent_count: 1 })]);
    svc.create.mockResolvedValue(ficha({ id: 'novo', form_id: 'f-9', form_name: '[03/11] [CASTELO 2.0]' }));
    camp.escolherIa.mockReset().mockResolvedValue({ ok: true, holders: [], left_empty: [], warning: null });
    tela();
    const bloco = await screen.findByTestId('pra-resolver');
    expect(within(bloco).getByText('7 leads não entraram')).toBeInTheDocument();
    fireEvent.click(within(bloco).getByRole('button', { name: 'Plugar [03/11] [CASTELO 2.0]' }));
    const dialogo = await screen.findByRole('dialog');
    fireEvent.click(await within(dialogo).findByRole('button', { name: 'Copiar a configuração' }));
    await waitFor(() => expect(within(dialogo).getByLabelText(/Funil/)).toHaveValue('p1'));
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Criar' }));
    await waitFor(() => expect(svc.create).toHaveBeenCalled());
    expect(svc.create.mock.calls[0][0]).toMatchObject({ form_id: 'f-9', pipeline_id: 'p1', pipeline_stage_id: 's1' });
    await waitFor(() => expect(camp.escolherIa).toHaveBeenCalledWith({ ref: { kind: 'form', id: 'f-9' }, sales_agent_id: 'a1', number_id: null }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const depois = screen.getByTestId('pra-resolver');
    expect(within(depois).queryByText('[03/11] [CASTELO 2.0]')).toBeNull();
    expect(within(depois).getByText('Outro barrado')).toBeInTheDocument();
    expect(within(depois).getByText('2 leads não entraram')).toBeInTheDocument();
  });

  it('plugado o único barrado, o quadro inteiro some (sem recarregar)', async () => {
    comBarrados([barrado()]);
    svc.getAll.mockResolvedValue([]);
    camp.lista.mockResolvedValue([]);
    svc.create.mockResolvedValue(ficha({ id: 'novo', form_id: 'f-9' }));
    tela();
    fireEvent.click(await screen.findByRole('button', { name: 'Plugar [03/11] [CASTELO 2.0]' }));
    const dialogo = await screen.findByRole('dialog');
    fireEvent.change(within(dialogo).getByLabelText(/Funil/), { target: { value: 'p1' } });
    fireEvent.change(await within(dialogo).findByLabelText(/Etapa/), { target: { value: 's1' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Criar' }));
    await waitFor(() => expect(screen.queryByTestId('pra-resolver')).toBeNull());
  });

  it('ficha de OUTRA página não destrava o lead: o formulário segue em Pra resolver', async () => {
    paginas.getAll.mockResolvedValue([
      { id: 'mp1', page_id: 'pg-1', page_name: 'Página Um', is_active: true, accept_unconfigured_forms: false },
      { id: 'mp2', page_id: 'pg-2', page_name: 'Página Dois', is_active: true, accept_unconfigured_forms: false },
    ]);
    svc.getAll.mockResolvedValue([ficha({ id: 'cfg-x', form_id: 'f-9', form_name: 'Mesmo id, outra página', meta_page_id: 'mp2', is_active: true })]);
    camp.lista.mockResolvedValue([]);
    comBarrados([barrado()]);
    tela();
    const bloco = await screen.findByTestId('pra-resolver');
    await waitFor(() => expect(paginas.getAll).toHaveBeenCalled());
    expect(within(bloco).getByText('[03/11] [CASTELO 2.0]')).toBeInTheDocument();
  });

  it('ficha ativa da MESMA página (ou sem página) tira o formulário de Pra resolver', async () => {
    paginas.getAll.mockResolvedValue([{ id: 'mp1', page_id: 'pg-1', page_name: 'Página Um', is_active: true, accept_unconfigured_forms: false }]);
    svc.getAll.mockResolvedValue([ficha({ id: 'cfg-x', form_id: 'f-9', meta_page_id: 'mp1', is_active: true })]);
    camp.lista.mockResolvedValue([]);
    comBarrados([barrado()]);
    tela();
    await screen.findByTestId('linha-do-formulario');
    await waitFor(() => expect(svc.syncMetaForms).toHaveBeenCalled());
    await waitFor(() => expect(paginas.getAll).toHaveBeenCalled());
    expect(screen.queryByTestId('pra-resolver')).toBeNull();
  });

  it('ligar a ficha desligada pela chave da tabela tira o formulário de Pra resolver', async () => {
    svc.getAll.mockResolvedValue([ficha({ id: 'cfg-off', form_id: 'f-off', form_name: 'Inativo antigo', is_active: false })]);
    camp.lista.mockResolvedValue([]);
    comBarrados([barrado({ form_id: 'f-off', form_name: 'Inativo antigo' })]);
    svc.update.mockResolvedValue(ficha({ id: 'cfg-off', form_id: 'f-off', form_name: 'Inativo antigo', is_active: true }));
    tela();
    const bloco = await screen.findByTestId('pra-resolver');
    expect(within(bloco).getByText('Ficha desligada')).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('switch', { name: 'Ficha ativa de Inativo antigo' }));
    await waitFor(() => expect(svc.update).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByTestId('pra-resolver')).toBeNull());
  });

  it('Plugar numa ficha desligada abre já com Ativo marcado e o aviso de que ela liga ao salvar; Salvar manda is_active true', async () => {
    svc.getAll.mockResolvedValue([ficha({ id: 'cfg-off', form_id: 'f-off', form_name: 'Inativo antigo', is_active: false })]);
    camp.lista.mockResolvedValue([]);
    comBarrados([barrado({ form_id: 'f-off', form_name: 'Inativo antigo' })]);
    svc.update.mockResolvedValue(ficha({ id: 'cfg-off', form_id: 'f-off', form_name: 'Inativo antigo', is_active: true }));
    tela();
    const bloco = await screen.findByTestId('pra-resolver');
    fireEvent.click(within(bloco).getByRole('button', { name: 'Plugar Inativo antigo' }));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText('Esta ficha estava desligada. Ao salvar, ela liga de novo.')).toBeInTheDocument();
    expect(within(dialogo).getByRole('checkbox', { name: 'Ativo' })).toBeChecked();
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(svc.update).toHaveBeenCalled());
    expect(svc.update.mock.calls[0][1]).toMatchObject({ is_active: true });
  });

  it('se a pessoa desmarca Ativo depois de Plugar, o aviso some (não promete ligar)', async () => {
    svc.getAll.mockResolvedValue([ficha({ id: 'cfg-off', form_id: 'f-off', form_name: 'Inativo antigo', is_active: false })]);
    camp.lista.mockResolvedValue([]);
    comBarrados([barrado({ form_id: 'f-off', form_name: 'Inativo antigo' })]);
    tela();
    fireEvent.click(await screen.findByRole('button', { name: 'Plugar Inativo antigo' }));
    const dialogo = await screen.findByRole('dialog');
    fireEvent.click(within(dialogo).getByRole('checkbox', { name: 'Ativo' }));
    expect(within(dialogo).queryByText(/Esta ficha estava desligada/)).toBeNull();
  });

  it('Editar pela linha da tabela não muda nada: a ficha desligada abre desligada, sem aviso', async () => {
    svc.getAll.mockResolvedValue([ficha({ id: 'cfg-off', form_id: 'f-off', form_name: 'Inativo antigo', is_active: false })]);
    camp.lista.mockResolvedValue([]);
    tela();
    fireEvent.click(await screen.findByTitle('Editar'));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByRole('checkbox', { name: 'Ativo' })).not.toBeChecked();
    expect(within(dialogo).queryByText(/Esta ficha estava desligada/)).toBeNull();
  });

  it('formulário que já tem ficha desligada: mostra "Ficha desligada" e Plugar abre ESSA ficha, sem criar outra', async () => {
    svc.getAll.mockResolvedValue([ficha({ id: 'cfg-off', form_id: 'f-off', form_name: 'Inativo antigo', is_active: false })]);
    camp.lista.mockResolvedValue([]);
    comBarrados([barrado({ form_id: 'f-off', form_name: 'Inativo antigo' })]);
    tela();
    const bloco = await screen.findByTestId('pra-resolver');
    expect(within(bloco).getByText('Ficha desligada')).toBeInTheDocument();
    fireEvent.click(within(bloco).getByRole('button', { name: 'Plugar Inativo antigo' }));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByRole('button', { name: 'Salvar' })).toBeInTheDocument();
    expect(within(dialogo).queryByRole('button', { name: 'Criar' })).toBeNull();
    expect(svc.create).not.toHaveBeenCalled();
  });

  it('Facebook lento: as tabelas aparecem na hora e Pra resolver chega depois, sem erro no meio da tela', async () => {
    let chegou: (v: unknown) => void = () => undefined;
    svc.syncMetaForms.mockReturnValue(new Promise((r) => { chegou = r; }));
    tela();
    expect(await screen.findByTestId('linha-do-formulario')).toBeInTheDocument();
    expect(await screen.findByTestId('anuncios-de-whatsapp')).toBeInTheDocument();
    expect(screen.queryByTestId('pra-resolver')).toBeNull();
    expect(screen.queryByText(/Não foi possível|Não deu pra/)).toBeNull();
    chegou({ data: [], errors: [], ignored_leads: [barrado()] });
    expect(await screen.findByTestId('pra-resolver')).toBeInTheDocument();
  });

  it('Facebook fora: as tabelas seguem, Pra resolver não aparece e a mensagem de erro de hoje continua', async () => {
    svc.syncMetaForms.mockResolvedValue({ data: [], errors: [], error: 'Token expirado', ignored_leads: [] });
    tela();
    expect(await screen.findByText('Não foi possível carregar os formulários da Meta')).toBeInTheDocument();
    expect(screen.getByText('Token expirado')).toBeInTheDocument();
    expect(screen.getByTestId('linha-do-formulario')).toBeInTheDocument();
    expect(screen.queryByTestId('pra-resolver')).toBeNull();
  });

  it('sync que rejeita: silêncio, a tela segue só com as tabelas', async () => {
    svc.syncMetaForms.mockRejectedValue(new Error('timeout'));
    tela();
    expect(await screen.findByTestId('linha-do-formulario')).toBeInTheDocument();
    await waitFor(() => expect(svc.syncMetaForms).toHaveBeenCalled());
    expect(screen.queryByTestId('pra-resolver')).toBeNull();
    expect(screen.queryByText(/Não foi possível carregar os formulários/)).toBeNull();
  });

  it('a chave de super-admin "Receber leads de qualquer formulário desta página" fica dentro de Pra resolver', async () => {
    sup.valor = true;
    paginas.getAll.mockResolvedValue([{ id: 'mp1', page_id: 'pg-1', page_name: 'Página Um', is_active: true, accept_unconfigured_forms: false }]);
    comBarrados([barrado()]);
    tela();
    const bloco = await screen.findByTestId('pra-resolver');
    expect(await within(bloco).findByRole('button', { name: 'Receber leads de qualquer formulário desta página' })).toBeInTheDocument();
  });

  it('quem não é super-admin não vê a chave', async () => {
    paginas.getAll.mockResolvedValue([{ id: 'mp1', page_id: 'pg-1', page_name: 'Página Um', is_active: true, accept_unconfigured_forms: false }]);
    comBarrados([barrado()]);
    tela();
    const bloco = await screen.findByTestId('pra-resolver');
    expect(within(bloco).queryByRole('button', { name: /Receber leads de qualquer formulário/ })).toBeNull();
  });
});

describe('Campanhas · recolhidos e lista que não chegou', () => {
  it('formulário do Facebook sem ficha e sem lead fica recolhido, com Plugar depois de abrir', async () => {
    svc.syncMetaForms.mockResolvedValue({ data: [{ id: 'f-77', name: 'Sem lead ainda', status: 'ACTIVE', leads_count: 0 }], errors: [], ignored_leads: [] });
    tela();
    const abrir = await screen.findByRole('button', { name: /1 outro formulário no Facebook, ainda sem ficha/ });
    expect(abrir).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Sem lead ainda')).toBeNull();
    fireEvent.click(abrir);
    expect(await screen.findByText('Sem lead ainda')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Plugar Sem lead ainda' })).toBeInTheDocument();
  });

  it('formulário barrado aparece em Pra resolver e NÃO se repete nos recolhidos', async () => {
    svc.syncMetaForms.mockResolvedValue({ data: [{ id: 'f-9', name: '[03/11] [CASTELO 2.0]', status: 'ACTIVE', leads_count: 5 }], errors: [], ignored_leads: [barrado()] });
    tela();
    await screen.findByTestId('pra-resolver');
    expect(screen.queryByRole('button', { name: /ainda sem ficha/ })).toBeNull();
  });

  it('anúncio sem nome de campanha fica recolhido ao fim', async () => {
    camp.lista.mockResolvedValue([item(), anuncio(), anuncio({ key: 'ad:99', kind: 'ad', label: 'Anúncio 99', campaign_name: null, ad_title: null, match_kind: 'ad', match_value: '99' })]);
    tela();
    await screen.findByText('Campanha B');
    expect(screen.queryByText('Anúncio 99')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /1 anúncio sem nome de campanha/ }));
    expect(await screen.findByText('Anúncio 99')).toBeInTheDocument();
  });

  it('lista do servidor demorando: nem "0 leads" nem "Sem IA" na linha do formulário', async () => {
    camp.lista.mockReturnValue(new Promise(() => undefined));
    tela();
    const linha = await screen.findByTestId('linha-do-formulario');
    expect(within(linha).queryByText(/0 leads/)).toBeNull();
    expect(within(linha).queryByText('Sem IA')).toBeNull();
  });
});

describe('Menu e endereço', () => {
  it('o endereço /automations/origem renderiza Campanhas', async () => {
    const { default: Origem } = await import('@/pages/Customer/Automations/Origem/Origem');
    render(<MemoryRouter><Origem /></MemoryRouter>);
    expect(await screen.findByRole('heading', { level: 1, name: 'Campanhas' })).toBeInTheDocument();
  });
});

describe('Campanhas · botões que dependem de ser super-admin e de permissão', () => {
  it('quem não é super-admin não vê Diagnosticar, Importar nem Limpar etiquetas', async () => {
    tela();
    await screen.findByRole('heading', { name: 'Formulários do Meta' });
    expect(screen.queryByRole('button', { name: /Diagnosticar conexão/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Importar leads recentes/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Limpar etiquetas antigas/ })).toBeNull();
  });

  it('super-admin vê os três', async () => {
    sup.valor = true;
    tela();
    expect(await screen.findByRole('button', { name: /Diagnosticar conexão/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Importar leads recentes/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Limpar etiquetas antigas/ })).toBeInTheDocument();
  });

  it('em Pra resolver, quem não é super-admin lê "peça pro suporte da LM"; super-admin não', async () => {
    comBarrados([barrado()]);
    const { unmount } = tela();
    const bloco = await screen.findByTestId('pra-resolver');
    expect(within(bloco).getByText(/Os mais antigos só entram por importação manual: peça pro suporte da LM\./)).toBeInTheDocument();
    unmount();
    sup.valor = true;
    tela();
    const bloco2 = await screen.findByTestId('pra-resolver');
    expect(within(bloco2).queryByText(/suporte da LM/)).toBeNull();
  });

  it('sem lead_ads_form_configs.create, Plugar não aparece em Pra resolver nem nos outros formulários', async () => {
    cargo.chaves = new Set(ADMIN.filter((k) => k !== 'lead_ads_form_configs.create'));
    svc.syncMetaForms.mockResolvedValue({ data: [{ id: 'f-77', name: 'Sem lead ainda', status: 'ACTIVE', leads_count: 0 }], errors: [], ignored_leads: [barrado()] });
    tela();
    const bloco = await screen.findByTestId('pra-resolver');
    expect(within(bloco).queryByRole('button', { name: /^Plugar/ })).toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: /ainda sem ficha/ }));
    expect(await screen.findByText('Sem lead ainda')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Plugar Sem lead ainda' })).toBeNull();
  });
});

describe('Campanhas · lista e subtítulo', () => {
  it('leitura antiga da lista não sobrescreve a nova', async () => {
    let soltaVelha: (v: unknown) => void = () => undefined;
    camp.lista.mockReset();
    camp.lista.mockImplementationOnce(() => new Promise((r) => { soltaVelha = r; }));
    camp.lista.mockResolvedValueOnce([item({ leads_count: 99 }), anuncio()]);
    svc.update.mockResolvedValue(ficha({ is_active: false }));
    tela();
    const chave = await screen.findByRole('switch', { name: 'Ficha ativa de Formulário Teste' });
    fireEvent.click(chave); // muda algo: pede a lista de novo (a 2ª, rápida)
    await waitFor(() => expect(camp.lista).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('99 leads')).toBeInTheDocument();
    await act(async () => { soltaVelha([item({ leads_count: 1 }), anuncio()]); });
    expect(screen.getByText('99 leads')).toBeInTheDocument();
    expect(screen.queryByText('1 lead')).toBeNull();
  });

  it('o subtítulo é uma linha só, sem a explicação de Pra resolver', async () => {
    tela();
    await screen.findByRole('heading', { level: 1, name: 'Campanhas' });
    expect(screen.getByText('Tudo o que trouxe lead pro LM Flow nos últimos 90 dias.')).toBeInTheDocument();
    expect(screen.queryByText(/aparece em Pra resolver/)).toBeNull();
  });
});
