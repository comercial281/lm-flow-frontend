import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Disparos from './Disparos';

const s = vi.hoisted(() => ({ listAll: vi.fn(), funis: vi.fn(), navegar: vi.fn(), pode: vi.fn() }));
vi.mock('react-router-dom', async orig => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => s.navegar,
}));
vi.mock('@/services/broadcasts/broadcastsService', () => ({
  broadcastsService: { listAll: s.listAll },
}));
vi.mock('@/services/pipelines/pipelinesService', () => ({
  pipelinesService: { getPipelines: s.funis },
}));
vi.mock('@/hooks/useCan', () => ({ useCan: () => s.pode }));
vi.mock('@/components/pipelines/BulkDispatchModal', () => ({
  default: (p: { open: boolean; pipelineId: string; funis?: unknown[] }) =>
    p.open ? <div>janela {p.pipelineId} com {p.funis?.length} funis</div> : null,
}));

const base = {
  pipeline_id: 'p1', status: 'running', variations: [], total_count: 100, sent_count: 10, failed_count: 1,
  skipped_count: 2, pending_count: 87, sender_name: 'Comercial', sender_phone: '5511999990000',
  mode: 'message', pace: 'normal', pause_message: null, estimated_finish_at: null,
};
const c1 = { ...base, id: 'c1', name: 'Oferta junho' };
const c2 = { ...base, id: 'c2', name: 'Plantão', pipeline_id: 'p2', mode: 'flow', flow_name: 'Boas-vindas', pace: 'slow' };
const c3 = { ...base, id: 'c3', name: 'Reativação', mode: 'automation', flow_name: 'Pós-visita' };
const tela = () => render(<MemoryRouter><Disparos /></MemoryRouter>);
const resposta = (data: unknown[]) => ({ data, meta: { total: data.length, page: 1, per_page: 25 } });

beforeEach(() => {
  s.listAll.mockReset();
  s.funis.mockReset();
  s.navegar.mockReset();
  s.pode.mockReset().mockReturnValue(true);
  s.funis.mockResolvedValue({ data: [{ id: 'p1', name: 'Vendas' }, { id: 'p2', name: 'Locação' }] });
});

describe('Disparos', () => {
  it('lista campanhas de dois funis, sem abas, com os números do topo', async () => {
    s.listAll.mockResolvedValue(resposta([c1, c2]));
    tela();
    expect(await screen.findByText('Oferta junho')).toBeInTheDocument();
    expect(screen.getByText('Plantão')).toBeInTheDocument();
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.getByText('Todos os funis')).toBeInTheDocument();
    expect(screen.getByText('Funil Boas-vindas')).toBeInTheDocument();
    expect(screen.getByText('Mensagem')).toBeInTheDocument();
    expect(screen.getByText('Devagar')).toBeInTheDocument();
    expect(screen.getAllByText('13 de 100')).toHaveLength(2);
    expect(screen.getByText('Na fila')).toBeInTheDocument();
    expect(screen.getByText('174')).toBeInTheDocument();
    expect(screen.getByText('Enviadas')).toBeInTheDocument();
    expect(screen.getByText('Falhas')).toBeInTheDocument();
  });

  it('disparo de automação aparece como "Automação <nome>"', async () => {
    s.listAll.mockResolvedValue(resposta([c3]));
    tela();
    expect(await screen.findByText('Automação Pós-visita')).toBeInTheDocument();
  });

  it('filtrar por funil chama listAll com o pipeline_id', async () => {
    s.listAll.mockResolvedValue(resposta([c1, c2]));
    tela();
    await screen.findByText('Oferta junho');
    await waitFor(() => expect(screen.getByRole('option', { name: 'Locação' })).toBeInTheDocument());
    s.listAll.mockResolvedValue(resposta([c2]));
    await userEvent.selectOptions(screen.getByLabelText('Funil'), 'p2');
    await waitFor(() => expect(s.listAll).toHaveBeenLastCalledWith({ pipeline_id: 'p2', page: 1 }));
    await waitFor(() => expect(screen.queryByText('Oferta junho')).toBeNull());
  });

  it('clicar na linha abre o disparo', async () => {
    s.listAll.mockResolvedValue(resposta([c1]));
    tela();
    await userEvent.click(await screen.findByText('Normal'));
    expect(s.navegar).toHaveBeenCalledWith('/disparos/c1');
    expect(s.navegar).toHaveBeenCalledTimes(1);
  });

  it('o nome do disparo é um link pro detalhe e não navega duas vezes', async () => {
    s.listAll.mockResolvedValue(resposta([c1]));
    tela();
    const link = await screen.findByRole('link', { name: 'Oferta junho' });
    expect(link).toHaveAttribute('href', '/disparos/c1');
    await userEvent.click(link);
    expect(s.navegar).not.toHaveBeenCalled();
  });

  it('pausado com motivo mostra a frase', async () => {
    s.listAll.mockResolvedValue(resposta([{ ...c1, status: 'paused', pause_message: 'O número caiu. Reconecte pra retomar.' }]));
    tela();
    expect(await screen.findByText('Pausado')).toBeInTheDocument();
    expect(screen.getByText('O número caiu. Reconecte pra retomar.')).toBeInTheDocument();
  });

  it('Novo disparo abre a janela no primeiro funil com o seletor de funil', async () => {
    s.listAll.mockResolvedValue(resposta([c1]));
    tela();
    await screen.findByText('Oferta junho');
    await waitFor(() => expect(screen.getByRole('button', { name: /Novo disparo/ })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: /Novo disparo/ }));
    expect(screen.getByText('janela p1 com 2 funis')).toBeInTheDocument();
  });

  it('sem permissão de criar, não mostra Novo disparo', async () => {
    s.pode.mockReturnValue(false);
    s.listAll.mockResolvedValue(resposta([c1]));
    tela();
    await screen.findByText('Oferta junho');
    expect(screen.queryByRole('button', { name: /Novo disparo/ })).toBeNull();
  });

  it('corretor (só broadcasts.own) vê Novo disparo', async () => {
    s.pode.mockImplementation((r: string, a: string) => r === 'broadcasts' && a === 'own');
    s.listAll.mockResolvedValue(resposta([c1]));
    tela();
    await screen.findByText('Oferta junho');
    expect(screen.getByRole('button', { name: /Novo disparo/ })).toBeInTheDocument();
  });

  it('erro ao carregar mostra o erro e Tentar de novo recarrega', async () => {
    s.listAll.mockRejectedValueOnce(new Error('rede'));
    tela();
    expect(await screen.findByText('Não deu pra carregar')).toBeInTheDocument();
    expect(screen.queryByText(/Nenhum disparo/)).toBeNull();
    s.listAll.mockResolvedValueOnce(resposta([c1]));
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Oferta junho')).toBeInTheDocument();
  });
  describe('agendar o início e limite por dia (10/11/2026)', () => {
    afterEach(() => vi.useRealTimers());
    // Terça 20/10/2026, 10h em São Paulo.
    const agora = () => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-20T13:00:00Z')); };

    it('agendado aparece como "Agendado · começa 24/12 às 09:00", com a previsão do servidor', async () => {
      agora();
      s.listAll.mockResolvedValue(resposta([{
        ...c1, scheduled: true, starts_at: '2026-12-24T09:00:00-03:00', next_run_at: '2026-12-24T12:00:00Z',
        estimated_finish_at: '2026-12-24T15:00:00Z', sent_count: 0, failed_count: 0, skipped_count: 0,
      }]));
      tela();
      expect(await screen.findByText('Agendado')).toBeInTheDocument();
      expect(screen.getByText('começa 24/12 às 09:00')).toBeInTheDocument();
      expect(screen.queryByText('Enviando')).toBeNull();
      expect(screen.getByText('termina em 24/12 por volta das 12h')).toBeInTheDocument();
    });

    it('com limite mostra "Até 20 por dia" junto do ritmo', async () => {
      s.listAll.mockResolvedValue(resposta([{ ...c1, daily_limit: 20, sent_today: 5 }]));
      tela();
      expect(await screen.findByText('Até 20 por dia')).toBeInTheDocument();
      expect(screen.getByText('Normal')).toBeInTheDocument();
    });

    it('limite de hoje batido diz quando volta, pelo next_run_at', async () => {
      agora();
      s.listAll.mockResolvedValue(resposta([{
        ...c1, daily_limit: 20, sent_today: 20, daily_limit_reached: true, next_run_at: '2026-10-21T11:00:00Z',
      }]));
      tela();
      expect(await screen.findByText('Limite de hoje atingido · volta amanhã às 8h')).toBeInTheDocument();
      expect(screen.getByText('Enviando')).toBeInTheDocument();
    });

    it('sem os campos novos (servidor antigo), tudo como antes', async () => {
      s.listAll.mockResolvedValue(resposta([c1]));
      tela();
      expect(await screen.findByText('Enviando')).toBeInTheDocument();
      expect(screen.queryByText(/por dia/)).toBeNull();
      expect(screen.queryByText('Agendado')).toBeNull();
      expect(screen.queryByText(/Limite de hoje/)).toBeNull();
    });

    it('estado desconhecido não quebra a lista', async () => {
      s.listAll.mockResolvedValue(resposta([{ ...c1, status: 'scheduled' }]));
      tela();
      expect(await screen.findByText('Oferta junho')).toBeInTheDocument();
    });
  });
});
