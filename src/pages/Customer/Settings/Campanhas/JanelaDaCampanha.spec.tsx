import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ItemDeCampanha, OpcaoDeIa } from '@/services/campanhas/campanhasService';
import type { LeadAdsFormConfig } from '@/services/leadAds/leadAdsFormsService';

const camp = vi.hoisted(() => ({
  criarLinha: vi.fn(), atualizarLinha: vi.fn(), condicaoDoTexto: vi.fn(), escolherIa: vi.fn(), tirarIa: vi.fn(),
}));
vi.mock('@/services/campanhas/campanhasService', () => ({ campanhasService: camp }));
const forms = vi.hoisted(() => ({ update: vi.fn(), create: vi.fn() }));
vi.mock('@/services/leadAds/leadAdsFormsService', () => ({ leadAdsFormsService: forms }));
const props = vi.hoisted(() => ({ get: vi.fn(), list: vi.fn() }));
vi.mock('@/services/properties/propertiesService', () => ({ propertiesService: props }));
const permissoes = vi.hoisted(() => ({ tem: new Set<string>() }));
vi.mock('@/hooks/useCan', () => ({ useCan: () => (r: string, a: string) => permissoes.tem.has(`${r}.${a}`) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import JanelaDaCampanha from './JanelaDaCampanha';

const IMOVEIS: Record<string, object> = {
  p1: { id: 'p1', title: 'Residencial Teste', code: 'AB01', down_payment_from: 500, installment_from: 1000, min_income: 5000, payment_terms: 'Sinal + mensais' },
  p2: { id: 'p2', title: 'Residencial Outro', code: 'AB02' },
};
for (let i = 3; i <= 12; i += 1) IMOVEIS[`p${i}`] = { id: `p${i}`, title: `Imóvel ${i}`, code: `AB${i}` };

const item = (extra: Partial<ItemDeCampanha> = {}): ItemDeCampanha => ({
  key: 'campaign:Campanha A', kind: 'campaign', label: 'Campanha A', form_config_id: null, link_id: null, keyword_rule: false,
  property_ids: [], sells_scope: null, sells_listing_kind: null, offer_condition: null, audience_intents: [], leads_count: 9,
  last_lead_at: null, ad_title: 'Anúncio Teste', ad_body: 'Entrada a partir de R$ 300. Parcelas a partir de R$ 900.',
  campaign_name: 'Campanha A', match_kind: 'campaign', match_value: 'Campanha A', is_active: true, agents: [], ...extra,
});
const ficha = (): LeadAdsFormConfig => ({
  id: 'cfg-1', form_id: 'f-1', form_name: 'Formulário Teste', meta_page_id: null, page_name: null, pipeline_id: 'p', pipeline_stage_id: 's',
  label_ids: [], default_assignee_id: null, roleta_config_id: null, property_id: null, match_keyword: null, after_hours_message: null,
  is_active: true, created_at: '2026-10-01',
});
const opcoes: OpcaoDeIa[] = [
  { sales_agent_id: 'a1', number_id: null, label: 'Agente A', serves_all: false, locked: null, enabled: true },
  { sales_agent_id: 'b1', number_id: 'n1', label: 'Agente B · Ana', serves_all: false, locked: null, enabled: true },
  { sales_agent_id: 'c1', number_id: null, label: 'Agente C', serves_all: true, locked: null, enabled: true },
];

const abrir = (extra: Partial<React.ComponentProps<typeof JanelaDaCampanha>> = {}) => {
  const aoFechar = vi.fn(); const aoSalvar = vi.fn();
  render(<JanelaDaCampanha tipo="whats" item={item()} aoFechar={aoFechar} aoSalvar={aoSalvar} {...extra} />);
  return { aoFechar, aoSalvar, dialogo: screen.getByRole('dialog') };
};

beforeEach(() => {
  Object.values(camp).forEach((f) => f.mockReset());
  Object.values(forms).forEach((f) => f.mockReset());
  props.get.mockReset().mockImplementation(async (id: string) => IMOVEIS[id]);
  props.list.mockReset().mockResolvedValue({ data: [Object.assign({}, IMOVEIS.p1), Object.assign({}, IMOVEIS.p2)] });
  permissoes.tem = new Set(['campaign_links.update', 'campaign_links.create', 'lead_ads_form_configs.update', 'lead_ads_form_configs.create']);
});

describe('JanelaDaCampanha · o que vende', () => {
  it('imóveis escolhidos: de 1 a 10, o 11º não entra', async () => {
    const dez = Array.from({ length: 10 }, (_, i) => `p${i + 1}`);
    abrir({ item: item({ sells_scope: 'properties', property_ids: dez }) });
    expect(await screen.findAllByTestId('cartao-do-imovel')).toHaveLength(10);
    expect(screen.queryByPlaceholderText('Buscar por título ou código')).toBeNull();
    expect(screen.getByText(/Chegou em 10 imóveis/)).toBeInTheDocument();
  });

  it('com 9 ainda dá pra buscar e adicionar o décimo', async () => {
    const nove = Array.from({ length: 9 }, (_, i) => `p${i + 1}`);
    abrir({ item: item({ sells_scope: 'properties', property_ids: nove }) });
    await screen.findAllByTestId('cartao-do-imovel');
    fireEvent.change(screen.getByPlaceholderText('Buscar por título ou código'), { target: { value: 'imóvel 10' } });
    props.list.mockResolvedValue({ data: [{ id: 'p10', title: 'Imóvel 10', code: 'AB10' }] });
    fireEvent.click(await screen.findByRole('button', { name: /Imóvel 10/ }));
    await waitFor(() => expect(screen.getAllByTestId('cartao-do-imovel')).toHaveLength(10));
  });

  it('um tipo inteiro pede o tipo; o catálogo inteiro explica que a IA não fixa imóvel', async () => {
    abrir({ item: item({ sells_scope: 'properties', property_ids: ['p1'] }) });
    fireEvent.click(screen.getByRole('radio', { name: 'Um tipo inteiro' }));
    expect(screen.getByLabelText('Tipo')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Todo o catálogo' }));
    expect(screen.getByText(/não fixa imóvel/)).toBeInTheDocument();
  });

  it('com 2 ou mais imóveis, a conversa começa sem imóvel fixo (e no formulário, o card só nasce quando a pessoa escolhe)', async () => {
    abrir({ tipo: 'form', config: ficha(), item: item({ kind: 'form', form_config_id: 'cfg-1', sells_scope: 'properties', property_ids: ['p1', 'p2'] }) });
    expect(await screen.findByText(/a conversa começa sem imóvel fixo/)).toBeInTheDocument();
    expect(screen.getByText(/imóvel de interesse do card só nasce quando a pessoa escolhe/)).toBeInTheDocument();
  });

  it('sem tipo e sem imóvel diz que ainda não diz', () => {
    abrir();
    expect(screen.getByText(/Ainda não diz/)).toBeInTheDocument();
  });
});

describe('JanelaDaCampanha · condição', () => {
  it('com um imóvel só, a dica dos campos é a condição dele', async () => {
    abrir({ item: item({ sells_scope: 'properties', property_ids: ['p1'] }) });
    await waitFor(() => expect(screen.getByLabelText('Entrada a partir de')).toHaveAttribute('placeholder', 'Do imóvel: R$ 500'));
    expect(screen.getByLabelText('Renda mínima')).toHaveAttribute('placeholder', 'Do imóvel: R$ 5.000');
  });

  it('com 2 ou mais, a dica diz que vale a de cada imóvel', async () => {
    abrir({ item: item({ sells_scope: 'properties', property_ids: ['p1', 'p2'] }) });
    expect(screen.getByLabelText('Entrada a partir de')).toHaveAttribute('placeholder', 'Vazio: vale a de cada imóvel');
  });

  it('a observação vai até 300 caracteres', () => {
    abrir();
    expect(screen.getByLabelText('Observação do anúncio')).toHaveAttribute('maxlength', '300');
  });

  it('"Preencher com o texto do anúncio" só existe no anúncio de WhatsApp', () => {
    abrir();
    expect(screen.getByRole('button', { name: 'Preencher com o texto do anúncio' })).toBeInTheDocument();
  });

  it('no formulário não existe o botão de preencher com o anúncio', () => {
    abrir({ tipo: 'form', config: ficha(), item: item({ kind: 'form', form_config_id: 'cfg-1' }) });
    expect(screen.queryByRole('button', { name: 'Preencher com o texto do anúncio' })).toBeNull();
  });

  it('preencher chama o servidor com o texto do anúncio e traz o que ele leu, pedindo a conferência', async () => {
    camp.condicaoDoTexto.mockResolvedValue({ down_payment_from: 300, installment_from: 900, min_income: null, payment_terms: null, note: null });
    abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Preencher com o texto do anúncio' }));
    await waitFor(() => expect(screen.getByLabelText('Entrada a partir de')).toHaveValue('300'));
    expect(camp.condicaoDoTexto).toHaveBeenCalledWith('Entrada a partir de R$ 300. Parcelas a partir de R$ 900.');
    expect(screen.getByLabelText('Parcela a partir de')).toHaveValue('900');
    expect(screen.getByText(/Confira antes de salvar/)).toBeInTheDocument();
  });

  it('anúncio sem texto não deixa preencher', () => {
    abrir({ item: item({ ad_body: null, ad_title: null }) });
    expect(screen.getByRole('button', { name: 'Preencher com o texto do anúncio' })).toBeDisabled();
  });
});

describe('JanelaDaCampanha · pra quem é este anúncio', () => {
  it('a frase vem do fraseDaIntencao com "desta campanha"', () => {
    abrir();
    expect(screen.getByTestId('frase-da-intencao')).toHaveTextContent('Sem nada marcado: vale o padrão da IA.');
    fireEvent.click(screen.getByLabelText('Investimento'));
    expect(screen.getByTestId('frase-da-intencao')).toHaveTextContent('Não pergunta a intenção. Todo lead desta campanha é tratado como Investimento.');
  });
});

describe('JanelaDaCampanha · qual IA atende', () => {
  const comIa = (extra: Partial<React.ComponentProps<typeof JanelaDaCampanha>> = {}) =>
    abrir({ tipo: 'form', config: ficha(), opcoesDeIa: opcoes, item: item({ kind: 'form', form_config_id: 'cfg-1', agents: [] }), ...extra });
  const escolher = (valor: string) => {
    fireEvent.change(screen.getByLabelText('Pôr numa IA'), { target: { value: valor } });
    fireEvent.click(screen.getByRole('button', { name: 'Pôr' }));
  };

  it('grava pelo serviço da IA, com o id do formulário do Meta, e mostra quem atende', async () => {
    camp.escolherIa.mockResolvedValue({ ok: true, holders: [{ sales_agent_id: 'a1', name: 'Agente A', sales_agent_number_id: null, number_label: null, whole_number: false, note: null }], left_empty: [], warning: null });
    const aoMudarIa = vi.fn();
    comIa({ aoMudarIa });
    escolher('a1|');
    await waitFor(() => expect(camp.escolherIa).toHaveBeenCalledWith({ ref: { kind: 'form', id: 'f-1' }, sales_agent_id: 'a1', number_id: null }));
    expect(await screen.findByText('Agente A', { selector: 'span' })).toBeInTheDocument();
    expect(aoMudarIa).toHaveBeenCalled();
  });

  it('a IA que atende todo lead do número vem fixa, sem poder escolher', () => {
    comIa();
    const opcao = within(screen.getByLabelText('Pôr numa IA')).getByRole('option', { name: /Agente C/ });
    expect(opcao).toHaveTextContent('atende todo lead do número');
    expect(opcao).toBeDisabled();
  });

  it('quando move: mostra "Esta campanha sai da IA Agente A." e só reenvia com o ok', async () => {
    camp.escolherIa
      .mockResolvedValueOnce({ ok: false, moveNeeded: true, message: 'esta campanha sai da IA Agente A', conflicts: [{ sales_agent_id: 'a1', number_id: null }] })
      .mockResolvedValueOnce({ ok: true, holders: [], left_empty: [], warning: null });
    comIa();
    escolher('b1|n1');
    expect(await screen.findByText('Esta campanha sai da IA Agente A.')).toBeInTheDocument();
    expect(camp.escolherIa).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Mover' }));
    await waitFor(() => expect(camp.escolherIa).toHaveBeenCalledTimes(2));
    expect(camp.escolherIa.mock.calls[1][0]).toMatchObject({ sales_agent_id: 'b1', number_id: 'n1', confirm_move: true });
  });

  it('tirar usa o endereço de tirar', async () => {
    camp.tirarIa.mockResolvedValue({ holders: [], left_empty: ['Formulário Teste'], warning: null });
    comIa({ item: item({ kind: 'form', form_config_id: 'cfg-1', agents: [{ sales_agent_id: 'a1', name: 'Agente A', sales_agent_number_id: null, number_label: null, whole_number: false, note: null }] }) });
    fireEvent.click(screen.getByRole('button', { name: 'Tirar a IA' }));
    await waitFor(() => expect(camp.tirarIa).toHaveBeenCalledWith({ ref: { kind: 'form', id: 'f-1' }, sales_agent_id: 'a1', number_id: null }));
    expect(await screen.findByText(/Ficou sem IA: Formulário Teste/)).toBeInTheDocument();
  });

  it('sem a permissão da campanha, só leitura (e sales_agents.update não conta)', () => {
    permissoes.tem = new Set(['sales_agents.update']);
    comIa();
    expect(screen.queryByLabelText('Pôr numa IA')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Salvar' })).toBeNull();
    expect(screen.getByText(/mas não mudar/)).toBeInTheDocument();
  });

  it('só com campaign_links.update e create o anúncio já edita a IA', () => {
    permissoes.tem = new Set(['campaign_links.update', 'campaign_links.create']);
    abrir({ opcoesDeIa: opcoes });
    expect(screen.getByLabelText('Pôr numa IA')).toBeInTheDocument();
  });

  it('anúncio sem linha: escolher a IA cria a linha antes', async () => {
    camp.criarLinha.mockResolvedValue({ id: 'l1', match_kind: 'campaign', match_value: 'Campanha A' });
    camp.escolherIa.mockResolvedValue({ ok: true, holders: [], left_empty: [], warning: null });
    abrir({ opcoesDeIa: opcoes });
    escolher('a1|');
    await waitFor(() => expect(camp.escolherIa).toHaveBeenCalled());
    expect(camp.criarLinha).toHaveBeenCalledWith({ match_kind: 'campaign', match_value: 'Campanha A', label: 'Campanha A' });
    expect(camp.escolherIa.mock.calls[0][0].ref).toEqual({ kind: 'campaign_link', id: 'l1' });
  });
});

describe('JanelaDaCampanha · Salvar', () => {
  it('formulário: grava pela ficha, com property_id = o primeiro e a lista inteira', async () => {
    forms.update.mockResolvedValue({ ...ficha(), property_id: 'p2' });
    const entrada = { form_id: 'f-1', form_name: 'Formulário Teste', pipeline_id: 'p', pipeline_stage_id: 's', is_active: true, label_ids: [] };
    const { aoSalvar, aoFechar } = abrir({
      tipo: 'form', config: ficha(), montarEntrada: () => entrada,
      item: item({ kind: 'form', form_config_id: 'cfg-1', sells_scope: 'properties', property_ids: ['p2', 'p1'] }),
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(forms.update).toHaveBeenCalled());
    expect(forms.update.mock.calls[0][0]).toBe('cfg-1');
    expect(forms.update.mock.calls[0][1]).toMatchObject({
      ...entrada, property_id: 'p2', property_ids: ['p2', 'p1'], sells_scope: 'properties', sells_listing_kind: null,
    });
    expect(aoSalvar).toHaveBeenCalled();
    expect(aoFechar).toHaveBeenCalled();
  });

  it('formulário sem a entrada conferida não grava', async () => {
    abrir({ tipo: 'form', config: ficha(), montarEntrada: () => null, item: item({ kind: 'form', form_config_id: 'cfg-1', sells_scope: 'catalog' }) });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await new Promise((r) => setTimeout(r, 20));
    expect(forms.update).not.toHaveBeenCalled();
  });

  it('formulário novo usa o criar', async () => {
    forms.create.mockResolvedValue(ficha());
    abrir({ tipo: 'form', config: null, montarEntrada: () => ({ form_id: 'f-9', form_name: 'Novo', pipeline_id: 'p', pipeline_stage_id: 's', is_active: true, label_ids: [] }), item: item({ kind: 'form' }) });
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
    await waitFor(() => expect(forms.create).toHaveBeenCalled());
  });

  it('anúncio sem linha cria a linha com o tipo e o valor, e a condição digitada', async () => {
    camp.criarLinha.mockResolvedValue({ id: 'l1' });
    abrir({ item: item({ sells_scope: 'catalog' }) });
    fireEvent.change(screen.getByLabelText('Entrada a partir de'), { target: { value: '300' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(camp.criarLinha).toHaveBeenCalled());
    expect(camp.criarLinha.mock.calls[0][0]).toMatchObject({
      match_kind: 'campaign', match_value: 'Campanha A', sells_scope: 'catalog', property_ids: [],
      offer_condition: { down_payment_from: 300, installment_from: null, min_income: null, payment_terms: null, note: null },
    });
    expect(camp.atualizarLinha).not.toHaveBeenCalled();
  });

  it('anúncio que já tem linha atualiza a linha', async () => {
    camp.atualizarLinha.mockResolvedValue({ id: 'l1' });
    abrir({ item: item({ link_id: 'l1', sells_scope: 'listing_kind', sells_listing_kind: 'auction' }) });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(camp.atualizarLinha).toHaveBeenCalled());
    expect(camp.atualizarLinha.mock.calls[0][0]).toBe('l1');
    expect(camp.atualizarLinha.mock.calls[0][1]).toMatchObject({ sells_scope: 'listing_kind', sells_listing_kind: 'auction' });
  });

  it('"imóveis escolhidos" sem nenhum imóvel não salva', async () => {
    abrir({ item: item({ sells_scope: 'properties', property_ids: [] }) });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findAllByText('Escolha pelo menos um imóvel.')).not.toHaveLength(0);
    expect(camp.criarLinha).not.toHaveBeenCalled();
  });
});

describe('JanelaDaCampanha · Excluir ficha', () => {
  it('só quem pode apagar vê o botão (administrador)', () => {
    const aoApagar = vi.fn();
    permissoes.tem.add('lead_ads_form_configs.delete');
    abrir({ tipo: 'form', config: ficha(), aoApagar, item: item({ kind: 'form', form_config_id: 'cfg-1' }) });
    fireEvent.click(screen.getByRole('button', { name: 'Excluir ficha' }));
    expect(aoApagar).toHaveBeenCalled();
  });

  it('o gerente edita mas não vê Excluir ficha', () => {
    abrir({ tipo: 'form', config: ficha(), aoApagar: vi.fn(), item: item({ kind: 'form', form_config_id: 'cfg-1' }) });
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Excluir ficha' })).toBeNull();
  });
});

describe('JanelaDaCampanha · rodada 1', () => {
  it('centavos do servidor: o campo mostra pt-BR e Salvar grava o mesmo número (899,90 não vira 8999)', async () => {
    camp.condicaoDoTexto.mockResolvedValue({ down_payment_from: 15000, installment_from: 899.9, min_income: 1500.5, payment_terms: null, note: null });
    camp.atualizarLinha.mockResolvedValue({ id: 'l1' });
    abrir({ item: item({ link_id: 'l1', sells_scope: 'catalog' }) });
    fireEvent.click(screen.getByRole('button', { name: 'Preencher com o texto do anúncio' }));
    await waitFor(() => expect(screen.getByLabelText('Parcela a partir de')).toHaveValue('899,90'));
    expect(screen.getByLabelText('Entrada a partir de')).toHaveValue('15.000');
    expect(screen.getByLabelText('Entrada a partir de')).toHaveAttribute('inputmode', 'decimal');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(camp.atualizarLinha).toHaveBeenCalled());
    expect(camp.atualizarLinha.mock.calls[0][1].offer_condition).toMatchObject({ down_payment_from: 15000, installment_from: 899.9, min_income: 1500.5 });
  });

  it('condição que já tinha centavos abre em pt-BR e salva igual', async () => {
    camp.atualizarLinha.mockResolvedValue({ id: 'l1' });
    abrir({ item: item({ link_id: 'l1', sells_scope: 'catalog', offer_condition: { down_payment_from: null, installment_from: 899.9, min_income: null, payment_terms: null, note: null } }) });
    expect(screen.getByLabelText('Parcela a partir de')).toHaveValue('899,90');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(camp.atualizarLinha).toHaveBeenCalled());
    expect(camp.atualizarLinha.mock.calls[0][1].offer_condition.installment_from).toBe(899.9);
  });

  it('apagar a condição manda as chaves nulas, não null (o servidor descartaria o null)', async () => {
    camp.atualizarLinha.mockResolvedValue({ id: 'l1' });
    abrir({ item: item({ link_id: 'l1', sells_scope: 'catalog', offer_condition: { down_payment_from: 300, installment_from: null, min_income: null, payment_terms: null, note: null } }) });
    fireEvent.change(screen.getByLabelText('Entrada a partir de'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(camp.atualizarLinha).toHaveBeenCalled());
    expect(camp.atualizarLinha.mock.calls[0][1].offer_condition).toEqual({ down_payment_from: null, installment_from: null, min_income: null, payment_terms: null, note: null });
  });

  it('catálogo: campo vazio diz que vem do imóvel que a conversa escolher, não do corretor', () => {
    abrir({ item: item({ sells_scope: 'catalog' }) });
    expect(screen.getAllByText(/vem do imóvel que a conversa escolher/).length).toBe(4);
    expect(screen.queryByText(/o corretor simula/)).toBeNull();
  });

  it('o 409 usa a frase que o servidor mandou', async () => {
    camp.escolherIa.mockResolvedValueOnce({ ok: false, moveNeeded: true, message: 'esta campanha sai da IA Dos Fundos', conflicts: [{ sales_agent_id: 'a1', number_id: null }] });
    abrir({ tipo: 'form', config: ficha(), opcoesDeIa: opcoes, item: item({ kind: 'form', form_config_id: 'cfg-1' }) });
    fireEvent.change(screen.getByLabelText('Pôr numa IA'), { target: { value: 'b1|n1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pôr' }));
    expect(await screen.findByText('Esta campanha sai da IA Dos Fundos.')).toBeInTheDocument();
  });

  it('anúncio sem linha e sem campaign_links.create: só leitura, explicando', () => {
    permissoes.tem = new Set(['campaign_links.update']);
    abrir({ opcoesDeIa: opcoes });
    expect(screen.getByText(/criar a linha pede a permissão de criar campanha/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Salvar' })).toBeNull();
    expect(screen.queryByText(/vale na hora/)).toBeNull();
  });

  it('escolher a IA num anúncio sem linha avisa a lista do id da linha criada', async () => {
    camp.criarLinha.mockResolvedValue({ id: 'l9' });
    camp.escolherIa.mockResolvedValue({ ok: true, holders: [], left_empty: [], warning: null });
    const aoCriarLinha = vi.fn();
    abrir({ opcoesDeIa: opcoes, aoCriarLinha });
    fireEvent.change(screen.getByLabelText('Pôr numa IA'), { target: { value: 'a1|' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pôr' }));
    await waitFor(() => expect(aoCriarLinha).toHaveBeenCalledWith(expect.objectContaining({ key: 'campaign:Campanha A' }), 'l9'));
  });
});
