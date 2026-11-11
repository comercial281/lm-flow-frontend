import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { PaginaDeSite } from '@/services/externalLeadPages/externalLeadPagesService';

const svc = vi.hoisted(() => ({ listar: vi.fn(), salvar: vi.fn(), trocarEndereco: vi.fn(), envios: vi.fn() }));
const perm = vi.hoisted(() => ({ editar: true }));
vi.mock('@/hooks/useCan', () => ({ useCan: () => () => perm.editar }));
vi.mock('@/services/properties/propertiesService', () => ({ propertiesService: { get: vi.fn(), list: vi.fn().mockResolvedValue({ data: [], meta: { total: 0 } }) } }));
vi.mock('@/store/authStore', () => ({ useAuthStore: (sel: (s: unknown) => unknown) => sel({ currentUser: { id: 'u1' } }) }));
vi.mock('@/services/externalLeadPages/externalLeadPagesService', () => ({ externalLeadPagesService: svc }));
const listas = vi.hoisted(() => ({ pipelines: vi.fn(), etapas: vi.fn(), users: vi.fn(), roletas: vi.fn() }));
vi.mock('@/services/pipelines/pipelinesService', () => ({ pipelinesService: { getPipelines: listas.pipelines, getPipelineStages: listas.etapas } }));
vi.mock('@/services/users/usersService', () => ({ default: { getUsers: listas.users } }));
vi.mock('@/services/roletaConfig/roletaConfigService', async (orig) => {
  const real = await orig<typeof import('@/services/roletaConfig/roletaConfigService')>();
  return { ...real, roletaConfigService: { getAll: listas.roletas } };
});
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import SitesELandingPages from './SitesELandingPages';

const pagina = (extra: Partial<PaginaDeSite> = {}): PaginaDeSite => ({
  id: 'x', name: 'LP Centro', active: true, pipeline_id: 'f1', stage_id: 'e1', roleta_config_id: null, default_assignee_id: null,
  property_id: null, labels: ['site'], endpoint_url: 'https://api/x', last_received_at: null, leads_30d: 0, last_delivery: null, rejected_last_24h: 0, ...extra,
});
const envio = { at: '2026-11-10T16:40:00Z', outcome: 'entered' as const, summary: null, page_host: 'exemplo.com.br' };

const tres = () => [
  pagina({ id: 'a', name: 'LP Centro', roleta_config_id: 'r1', leads_30d: 12, last_delivery: envio }),
  pagina({ id: 'b', name: 'Site Principal', default_assignee_id: 'u1', leads_30d: 3, rejected_last_24h: 3, last_delivery: { ...envio, page_host: null } }),
  pagina({ id: 'c', name: 'LP Nova', active: false }),
];

const abrir = vi.fn();
const montar = () => render(<MemoryRouter><SitesELandingPages aoAbrir={abrir} /></MemoryRouter>);
const montarReal = () => render(<MemoryRouter><SitesELandingPages /></MemoryRouter>);

beforeEach(() => {
  perm.editar = true;
  svc.listar.mockReset(); svc.salvar.mockReset(); svc.trocarEndereco.mockReset(); svc.envios.mockReset().mockResolvedValue([]); abrir.mockReset();
  listas.pipelines.mockReset().mockResolvedValue({ data: [{ id: 'f1', name: 'Vendas' }] });
  listas.etapas.mockReset().mockResolvedValue({ data: [{ id: 'e1', name: 'Novo' }] });
  listas.users.mockReset().mockResolvedValue({ data: [{ id: 'u1', name: 'Ana Lima' }] });
  listas.roletas.mockReset().mockResolvedValue([{ id: 'r1', display_name: 'Roleta Centro', is_active: true, members: [{ is_active: true }, { is_active: true }, { is_active: false }] }]);
});

describe('SitesELandingPages', () => {
  it('mostra as linhas com os selos e quem assume certos', async () => {
    svc.listar.mockResolvedValue(tres());
    montar();
    const [a, b, c] = await screen.findAllByTestId('linha-da-pagina');
    await within(a).findByText('Roleta Centro');
    expect(within(a).getByText('LP Centro')).toBeInTheDocument();
    expect(within(a).getByText('exemplo.com.br')).toBeInTheDocument();
    expect(within(a).getByText('Vendas › Novo')).toBeInTheDocument();
    expect(within(a).getByText('Roleta Centro')).toBeInTheDocument();
    expect(within(a).getByText('2 corretores na fila')).toBeInTheDocument();
    expect(within(a).getByText(/10\/11\/2026/)).toBeInTheDocument();
    expect(within(b).getByText('Ana Lima')).toBeInTheDocument();
    expect(within(b).getByText('Corretor fixo')).toBeInTheDocument();
    expect(within(b).getByText('3 recusados')).toBeInTheDocument();
    expect(within(c).getByText('Ninguém')).toBeInTheDocument();
    expect(within(c).getByText('Entra sem responsável')).toBeInTheDocument();
    expect(within(c).getByText('Esperando o 1º envio')).toBeInTheDocument();
  });

  it('plural: 1 recusado; envio com falha vira erro', async () => {
    svc.listar.mockResolvedValue([
      pagina({ id: 'a', rejected_last_24h: 1, last_delivery: envio }),
      pagina({ id: 'b', last_delivery: { ...envio, outcome: 'failed' } }),
    ]);
    montar();
    expect(await screen.findByText('1 recusado')).toBeInTheDocument();
    expect(screen.getByText('Erro no último envio')).toBeInTheDocument();
  });

  it('clicar na linha abre; clicar na chave salva na hora e não abre', async () => {
    svc.listar.mockResolvedValue(tres());
    svc.salvar.mockResolvedValue(pagina({ id: 'c', name: 'LP Nova', active: true }));
    montar();
    const linhas = await screen.findAllByTestId('linha-da-pagina');
    fireEvent.click(linhas[1]);
    expect(abrir).toHaveBeenCalledWith(expect.objectContaining({ id: 'b' }));
    abrir.mockClear();
    fireEvent.click(within(linhas[2]).getByRole('switch'));
    await waitFor(() => expect(svc.salvar).toHaveBeenCalledWith('c', { active: true }));
    expect(abrir).not.toHaveBeenCalled();
  });

  it('enquanto as listas carregam não diz "Não encontrado"', async () => {
    svc.listar.mockResolvedValue(tres());
    listas.roletas.mockReturnValue(new Promise(() => undefined));
    listas.users.mockReturnValue(new Promise(() => undefined));
    montar();
    await screen.findAllByTestId('linha-da-pagina');
    expect(screen.queryByText('Não encontrado')).toBeNull();
    expect(screen.getAllByLabelText('Carregando').length).toBeGreaterThan(0);
  });

  it('lista de roletas ou equipe que falhou mostra "—", nunca "Não encontrado"', async () => {
    svc.listar.mockResolvedValue(tres());
    listas.roletas.mockRejectedValue(new Error('403'));
    listas.users.mockRejectedValue(new Error('403'));
    montar();
    const [a, b] = await screen.findAllByTestId('linha-da-pagina');
    await waitFor(() => expect(within(a).queryByLabelText('Carregando')).toBeNull());
    expect(screen.queryByText('Não encontrado')).toBeNull();
    expect(within(a).queryByText('Roleta Centro')).toBeNull();
    expect(within(b).queryByText('Ana Lima')).toBeNull();
  });

  it('lista carregada sem o id: "Não encontrado"', async () => {
    svc.listar.mockResolvedValue([pagina({ roleta_config_id: 'apagada' })]);
    montar();
    expect(await screen.findByText('Não encontrado')).toBeInTheDocument();
  });

  it('salvar recusado: a chave volta ao estado anterior', async () => {
    svc.listar.mockResolvedValue(tres());
    svc.salvar.mockRejectedValue(new Error('500'));
    montar();
    const linhas = await screen.findAllByTestId('linha-da-pagina');
    const chave = within(linhas[2]).getByRole('switch');
    expect(chave).not.toBeChecked();
    fireEvent.click(chave);
    await waitFor(() => expect(svc.salvar).toHaveBeenCalled());
    await waitFor(() => expect(chave).not.toBeChecked());
    expect(abrir).not.toHaveBeenCalled();
  });

  it('lista vazia: estado vazio com + Nova página', async () => {
    svc.listar.mockResolvedValue([]);
    montar();
    expect(await screen.findByText('Ligue a primeira página')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Nova página/ }));
    expect(abrir).toHaveBeenCalledWith(null);
  });

  it('falha ao carregar: erro, não lista vazia', async () => {
    svc.listar.mockRejectedValue(new Error('500'));
    montar();
    expect(await screen.findByText('Não deu pra carregar')).toBeInTheDocument();
    expect(screen.queryByText('Ligue a primeira página')).toBeNull();
  });

  it('caminho real (sem aoAbrir): trocar o endereço, fechar e reabrir a mesma linha mostra o endereço NOVO', async () => {
    const velha = pagina({ id: 'a', name: 'LP Centro', endpoint_url: 'https://api/velho' });
    const nova = { ...velha, endpoint_url: 'https://api/novo' };
    svc.listar.mockResolvedValueOnce([velha]).mockResolvedValue([nova]);
    svc.trocarEndereco.mockResolvedValue({ endpoint_url: 'https://api/novo' });
    montarReal();
    fireEvent.click((await screen.findAllByTestId('linha-da-pagina'))[0]);
    expect(await screen.findByText('https://api/velho')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Trocar endereço' }));
    fireEvent.click(screen.getByRole('button', { name: 'Trocar agora' }));
    expect(await screen.findByText('https://api/novo')).toBeInTheDocument();
    await waitFor(() => expect(svc.listar).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getAllByRole('button', { name: 'Fechar' })[0]);
    await waitFor(() => expect(screen.queryByText('https://api/novo')).toBeNull());
    fireEvent.click((await screen.findAllByTestId('linha-da-pagina'))[0]);
    expect(await screen.findByText('https://api/novo')).toBeInTheDocument();
    expect(screen.queryByText('https://api/velho')).toBeNull();
  });

  it('recarga que falhou com páginas na tela: aviso com tentar de novo, lista antiga fica', async () => {
    svc.listar.mockResolvedValueOnce(tres()).mockRejectedValueOnce(new Error('500')).mockResolvedValue(tres());
    svc.salvar.mockResolvedValue(pagina({ id: 'a', active: false }));
    montarReal();
    fireEvent.click((await screen.findAllByTestId('linha-da-pagina'))[0]);
    fireEvent.click(await screen.findByRole('switch', { name: 'Página ativa' }));
    expect(await screen.findByText('Não deu pra atualizar a lista. Tente de novo.')).toBeInTheDocument();
    expect(screen.getAllByTestId('linha-da-pagina', { hidden: true }).length).toBe(3);
    fireEvent.click(screen.getByText('Tentar de novo'));
    await waitFor(() => expect(screen.queryByText('Não deu pra atualizar a lista. Tente de novo.')).toBeNull());
  });

  it('recarga mais velha que chega depois não pisa na mais nova', async () => {
    let soltar: (v: PaginaDeSite[]) => void = () => undefined;
    const lenta = new Promise<PaginaDeSite[]>((r) => { soltar = r; });
    svc.listar.mockResolvedValueOnce([pagina({ id: 'a', name: 'LP Centro' })]).mockReturnValueOnce(lenta)
      .mockResolvedValueOnce([pagina({ id: 'a', name: 'Página Nova' })]);
    svc.salvar.mockResolvedValue(pagina({ id: 'a' }));
    montarReal();
    fireEvent.click((await screen.findAllByTestId('linha-da-pagina'))[0]);
    fireEvent.click(await screen.findByRole('switch', { name: 'Página ativa' }));
    await waitFor(() => expect(svc.listar).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole('switch', { name: 'Página ativa' }));
    await waitFor(() => expect(svc.listar).toHaveBeenCalledTimes(3));
    expect(await screen.findByText('Página Nova')).toBeInTheDocument();
    soltar([pagina({ id: 'a', name: 'Página Velha' })]);
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByText('Página Velha')).toBeNull();
    expect(screen.getByText('Página Nova')).toBeInTheDocument();
  });

  it('roleta desligada mostra "(desligada)" na lista', async () => {
    listas.roletas.mockResolvedValue([{ id: 'r1', display_name: 'Roleta Centro', is_active: false, members: [] }]);
    svc.listar.mockResolvedValue([pagina({ roleta_config_id: 'r1' })]);
    montar();
    expect(await screen.findByText('Roleta Centro (desligada)')).toBeInTheDocument();
  });

  it('último envio sem desfecho fica neutro, não verde', async () => {
    svc.listar.mockResolvedValue([pagina({ last_delivery: { ...envio, outcome: null } })]);
    montar();
    const linha = await screen.findByTestId('linha-da-pagina');
    const selo = within(linha).getByText(/10\/11\/2026/);
    expect(selo.className).not.toMatch(/emerald/);
  });

  it('só leitura: sem + Nova página e a Chave da lista fica desabilitada', async () => {
    perm.editar = false;
    svc.listar.mockResolvedValue(tres());
    montar();
    const linhas = await screen.findAllByTestId('linha-da-pagina');
    expect(screen.queryByRole('button', { name: /Nova página/ })).toBeNull();
    expect(within(linhas[0]).getByRole('switch')).toBeDisabled();
  });
});
