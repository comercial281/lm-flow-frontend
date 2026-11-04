import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { IaDaCampanha, ItemDeCampanha, OpcaoDeIa } from '@/services/campanhas/campanhasService';
import type { LeadAdsFormConfig } from '@/services/leadAds/leadAdsFormsService';

const camp = vi.hoisted(() => ({
  criarLinha: vi.fn(), atualizarLinha: vi.fn(), condicaoDoTexto: vi.fn(), escolherIa: vi.fn(),
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
  render(<MemoryRouter><JanelaDaCampanha tipo="whats" item={item()} aoFechar={aoFechar} aoSalvar={aoSalvar} {...extra} /></MemoryRouter>);
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
    props.list.mockResolvedValue({ data: [IMOVEIS.p11], meta: { total: 1 } });
    abrir({ item: item({ sells_scope: 'properties', property_ids: dez }) });
    const escolhidos = await screen.findByTestId('selecionados');
    await waitFor(() => expect(within(escolhidos).getAllByRole('button', { name: /^Tirar/ })).toHaveLength(10));
    expect(await screen.findByRole('button', { name: /Imóvel 11/ })).toBeDisabled();
    expect(screen.getByText(/Chegou em 10 imóveis/)).toBeInTheDocument();
  });

  it('com 9 ainda dá pra marcar o décimo na lista aberta', async () => {
    const nove = Array.from({ length: 9 }, (_, i) => `p${i + 1}`);
    props.list.mockResolvedValue({ data: [{ id: 'p10', title: 'Imóvel 10', code: 'AB10' }], meta: { total: 1 } });
    abrir({ item: item({ sells_scope: 'properties', property_ids: nove }) });
    fireEvent.click(await screen.findByRole('button', { name: /^Imóvel 10/ }));
    await waitFor(() => expect(within(screen.getByTestId('selecionados')).getAllByRole('button', { name: /^Tirar/ })).toHaveLength(10));
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

describe('JanelaDaCampanha · qual IA atende (só leitura)', () => {
  const agente = (extra: Partial<IaDaCampanha> = {}): IaDaCampanha => ({
    sales_agent_id: 'a1', name: 'Agente A', sales_agent_number_id: null, number_label: null, whole_number: false, note: null,
    kind: 'campaign', reason: 'esta campanha está na lista dela', removable: true, ...extra,
  });
  const comIa = (agents: IaDaCampanha[], extra: Partial<React.ComponentProps<typeof JanelaDaCampanha>> = {}) =>
    abrir({ tipo: 'form', config: ficha(), opcoesDeIa: opcoes, item: item({ kind: 'form', form_config_id: 'cfg-1', agents }), ...extra });
  const LINK = '/ia-vendedora?ia=a1&tela=configurar&pagina=campanhas';

  beforeEach(() => { permissoes.tem.add('sales_agents.read'); });

  it('ficha existente: mostra quem atende e o motivo, sem seletor, sem Pôr e sem Tirar a IA', () => {
    comIa([agente()]);
    const dir = screen.getByTestId('coluna-direita');
    expect(within(dir).getByText('Agente A', { selector: 'span' })).toBeInTheDocument();
    expect(within(dir).getByText('Esta campanha está na lista dela')).toBeInTheDocument();
    expect(screen.queryByLabelText('Pôr numa IA')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Pôr' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Tirar a IA/ })).toBeNull();
    expect(camp.escolherIa).not.toHaveBeenCalled();
  });

  it('com uma IA só, "Configurar na IA" abre a página Campanhas e gatilhos dela', () => {
    comIa([agente()]);
    expect(screen.getByRole('link', { name: 'Configurar na IA' })).toHaveAttribute('href', LINK);
  });

  it('a mesma IA em dois números conta como uma só', () => {
    comIa([agente(), agente({ sales_agent_number_id: 'n1', number_label: 'Ana' })]);
    expect(screen.getByRole('link', { name: 'Configurar na IA' })).toHaveAttribute('href', LINK);
  });

  it('com duas IAs diferentes, o link vai pra lista da IA Vendedora', () => {
    comIa([agente(), agente({ sales_agent_id: 'b1', name: 'Agente B' })]);
    expect(screen.getByRole('link', { name: 'Configurar na IA' })).toHaveAttribute('href', '/ia-vendedora');
  });

  it('sem nenhuma IA: "Sem IA" e o link pra lista', () => {
    comIa([]);
    expect(screen.getByText('Sem IA')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Configurar na IA' })).toHaveAttribute('href', '/ia-vendedora');
  });

  it('anúncio de WhatsApp: também só leitura, sem seletor', () => {
    abrir({ opcoesDeIa: opcoes, item: item({ link_id: 'l1', agents: [agente()] }) });
    expect(screen.queryByLabelText('Pôr numa IA')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Tirar a IA/ })).toBeNull();
    expect(screen.getByRole('link', { name: 'Configurar na IA' })).toHaveAttribute('href', LINK);
  });

  it('cargo que só lê (sem editar a campanha): mesmo bloco, link só com permissão de ver a IA', () => {
    permissoes.tem = new Set(['sales_agents.read']);
    comIa([agente()]);
    expect(screen.getByText(/mas não mudar/)).toBeInTheDocument();
    expect(within(screen.getByTestId('coluna-direita')).getByText('Agente A', { selector: 'span' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Pôr numa IA')).toBeNull();
    expect(screen.getByRole('link', { name: 'Configurar na IA' })).toHaveAttribute('href', LINK);
  });

  it('corretor sem acesso à tela da IA (sales_agents.read): vê quem atende e nenhum link', () => {
    permissoes.tem = new Set(['sales_agents.update']);
    comIa([agente()]);
    expect(within(screen.getByTestId('coluna-direita')).getByText('Agente A', { selector: 'span' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Configurar na IA' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Salvar' })).toBeNull();
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

  it('anúncio sem linha e sem campaign_links.create: só leitura, explicando', () => {
    permissoes.tem = new Set(['campaign_links.update']);
    abrir({ opcoesDeIa: opcoes });
    expect(screen.getByText(/criar a linha pede a permissão de criar campanha/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Salvar' })).toBeNull();
    expect(screen.queryByText(/vale na hora/)).toBeNull();
  });

});

const entradaFalsa = <div>Campos da entrada</div>;
const formNovo = (extra: Partial<React.ComponentProps<typeof JanelaDaCampanha>> = {}) =>
  abrir({
    tipo: 'form', config: null, entrada: entradaFalsa, opcoesDeIa: opcoes, item: item({ kind: 'form', key: 'form:f-9', label: 'Novo' }),
    montarEntrada: () => ({ form_id: 'f-9', form_name: 'Novo', pipeline_id: 'p', pipeline_stage_id: 's', is_active: true, label_ids: [] }),
    ...extra,
  });

describe('JanelaDaCampanha · aviso no topo e foco', () => {
  it('avisoDoTopo aparece no começo do miolo', () => {
    formNovo({ avisoDoTopo: 'Esta ficha estava desligada. Ao salvar, ela liga de novo.' });
    const miolo = screen.getByTestId('miolo-da-janela');
    expect(miolo.firstElementChild).toHaveTextContent('Esta ficha estava desligada. Ao salvar, ela liga de novo.');
  });
});

describe('JanelaDaCampanha · janela nova (Tarefa 6)', () => {
  it('é a janela larga da casa, com o miolo em duas colunas que podem encolher', () => {
    const { dialogo } = formNovo();
    expect(dialogo.className).toContain('sm:max-w-[1400px]');
    const esq = screen.getByTestId('coluna-entrada');
    const dir = screen.getByTestId('coluna-direita');
    expect(esq.parentElement?.className).toMatch(/lg:grid-cols-\[7fr_5fr\]/);
    expect(esq.className).toContain('min-w-0');
    expect(dir.className).toContain('min-w-0');
  });

  it('formulário: entrada do lead à esquerda; Quem atende e Oferta à direita', () => {
    formNovo();
    const esq = screen.getByTestId('coluna-entrada');
    const dir = screen.getByTestId('coluna-direita');
    expect(within(esq).getByText('Campos da entrada')).toBeInTheDocument();
    expect(within(esq).getByRole('radio', { name: 'Imóveis escolhidos' })).toBeInTheDocument();
    expect(within(dir).getByRole('group', { name: 'IA que atende' })).toBeInTheDocument();
    expect(within(dir).getByRole('group', { name: /Oferta do anúncio/ })).toBeInTheDocument();
    expect(within(dir).queryByText('Campos da entrada')).toBeNull();
    expect(screen.queryByLabelText(/Nome do imóvel para reconhecer os formulários/)).toBeNull();
  });

  it('a oferta vem fechada com a frase da condição do imóvel; Personalizar abre', async () => {
    formNovo({ item: item({ kind: 'form', sells_scope: 'properties', property_ids: ['p1'] }) });
    expect(await screen.findByText(/Vale a do cadastro do imóvel: entrada a partir de R\$ 500/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Entrada a partir de')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Personalizar a oferta' }));
    expect(screen.getByLabelText('Entrada a partir de')).toBeInTheDocument();
    expect(screen.getByLabelText('Observação do formulário')).toBeInTheDocument();
    expect(screen.getByTestId('frase-da-intencao')).toBeInTheDocument();
  });

  it('ficha que já tem condição abre a oferta aberta', () => {
    formNovo({ item: item({ kind: 'form', offer_condition: { down_payment_from: 300, installment_from: null, min_income: null, payment_terms: null, note: null } }) });
    expect(screen.getByLabelText('Entrada a partir de')).toHaveValue('300');
    expect(screen.queryByRole('button', { name: 'Personalizar a oferta' })).toBeNull();
  });

  it('ficha que já tem intenção abre a oferta aberta', () => {
    formNovo({ item: item({ kind: 'form', audience_intents: ['investimento'] }) });
    expect(screen.getByLabelText('Investimento')).toBeChecked();
  });

  it('anúncio de WhatsApp: sem entrada do lead, com o preencher e a condição já aberta', () => {
    abrir({ opcoesDeIa: opcoes });
    expect(screen.queryByTestId('coluna-entrada')).toBeNull();
    expect(screen.getByRole('button', { name: 'Preencher com o texto do anúncio' })).toBeInTheDocument();
    expect(screen.getByLabelText('Entrada a partir de')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Personalizar a oferta' })).toBeNull();
  });

  it('ficha por "nome contém": mostra a palavra só leitura', () => {
    abrir({ tipo: 'form', config: { ...ficha(), form_id: 'nome_contem:x', match_keyword: 'alma' }, entrada: entradaFalsa, item: item({ kind: 'form', form_config_id: 'cfg-1', keyword_rule: true }) });
    expect(screen.getByTestId('regra-por-nome')).toHaveTextContent('Nome contém alma');
    expect(within(screen.getByTestId('regra-por-nome')).queryByRole('textbox')).toBeNull();
  });

  it('o Salvar do formulário não manda match_keyword', async () => {
    forms.update.mockResolvedValue(ficha());
    abrir({ tipo: 'form', config: ficha(), entrada: entradaFalsa, item: item({ kind: 'form', form_config_id: 'cfg-1' }),
      montarEntrada: () => ({ form_id: 'f-1', form_name: 'Formulário Teste', pipeline_id: 'p', pipeline_stage_id: 's', is_active: true, label_ids: [] }) });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(forms.update).toHaveBeenCalled());
    expect(forms.update.mock.calls[0][1]).not.toHaveProperty('match_keyword');
  });

  it('o rodapé resume o imóvel, a entrada e a IA', async () => {
    formNovo({ resumoDaEntrada: 'Leads > Novo', item: item({ kind: 'form', sells_scope: 'catalog' }) });
    expect(screen.getByTestId('resumo-do-rodape')).toHaveTextContent('Todo o catálogo');
    expect(screen.getByTestId('resumo-do-rodape')).toHaveTextContent('Leads > Novo');
    // Formulário novo sem escolha: o rodapé não afirma "Sem IA" (uma IA por funil ou por anúncio ainda pode atender)
    expect(screen.getByTestId('resumo-do-rodape')).not.toHaveTextContent('Sem IA');
  });

  it('formulário que já existe, sem nenhuma IA: o rodapé diz "Sem IA"', () => {
    abrir({ tipo: 'form', config: ficha(), entrada: entradaFalsa, opcoesDeIa: opcoes, item: item({ kind: 'form', form_config_id: 'cfg-1', agents: [] }) });
    expect(screen.getByTestId('resumo-do-rodape')).toHaveTextContent('Sem IA');
  });
});

describe('JanelaDaCampanha · lista de imóveis aberta e só o miolo rola (fix 1)', () => {
  const entradaOk = () => ({ form_id: 'f-9', form_name: 'Novo', pipeline_id: 'p', pipeline_stage_id: 's', is_active: true, label_ids: [] });

  it('formulário novo abre em "Imóveis escolhidos" com a lista de imóveis à mostra, sem digitar', async () => {
    formNovo();
    expect(screen.getByRole('radio', { name: 'Imóveis escolhidos' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByPlaceholderText('Buscar por título ou código')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /^Residencial Teste/ })).toBeInTheDocument();
    expect(props.list).toHaveBeenCalledWith(expect.objectContaining({ per_page: 20, sort: 'recent' }));
  });

  it('ficha existente sem tipo e sem imóvel também abre com a lista à mostra', async () => {
    abrir({ tipo: 'form', config: ficha(), entrada: entradaFalsa, item: item({ kind: 'form', form_config_id: 'cfg-1' }) });
    expect(await screen.findByRole('button', { name: /^Residencial Teste/ })).toBeInTheDocument();
  });

  it('Criar sem escolher nada manda o mesmo de antes: sem tipo e sem imóvel', async () => {
    forms.create.mockResolvedValue(ficha());
    formNovo({ montarEntrada: entradaOk });
    await screen.findByRole('button', { name: /^Residencial Teste/ });
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
    await waitFor(() => expect(forms.create).toHaveBeenCalled());
    expect(forms.create.mock.calls[0][0]).toMatchObject({
      sells_scope: null, sells_listing_kind: null, property_ids: [], property_id: null,
    });
  });

  it('marcar um imóvel vira "imóveis escolhidos"; desmarcar o último volta a não dizer nada (e Criar não reclama)', async () => {
    forms.create.mockResolvedValue(ficha());
    formNovo({ montarEntrada: entradaOk });
    const b = await screen.findByRole('button', { name: /^Residencial Teste/ });
    fireEvent.click(b);
    expect(screen.getByRole('button', { name: /^Residencial Teste/ })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: /^Residencial Teste/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
    await waitFor(() => expect(forms.create).toHaveBeenCalled());
    expect(forms.create.mock.calls[0][0]).toMatchObject({ sells_scope: null, property_ids: [], property_id: null });
    expect(screen.queryByText('Escolha pelo menos um imóvel.')).toBeNull();
  });

  it('com um imóvel marcado, Criar grava imóveis escolhidos com ele', async () => {
    forms.create.mockResolvedValue(ficha());
    formNovo({ montarEntrada: entradaOk });
    fireEvent.click(await screen.findByRole('button', { name: /^Residencial Teste/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
    await waitFor(() => expect(forms.create).toHaveBeenCalled());
    expect(forms.create.mock.calls[0][0]).toMatchObject({ sells_scope: 'properties', property_ids: ['p1'], property_id: 'p1' });
  });

  it('a janela não rola: o miolo rola e o topo e o rodapé ficam parados', () => {
    const { dialogo } = formNovo();
    expect(dialogo.className).toContain('overflow-hidden');
    expect(dialogo.className).toContain('flex-col');
    const miolo = screen.getByTestId('miolo-da-janela');
    expect(miolo.className).toContain('overflow-y-auto');
    expect(miolo.className).toContain('overflow-x-hidden');
    expect(miolo.className).toContain('relative'); // prende o sr-only absoluto dentro da rolagem
    expect(miolo.contains(screen.getByTestId('coluna-direita'))).toBe(true);
    expect(miolo.contains(screen.getByRole('button', { name: 'Criar' }))).toBe(false);
    expect(miolo.contains(screen.getByRole('heading', { name: /Configurar formulário/ }))).toBe(false);
  });
});


describe('JanelaDaCampanha · sugestão de imóvel pelo nome', () => {
  it('"[03/11] [CASTELO 2.0]" sugere pela palavra CASTELO (sugestaoPeloNome, não normalizarNome)', async () => {
    formNovo({ item: item({ kind: 'form', key: 'form:f-9', label: '[03/11] [CASTELO 2.0]' }) });
    await waitFor(() => expect(props.list).toHaveBeenCalledWith({ q: 'CASTELO', per_page: 1 }));
  });
});

describe('JanelaDaCampanha · copiar de outra ficha (Tarefa 7)', () => {
  const origem = (): LeadAdsFormConfig => ({ ...ficha(), id: 'cfg-o', form_id: 'f-o', form_name: '[06/10] [CASTELO]' });
  const itemOrigem = (extra: Partial<ItemDeCampanha> = {}): ItemDeCampanha => item({
    kind: 'form', key: 'form:f-o', label: '[06/10] [CASTELO]', form_config_id: 'cfg-o', sells_scope: 'properties', property_ids: ['p1', 'p2'],
    offer_condition: { down_payment_from: 1500, note: 'Oferta do Castelo' }, audience_intents: ['investimento'],
    agents: [{ sales_agent_id: 'b1', name: 'Agente B', sales_agent_number_id: 'n1', number_label: 'Ana', whole_number: false, note: null, kind: 'campaign', reason: 'esta campanha está na lista dela', removable: true }],
    ...extra,
  });
  const novoParecido = (extra: Partial<React.ComponentProps<typeof JanelaDaCampanha>> = {}) => {
    const aoCopiarEntrada = vi.fn();
    const r = formNovo({
      item: item({ kind: 'form', key: 'form:f-9', label: '[03/11] [CASTELO 2.0]' }),
      fichas: [origem()], itensDaLista: [itemOrigem()], aoCopiarEntrada, ...extra,
    });
    return { ...r, aoCopiarEntrada };
  };
  const copiar = () => fireEvent.click(screen.getByRole('button', { name: 'Copiar a configuração' }));

  it('formulário novo com nome parecido mostra a faixa "Parece com a ficha X"', () => {
    novoParecido();
    expect(screen.getByText(/Parece com a ficha/)).toHaveTextContent('[06/10] [CASTELO]');
  });

  it('formulário que já existe não mostra a faixa', () => {
    abrir({ tipo: 'form', config: ficha(), opcoesDeIa: opcoes, fichas: [origem()], itensDaLista: [itemOrigem()], item: item({ kind: 'form', label: '[03/11] [CASTELO 2.0]', form_config_id: 'cfg-1' }) });
    expect(screen.queryByText(/Parece com a ficha/)).toBeNull();
  });

  it('nome sem ficha parecida não mostra a faixa', () => {
    novoParecido({ item: item({ kind: 'form', key: 'form:f-9', label: '[03/11] [VIVANT]' }) });
    expect(screen.queryByText(/Parece com a ficha/)).toBeNull();
  });

  it('Copiar preenche imóveis, escopo, oferta, intenções e a IA, entrega a entrada à tela e esconde a faixa, sem gravar nada', async () => {
    const { aoCopiarEntrada } = novoParecido();
    copiar();
    expect(aoCopiarEntrada).toHaveBeenCalledWith(expect.objectContaining({ id: 'cfg-o' }));
    expect(screen.queryByText(/Parece com a ficha/)).toBeNull();
    await waitFor(() => expect(within(screen.getByTestId('selecionados')).getAllByRole('button', { name: /^Tirar/ })).toHaveLength(2));
    expect(screen.getByLabelText('Entrada a partir de')).toHaveValue('1.500');
    expect(screen.getByLabelText('Observação do formulário')).toHaveValue('Oferta do Castelo');
    expect(screen.getByLabelText('Investimento')).toBeChecked();
    expect(within(screen.getByTestId('coluna-direita')).getByText('Vem da ficha copiada: Agente B · Ana')).toBeInTheDocument();
    expect(forms.create).not.toHaveBeenCalled();
    expect(camp.escolherIa).not.toHaveBeenCalled();
  });

  it('depois de copiar, Criar grava a ficha com o form_id próprio e a IA da origem', async () => {
    forms.create.mockResolvedValue({ ...ficha(), id: 'cfg-9', form_id: 'f-9' });
    camp.escolherIa.mockResolvedValue({ ok: true, holders: [], left_empty: [], warning: null });
    novoParecido();
    copiar();
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
    await waitFor(() => expect(camp.escolherIa).toHaveBeenCalled());
    expect(forms.create.mock.calls[0][0]).toMatchObject({
      form_id: 'f-9', sells_scope: 'properties', property_ids: ['p1', 'p2'], audience_intents: ['investimento'], offer_condition: { down_payment_from: 1500 },
    });
    expect(camp.escolherIa).toHaveBeenCalledWith({ ref: { kind: 'form', id: 'f-9' }, sales_agent_id: 'b1', number_id: 'n1' });
  });

  it('origem sem escopo não inventa escopo na cópia', () => {
    novoParecido({ itensDaLista: [itemOrigem({ sells_scope: null, property_ids: [], offer_condition: null, audience_intents: [] })] });
    copiar();
    expect(screen.getByText(/Ainda não diz/)).toBeInTheDocument();
  });

  it('IA por regra mais ampla na origem: nada a escolher, nenhum aviso', () => {
    novoParecido({ itensDaLista: [itemOrigem({ agents: [{ sales_agent_id: 'a1', name: 'Agente A', sales_agent_number_id: null, number_label: null, whole_number: false, note: null, kind: 'broad', reason: 'atende todo lead do funil', removable: false }] })] });
    copiar();
    expect(screen.queryByText(/Vem da ficha copiada/)).toBeNull();
    expect(screen.queryByText(/IA não foi copiada/)).toBeNull();
  });

  it('IA da origem sem opção no seletor: copia o resto e avisa em uma linha', () => {
    novoParecido({ opcoesDeIa: opcoes.filter((o) => o.sales_agent_id !== 'b1') });
    copiar();
    expect(screen.getByText(/A IA não foi copiada/)).toBeInTheDocument();
    expect(screen.queryByText('Sem IA')).toBeNull();
    expect(screen.getByLabelText('Investimento')).toBeChecked();
  });

  it('origem com duas IAs da campanha: copia a primeira', () => {
    const ag = (id: string, num: string | null) => ({ sales_agent_id: id, name: id === 'b1' ? 'Agente B' : 'Agente A', sales_agent_number_id: num, number_label: null, whole_number: false, note: null, kind: 'campaign' as const, reason: 'na lista', removable: true });
    novoParecido({ itensDaLista: [itemOrigem({ agents: [ag('b1', 'n1'), ag('a1', null)] })] });
    copiar();
    expect(within(screen.getByTestId('coluna-direita')).getByText('Vem da ficha copiada: Agente B · Ana')).toBeInTheDocument();
    // e diz, em uma linha, que a outra não veio
    expect(screen.getByText(/A outra IA desta campanha \(Agente A\) não veio/)).toBeInTheDocument();
  });

  it('origem com uma IA só da campanha: nenhum aviso de "outra IA"', () => {
    novoParecido();
    copiar();
    expect(screen.queryByText(/A outra IA desta campanha/)).toBeNull();
  });

  it('lista de campanhas chegando: Copiar espera, não copia nada; quando chega, habilita e copia a IA', async () => {
    const aoCopiarEntrada = vi.fn();
    const base = { item: item({ kind: 'form', key: 'form:f-9', label: '[03/11] [CASTELO 2.0]' }), fichas: [origem()], aoCopiarEntrada, entrada: entradaFalsa };
    const mont = () => ({ form_id: 'f-9', form_name: 'Novo', pipeline_id: 'p', pipeline_stage_id: 's', is_active: true, label_ids: [] });
    const { rerender } = render(<MemoryRouter><JanelaDaCampanha tipo="form" config={null} aoFechar={vi.fn()} montarEntrada={mont} opcoesDeIa={undefined} itensDaLista={[]} listaCarregando {...base} /></MemoryRouter>);
    const botao = screen.getByRole('button', { name: 'Copiar a configuração' });
    expect(botao).toBeDisabled();
    expect(screen.getByText(/Esperando a lista de campanhas/)).toBeInTheDocument();
    fireEvent.click(botao);
    expect(aoCopiarEntrada).not.toHaveBeenCalled();
    rerender(<MemoryRouter><JanelaDaCampanha tipo="form" config={null} aoFechar={vi.fn()} montarEntrada={mont} opcoesDeIa={opcoes} itensDaLista={[itemOrigem()]} {...base} /></MemoryRouter>);
    expect(screen.getByRole('button', { name: 'Copiar a configuração' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Copiar a configuração' }));
    expect(aoCopiarEntrada).toHaveBeenCalled();
    expect(within(screen.getByTestId('coluna-direita')).getByText('Vem da ficha copiada: Agente B · Ana')).toBeInTheDocument();
  });

  it('lista que falhou: Copiar vale e a janela avisa que a IA não foi copiada', () => {
    const { aoCopiarEntrada } = novoParecido({ opcoesDeIa: undefined, itensDaLista: [], listaCarregando: true, listaFalhou: true });
    expect(screen.getByRole('button', { name: 'Copiar a configuração' })).toBeEnabled();
    copiar();
    expect(aoCopiarEntrada).toHaveBeenCalled();
    expect(screen.getByText(/A IA não foi copiada: a lista de campanhas não carregou/)).toBeInTheDocument();
  });

  it('ficha de origem fora da lista carregada: copia o resto e avisa', () => {
    novoParecido({ itensDaLista: [] });
    copiar();
    expect(screen.getByText(/A IA não foi copiada: não achei a ficha de origem/)).toBeInTheDocument();
  });

  it('lista pronta mas sem opções de IA: copia o resto e avisa que a IA não foi copiada', () => {
    const { aoCopiarEntrada } = novoParecido({ opcoesDeIa: undefined });
    copiar();
    expect(aoCopiarEntrada).toHaveBeenCalled();
    expect(screen.getByLabelText('Investimento')).toBeChecked();
    expect(screen.getByText(/A IA não foi copiada: as opções de IA não carregaram/)).toBeInTheDocument();
  });

  // ---- Criar guarda a IA que veio da cópia ----
  const criada = () => ({ ...ficha(), id: 'cfg-9', form_id: 'f-9', form_name: 'Novo' });
  const AVISO_DA_LISTA = 'IA que usa lista de formulários só atende depois de marcar este formulário nela.';

  it('formulário novo sem cópia: sem seletor, avisa que IA de lista precisa marcar o formulário, com link pra IA', () => {
    permissoes.tem.add('sales_agents.read');
    novoParecido({ item: item({ kind: 'form', key: 'form:f-9', label: '[03/11] [VIVANT]' }) });
    const dir = screen.getByTestId('coluna-direita');
    expect(screen.queryByLabelText('Pôr numa IA')).toBeNull();
    expect(within(dir).getByText(AVISO_DA_LISTA)).toBeInTheDocument();
    expect(within(dir).getByText(/IA que atende por funil ou por todo anúncio continua atendendo/)).toBeInTheDocument();
    expect(within(dir).queryByText('Sem IA')).toBeNull();
    expect(within(dir).getByRole('link', { name: 'Configurar na IA' })).toHaveAttribute('href', '/ia-vendedora');
  });

  it('depois de copiar, a IA aparece antes do Criar e o aviso da lista some', () => {
    novoParecido();
    expect(screen.getByText(AVISO_DA_LISTA)).toBeInTheDocument();
    copiar();
    expect(screen.getByText('Vem da ficha copiada: Agente B · Ana')).toBeInTheDocument();
    expect(screen.queryByText(AVISO_DA_LISTA)).toBeNull();
    expect(screen.getByTestId('resumo-do-rodape')).toHaveTextContent('Agente B');
    expect(screen.queryByLabelText('Pôr numa IA')).toBeNull();
    expect(camp.escolherIa).not.toHaveBeenCalled();
  });

  it('Criar fecha quando a ficha e a IA copiada foram gravadas, nessa ordem', async () => {
    forms.create.mockResolvedValue(criada());
    camp.escolherIa.mockResolvedValue({ ok: true, holders: [], left_empty: [], warning: null });
    const { aoFechar, aoSalvar } = novoParecido();
    copiar();
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
    await waitFor(() => expect(camp.escolherIa).toHaveBeenCalled());
    expect(forms.create.mock.invocationCallOrder[0]).toBeLessThan(camp.escolherIa.mock.invocationCallOrder[0]);
    await waitFor(() => expect(aoFechar).toHaveBeenCalled());
    expect(aoSalvar).toHaveBeenCalledWith({ config: expect.objectContaining({ id: 'cfg-9' }) });
  });

  it('sem cópia, Criar não chama o endereço da IA', async () => {
    forms.create.mockResolvedValue(criada());
    const { aoFechar } = novoParecido({ item: item({ kind: 'form', key: 'form:f-9', label: '[03/11] [VIVANT]' }) });
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
    await waitFor(() => expect(aoFechar).toHaveBeenCalled());
    expect(camp.escolherIa).not.toHaveBeenCalled();
  });

  it('a IA falhou: a ficha fica, a janela segue aberta e diz que a IA não foi gravada; Salvar atualiza a criada', async () => {
    forms.create.mockResolvedValue(criada());
    forms.update.mockResolvedValue(criada());
    camp.escolherIa.mockRejectedValue(new Error('500'));
    const { aoFechar, aoSalvar } = novoParecido();
    copiar();
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
    expect(await screen.findByText(/a IA não foi gravada/i)).toBeInTheDocument();
    expect(aoFechar).not.toHaveBeenCalled();
    expect(aoSalvar).toHaveBeenCalledWith({ config: expect.objectContaining({ id: 'cfg-9' }) });
    expect(screen.queryByRole('button', { name: 'Criar' })).toBeNull();
    expect(screen.queryByText(/Vem da ficha copiada/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(forms.update).toHaveBeenCalled());
    expect(forms.update.mock.calls[0][0]).toBe('cfg-9');
    expect(forms.create).toHaveBeenCalledTimes(1);
  });

  it('409 no Criar: pergunta "Esta campanha sai da IA X." e Mover reenvia com confirm_move e fecha', async () => {
    forms.create.mockResolvedValue(criada());
    camp.escolherIa
      .mockResolvedValueOnce({ ok: false, moveNeeded: true, message: 'esta campanha sai da IA Agente C', conflicts: [{ sales_agent_id: 'c1', number_id: null }] })
      .mockResolvedValueOnce({ ok: true, holders: [], left_empty: [], warning: null });
    const { aoFechar } = novoParecido();
    copiar();
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
    expect(await screen.findByText('Esta campanha sai da IA Agente C.')).toBeInTheDocument();
    expect(aoFechar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Mover' }));
    await waitFor(() => expect(camp.escolherIa).toHaveBeenCalledTimes(2));
    expect(camp.escolherIa.mock.calls[1][0]).toMatchObject({ ref: { kind: 'form', id: 'f-9' }, sales_agent_id: 'b1', number_id: 'n1', confirm_move: true });
    await waitFor(() => expect(aoFechar).toHaveBeenCalled());
    expect(forms.create).toHaveBeenCalledTimes(1);
  });

  it('409 e "Deixar como está": a ficha fica, a janela segue aberta e nada mais é pedido', async () => {
    forms.create.mockResolvedValue(criada());
    camp.escolherIa.mockResolvedValueOnce({ ok: false, moveNeeded: true, message: 'esta campanha sai da IA Agente C', conflicts: [] });
    const { aoFechar } = novoParecido();
    copiar();
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
    await screen.findByText('Esta campanha sai da IA Agente C.');
    fireEvent.click(screen.getByRole('button', { name: 'Deixar como está' }));
    expect(screen.queryByText('Esta campanha sai da IA Agente C.')).toBeNull();
    expect(camp.escolherIa).toHaveBeenCalledTimes(1);
    expect(aoFechar).not.toHaveBeenCalled();
  });
});
