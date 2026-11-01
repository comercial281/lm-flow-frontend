import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AgentNumber, SalesAgent } from '@/services/salesAgents/salesAgentsService';
import type { ItemDeCampanha } from '@/services/campanhas/campanhasService';
import { agenteDeTeste } from '@/test/salesAgents/agenteDeTeste';
import { gravarDeTeste } from '@/test/salesAgents/gravarDeTeste';

const pode = { campanhas: true };
vi.mock('@/hooks/useCan', () => ({ useCan: () => (recurso: string, acao: string) => (recurso === 'campaign_links' && acao === 'read' ? pode.campanhas : true) }));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn() }) }));
vi.mock('@/services/leadAds/leadAdsFormsService', () => ({ leadAdsFormsService: { getAll: vi.fn().mockResolvedValue([]) } }));
vi.mock('@/services/pipelines/pipelinesService', () => ({
  pipelinesService: { getPipelines: vi.fn().mockResolvedValue({ data: [] }), getPipelineStages: vi.fn() },
}));
vi.mock('@/services/campanhas/campanhasService', () => ({
  campanhasService: { lista: vi.fn(), criarLinha: vi.fn() },
}));
vi.mock('@/services/salesAgents/salesAgentsService', async (original) => {
  const real = await original<typeof import('@/services/salesAgents/salesAgentsService')>();
  return {
    ...real,
    salesAgentsService: {
      ...real.salesAgentsService,
      list: vi.fn().mockResolvedValue([]),
      get: vi.fn(),
      atualizarNumero: vi.fn().mockResolvedValue({ warnings: [] }),
      uploadMedia: vi.fn(),
    },
  };
});
import CampanhasEGatilhos from './CampanhasEGatilhos';
import { salesAgentsService } from '@/services/salesAgents/salesAgentsService';
import { campanhasService } from '@/services/campanhas/campanhasService';
import { toast } from 'sonner';

const numero = (id: string, nome: string, triggers: AgentNumber['triggers'], inbox = `i-${id}`): AgentNumber => ({
  id, inbox_id: inbox, phone: null, inbox_name: `Número ${nome}`, enabled: true, connected: true, voice: null,
  triggers, position: 0, owner_user_id: 'u1', owner_name: nome,
});
const forma = { type: 'form' as const, form_ids: ['111'] };

const item = (extra: Partial<ItemDeCampanha>): ItemDeCampanha => ({
  key: 'campaign:Campanha Teste', kind: 'campaign', label: 'Campanha Teste', form_config_id: null, link_id: 'l1', keyword_rule: false,
  property_ids: ['p1', 'p2'], sells_scope: 'properties', sells_listing_kind: null, offer_condition: null, audience_intents: [],
  leads_count: 3, last_lead_at: null, ad_title: null, ad_body: null, campaign_name: 'Campanha Teste', match_kind: 'campaign',
  match_value: 'Campanha Teste', is_active: true, agents: [], ...extra,
});

async function abrir(agent: SalesAgent, itens: ItemDeCampanha[] = []) {
  vi.mocked(campanhasService.lista).mockResolvedValue(itens);
  vi.mocked(salesAgentsService.get).mockResolvedValue(agent);
  const gravar = gravarDeTeste('campanhas');
  const aoSalvo = vi.fn();
  const r = render(<CampanhasEGatilhos agent={agent} inboxes={[]} gravar={gravar} irPara={vi.fn()} diagnostico={null} aoSalvo={aoSalvo} />);
  await waitFor(() => expect(salesAgentsService.list).toHaveBeenCalled());
  return { gravar, aoSalvo, ...r };
}
const grupo = (nome: string) => screen.getByRole('radiogroup', { name: nome });

beforeEach(() => {
  pode.campanhas = true;
  vi.clearAllMocks();
  vi.mocked(salesAgentsService.list).mockResolvedValue([]);
  vi.mocked(salesAgentsService.atualizarNumero).mockResolvedValue({ warnings: [] } as never);
});

describe('Gatilhos por número', () => {
  const agente = () => agenteDeTeste({ numbers: [numero('n1', 'Ana', [forma]), numero('n2', 'Bia', null), numero('n3', 'Caio', [])] });

  it('mostra o estado de cada número: os do agente, todo lead ou só alguns', async () => {
    await abrir(agente());
    expect(within(grupo('Gatilhos de Ana')).getByRole('radio', { name: 'Só alguns' })).toHaveAttribute('aria-checked', 'true');
    expect(within(grupo('Gatilhos de Bia')).getByRole('radio', { name: 'Os do agente' })).toHaveAttribute('aria-checked', 'true');
    expect(within(grupo('Gatilhos de Caio')).getByRole('radio', { name: 'Todo lead do número' })).toHaveAttribute('aria-checked', 'true');
  });

  it('voltar pra "Os do agente" grava nulo (nunca lista vazia), pelo atualizarNumero', async () => {
    await abrir(agente());
    await userEvent.click(within(grupo('Gatilhos de Ana')).getByRole('radio', { name: 'Os do agente' }));
    expect(salesAgentsService.atualizarNumero).toHaveBeenCalledWith('ia-1', 'n1', { triggers: null });
    await waitFor(() => expect(salesAgentsService.get).toHaveBeenCalledWith('ia-1'));
  });

  it('"Todo lead do número" grava lista vazia', async () => {
    await abrir(agente());
    await userEvent.click(within(grupo('Gatilhos de Bia')).getByRole('radio', { name: 'Todo lead do número' }));
    expect(salesAgentsService.atualizarNumero).toHaveBeenCalledWith('ia-1', 'n2', { triggers: [] });
  });

  it('de todo lead pra "Os do agente" também grava nulo', async () => {
    await abrir(agente());
    await userEvent.click(within(grupo('Gatilhos de Caio')).getByRole('radio', { name: 'Os do agente' }));
    expect(salesAgentsService.atualizarNumero).toHaveBeenCalledWith('ia-1', 'n3', { triggers: null });
  });

  it('"Só alguns" abre as condições sem gravar, e a condição completa grava no número', async () => {
    await abrir(agente());
    await userEvent.click(within(grupo('Gatilhos de Bia')).getByRole('radio', { name: 'Só alguns' }));
    expect(salesAgentsService.atualizarNumero).not.toHaveBeenCalled();
    const bloco = screen.getByRole('group', { name: 'Condições de Bia' });
    await userEvent.click(within(bloco).getByRole('button', { name: /Adicionar condição/ }));
    expect(salesAgentsService.atualizarNumero).not.toHaveBeenCalled();
    await userEvent.type(within(bloco).getByPlaceholderText('palavra (ex: fluxoimob)'), 'oferta');
    await userEvent.tab();
    expect(salesAgentsService.atualizarNumero).toHaveBeenCalledWith('ia-1', 'n2', { triggers: [{ type: 'keyword', value: 'oferta', match_type: 'contains' }] });
  });

  it('mostra os avisos que o servidor devolveu na resposta do número', async () => {
    vi.mocked(salesAgentsService.atualizarNumero).mockResolvedValue({ warnings: ['A campanha X já é do Agente B neste número.'] } as never);
    await abrir(agente());
    await userEvent.click(within(grupo('Gatilhos de Bia')).getByRole('radio', { name: 'Todo lead do número' }));
    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith('A campanha X já é do Agente B neste número.'));
  });

  it('número dividido com outro agente ligado mostra a frase fixa; sozinho, não', async () => {
    const { unmount } = await abrir(agente());
    expect(screen.queryByText('No mesmo número, a mesma campanha não fica em dois agentes. Lead sem gatilho fica com o corretor.')).toBeNull();
    unmount();
    vi.mocked(salesAgentsService.list).mockResolvedValue([agenteDeTeste({ id: 'ia-2', name: 'Agente B', numbers: [numero('x1', 'Ana', null, 'i-n1')] })]);
    await abrir(agente());
    expect(await screen.findByText('No mesmo número, a mesma campanha não fica em dois agentes. Lead sem gatilho fica com o corretor.')).toBeInTheDocument();
  });
});

describe('Gatilhos do agente', () => {
  it('"Qualquer um" e "Todos" gravam o trigger_match_mode', async () => {
    const { gravar } = await abrir(agenteDeTeste({ triggers: [{ type: 'tag', value: 'vip' }, { type: 'origin', mode: 'ads' }], trigger_match_mode: 'any' }));
    const g = grupo('Combinar condições');
    expect(within(g).getByRole('radio', { name: 'Qualquer um' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(within(g).getByRole('radio', { name: 'Todos' }));
    expect(gravar).toHaveBeenCalledWith({ trigger_match_mode: 'all' });
  });

  it('"Todos os leads" limpa as condições e "Só alguns" abre sem gravar', async () => {
    const { gravar } = await abrir(agenteDeTeste({ triggers: [{ type: 'tag', value: 'vip' }] }));
    await userEvent.click(within(grupo('Quem ela atende')).getByRole('radio', { name: 'Todos os leads' }));
    expect(gravar).toHaveBeenCalledWith({ triggers: [] });
  });

  it('a palavra antiga mostra a frase e "Tirar essa regra" grava nulo', async () => {
    const { gravar } = await abrir(agenteDeTeste({ trigger_keyword: 'oferta' }));
    await userEvent.click(screen.getByRole('button', { name: 'Tirar essa regra' }));
    expect(gravar).toHaveBeenCalledWith({ trigger_keyword: null });
  });

  it('o tipo Campanha grava {type: campaign, campaign_link_ids}', async () => {
    const { gravar } = await abrir(
      agenteDeTeste({ triggers: [{ type: 'campaign', campaign_link_ids: [] }] }),
      [item({}), item({ key: 'form:f1', kind: 'form', label: 'Formulário Teste', link_id: null, form_config_id: 'f1' })],
    );
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Campanha Teste' }));
    expect(gravar).toHaveBeenCalledWith({ triggers: [{ type: 'campaign', campaign_link_ids: ['l1'] }] });
    // formulário não é campanha: só linhas de campanha entram na lista do gatilho
    expect(screen.queryByRole('checkbox', { name: 'Formulário Teste' })).toBeNull();
  });
});

describe('Começo por campanha', () => {
  const agente = (extra: Partial<SalesAgent> = {}) => agenteDeTeste({ openings: [{ label: 'Antiga', origins: ['meta'] }], ...extra });
  const itens = [
    item({}),
    item({ key: 'form:f1', kind: 'form', label: 'Formulário Teste', link_id: null, form_config_id: 'f1', sells_scope: null, property_ids: [] }),
    item({ key: 'campaign:Sem Linha', label: 'Sem Linha', link_id: null, match_value: 'Sem Linha', sells_scope: null, property_ids: [] }),
  ];

  it('uma linha por campanha da IA, com o que vende e o link pra Campanhas', async () => {
    await abrir(agente(), itens);
    expect(campanhasService.lista).toHaveBeenCalledWith({ salesAgentId: 'ia-1' });
    const bloco = await screen.findByRole('region', { name: 'Campanha Teste' });
    expect(within(bloco).getByText(/Vende: 2 imóveis/)).toBeInTheDocument();
    expect(within(bloco).getByRole('link', { name: /Campanhas/ })).toHaveAttribute('href', '/automations/origem');
    expect(within(bloco).getByText('Boas-vindas padrão')).toBeInTheDocument();
    expect(within(bloco).getByText('Sem print')).toBeInTheDocument();
    expect(within(bloco).getByText('Sem áudio')).toBeInTheDocument();
    expect(within(bloco).getByText('Intenção: automática')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Formulário Teste' })).getByText(/Vende: não diz/)).toBeInTheDocument();
  });

  it('resume o que a campanha tem de próprio', async () => {
    await abrir(agente({ openings: [{ ref: { kind: 'link', id: 'l1' }, greeting: 'Oi!', image_url: 'https://x/a.png', intent_question: 'Qual?' }] }), itens);
    const bloco = await screen.findByRole('region', { name: 'Campanha Teste' });
    expect(within(bloco).getByText('Boas-vindas própria')).toBeInTheDocument();
    expect(within(bloco).getByText('Com print')).toBeInTheDocument();
    expect(within(bloco).getByText('Intenção: texto próprio')).toBeInTheDocument();
  });

  it('grava as boas-vindas em openings com o ref e mantém os itens antigos', async () => {
    const { gravar } = await abrir(agente(), itens);
    const bloco = await screen.findByRole('region', { name: 'Campanha Teste' });
    await userEvent.click(within(bloco).getByRole('button', { name: 'Abrir' }));
    await userEvent.type(within(bloco).getByLabelText('Boas-vindas'), 'Oi, {{nome}!');
    expect(gravar).not.toHaveBeenCalled();
    await userEvent.tab();
    expect(gravar).toHaveBeenCalledWith({ openings: [{ label: 'Antiga', origins: ['meta'] }, { ref: { kind: 'link', id: 'l1' }, greeting: 'Oi, {nome}!' }] });
  });

  it('formulário grava ref kind form com o id da ficha', async () => {
    const { gravar } = await abrir(agente(), itens);
    const bloco = await screen.findByRole('region', { name: 'Formulário Teste' });
    await userEvent.click(within(bloco).getByRole('button', { name: 'Abrir' }));
    await userEvent.type(within(bloco).getByLabelText('Pergunta de intenção'), 'Pra morar ou investir?');
    await userEvent.tab();
    expect(gravar).toHaveBeenCalledWith({ openings: [expect.objectContaining({ label: 'Antiga' }), { ref: { kind: 'form', id: 'f1' }, intent_question: 'Pra morar ou investir?' }] });
  });

  it('campanha sem linha cria a linha antes (sem imóvel) e grava o ref link', async () => {
    vi.mocked(campanhasService.criarLinha).mockResolvedValue({ id: 'l9' } as never);
    const { gravar } = await abrir(agente(), itens);
    const bloco = await screen.findByRole('region', { name: 'Sem Linha' });
    await userEvent.click(within(bloco).getByRole('button', { name: 'Abrir' }));
    await userEvent.type(within(bloco).getByLabelText('Boas-vindas'), 'Oi!');
    await userEvent.tab();
    await waitFor(() => expect(gravar).toHaveBeenCalled());
    expect(campanhasService.criarLinha).toHaveBeenCalledWith({ match_kind: 'campaign', match_value: 'Sem Linha' });
    expect(gravar).toHaveBeenCalledWith({ openings: [expect.objectContaining({ label: 'Antiga' }), { ref: { kind: 'link', id: 'l9' }, greeting: 'Oi!' }] });
  });

  it('se a linha não puder ser criada, nada é gravado', async () => {
    vi.mocked(campanhasService.criarLinha).mockRejectedValue(new Error('nope'));
    const { gravar } = await abrir(agente(), itens);
    const bloco = await screen.findByRole('region', { name: 'Sem Linha' });
    await userEvent.click(within(bloco).getByRole('button', { name: 'Abrir' }));
    await userEvent.type(within(bloco).getByLabelText('Boas-vindas'), 'Oi!');
    await userEvent.tab();
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(gravar).not.toHaveBeenCalled();
  });

  it('apagar o texto tira a entrada que só tinha o ref (vazio = padrão)', async () => {
    const { gravar } = await abrir(agente({ openings: [{ label: 'Antiga' }, { ref: { kind: 'link', id: 'l1' }, greeting: 'Oi!' }] }), itens);
    const bloco = await screen.findByRole('region', { name: 'Campanha Teste' });
    await userEvent.click(within(bloco).getByRole('button', { name: 'Abrir' }));
    await userEvent.clear(within(bloco).getByLabelText('Boas-vindas'));
    await userEvent.tab();
    expect(gravar).toHaveBeenCalledWith({ openings: [{ label: 'Antiga' }] });
  });

  it('sem campaign_links.read o bloco some e a lista nem é pedida', async () => {
    pode.campanhas = false;
    await abrir(agente(), itens);
    expect(screen.queryByText('Começo por campanha')).toBeNull();
    expect(campanhasService.lista).not.toHaveBeenCalled();
    // os gatilhos seguem na tela
    expect(screen.getByText('Gatilhos por número')).toBeInTheDocument();
  });
});
