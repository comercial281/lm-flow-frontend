import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import DisparoDetalhe from './DisparoDetalhe';
import { NO_ACCESS_MESSAGE } from '@/components/permissions/noAccessCopy';

const s = vi.hoisted(() => ({
  get: vi.fn(), items: vi.fn(), pause: vi.fn(), resume: vi.fn(), cancel: vi.fn(),
  navegar: vi.fn(), pode: vi.fn(), toastErro: vi.fn(),
}));
vi.mock('react-router-dom', async orig => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => s.navegar,
}));
vi.mock('@/services/broadcasts/broadcastsService', () => ({
  broadcastsService: { get: s.get, items: s.items, pause: s.pause, resume: s.resume, cancel: s.cancel },
}));
vi.mock('@/hooks/useCan', () => ({ useCan: () => s.pode }));
vi.mock('sonner', () => ({ toast: { error: s.toastErro, success: vi.fn() } }));

const UUID = '7f9c2b1e-4a7d-4c1e-9b1a-1c2d3e4f5a6b';
const campanha = {
  id: 'c1', name: 'Oferta junho', pipeline_id: 'p1', status: 'running', variations: [], total_count: 4,
  sent_count: 1, failed_count: 1, skipped_count: 1, pending_count: 1, sender_name: 'Comercial',
  sender_phone: '5511999990000', mode: 'message', pace: 'normal', pause_reason: null, pause_message: null,
  estimated_finish_at: null, created_by_name: 'Ana', created_at: '2026-10-16T17:00:00Z',
};
const linhas = [
  { id: 'i1', lead_name: 'Maria', phone: '5511988887777', status: 'sent', reason: null, sent_at: '2026-10-16T17:32:00Z', conversation_id: UUID },
  { id: 'i2', lead_name: 'João', phone: '5511977776666', status: 'failed', reason: 'número não tem WhatsApp', sent_at: null, conversation_id: null },
  { id: 'i3', lead_name: 'Rita', phone: '5511966665555', status: 'skipped', reason: 'lead de outro corretor', sent_at: null, conversation_id: null },
  { id: 'i4', lead_name: 'Paulo', phone: '5511955554444', status: 'pending', reason: null, sent_at: null, conversation_id: null },
];
const counts = { pending: 1, sending: 0, sent: 1, failed: 1, skipped: 1, cancelled: 0 };
const fila = (data: unknown[] = linhas, total = data.length) => ({ data, meta: { total, page: 1, per_page: 50, counts } });

const tela = () =>
  render(
    <MemoryRouter initialEntries={['/disparos/c1']}>
      <Routes><Route path="/disparos/:id" element={<DisparoDetalhe />} /></Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  for (const f of Object.values(s)) f.mockReset();
  s.pode.mockReturnValue(true);
  s.get.mockResolvedValue(campanha);
  s.items.mockResolvedValue(fila());
});
afterEach(() => { vi.useRealTimers(); });

describe('DisparoDetalhe', () => {
  it('mostra o cabeçalho, os números e o motivo de falha e de quem ficou de fora', async () => {
    tela();
    expect(await screen.findByText('Falhou: número não tem WhatsApp')).toBeInTheDocument();
    expect(screen.getByText('Ficou de fora: lead de outro corretor')).toBeInTheDocument();
    expect(screen.getByText('Oferta junho')).toBeInTheDocument();
    expect(screen.getByText(/Sai por Comercial/)).toBeInTheDocument();
    expect(screen.getByText(/Criado por Ana em/)).toBeInTheDocument();
    expect(screen.getByText('Pacote Normal')).toBeInTheDocument();
    const numeros = screen.getByRole('list', { name: 'Números do disparo' });
    for (const n of ['Na fila', 'Enviadas', 'Falhas', 'Ficaram de fora']) {
      expect(within(numeros).getByText(n)).toBeInTheDocument();
    }
    expect(within(numeros).queryByText('Entregues')).toBeNull();
    expect(s.items).toHaveBeenCalledWith('c1', { page: 1 });
  });

  it('no modo funil, "Enviadas" vira "Entraram no funil" nos números e no filtro', async () => {
    s.get.mockResolvedValue({ ...campanha, mode: 'flow', flow_name: 'Boas-vindas' });
    s.items.mockResolvedValue(fila([{ ...linhas[0], status: 'in_funnel' }]));
    tela();
    expect(await screen.findByText(/^Entrou no funil (às|em)/)).toBeInTheDocument();
    expect(screen.getByText('Funil Boas-vindas')).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'Números do disparo' })).getByText('Entraram no funil')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Entraram no funil' })).toBeInTheDocument();
    expect(screen.queryByText('Enviadas')).toBeNull();
  });

  it('no oficial mostra também entregues, lidas e respostas', async () => {
    s.get.mockResolvedValue({ ...campanha, mode: 'template', delivered_count: 9, read_count: 7, replied_count: 3 });
    tela();
    const numeros = await screen.findByRole('list', { name: 'Números do disparo' });
    expect(within(numeros).getByText('Entregues')).toBeInTheDocument();
    expect(within(numeros).getByText('Lidas')).toBeInTheDocument();
    expect(within(numeros).getByText('Respostas')).toBeInTheDocument();
  });

  it('clicar numa linha com conversa abre a conversa; linha sem conversa não é clicável', async () => {
    tela();
    await screen.findByText('Maria');
    const link = screen.getByRole('link', { name: 'Maria' });
    expect(link).toHaveAttribute('href', `/conversations/${UUID}`);
    await userEvent.click(screen.getByText(/^Enviada (às|em)/));
    expect(s.navegar).toHaveBeenCalledWith(`/conversations/${UUID}`);
    s.navegar.mockReset();
    expect(screen.queryByRole('link', { name: 'João' })).toBeNull();
    await userEvent.click(screen.getByText('João'));
    expect(s.navegar).not.toHaveBeenCalled();
  });

  it('enviada hoje mostra só a hora; de outro dia mostra a data (hora de São Paulo)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-16T20:00:00Z')); // 16/10 17:00 em SP
    s.items.mockResolvedValue(fila([
      linhas[0],
      { ...linhas[1], id: 'i5', lead_name: 'Bia', status: 'sent', reason: null, sent_at: '2026-10-15T12:05:00Z' },
    ]));
    tela();
    expect(await screen.findByText('Enviada às 14:32')).toBeInTheDocument();
    expect(screen.getByText('Enviada em 15/10 às 09:05')).toBeInTheDocument();
  });

  it('no modo funil, entrada de outro dia mostra a data', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-17T13:00:00Z'));
    s.get.mockResolvedValue({ ...campanha, mode: 'flow', flow_name: 'Boas-vindas' });
    s.items.mockResolvedValue(fila([{ ...linhas[0], status: 'in_funnel' }]));
    tela();
    expect(await screen.findByText('Entrou no funil em 16/10 às 14:32')).toBeInTheDocument();
  });

  it('no modo automação, mostra "Automação X", "Entrou na automação às HH:MM" e o filtro certo', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-16T18:00:00Z'));
    s.get.mockResolvedValue({ ...campanha, mode: 'automation', flow_name: 'Pós-visita' });
    s.items.mockResolvedValue(fila([{ ...linhas[0], status: 'in_funnel' }]));
    tela();
    expect(await screen.findByText('Entrou na automação às 14:32')).toBeInTheDocument();
    expect(screen.getByText('Automação Pós-visita')).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'Números do disparo' })).getByText('Entraram na automação')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Entraram na automação' })).toBeInTheDocument();
  });

  it('no modo automação, entrada de outro dia mostra a data e o lead pausado diz por quê', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-17T13:00:00Z'));
    s.get.mockResolvedValue({ ...campanha, mode: 'automation', flow_name: 'Pós-visita' });
    s.items.mockResolvedValue(fila([
      { ...linhas[0], status: 'in_funnel' },
      { ...linhas[1], status: 'in_funnel', reason: null, sent_at: '2026-10-16T17:40:00Z', flow_paused: 'other_number' },
    ]));
    tela();
    expect(await screen.findByText('Entrou na automação em 16/10 às 14:32')).toBeInTheDocument();
    expect(screen.getByText('Entrou na automação, pausado: já conversa em outro número')).toBeInTheDocument();
    expect(screen.getByText('Entrou na automação, pausado: já conversa em outro número')).toHaveClass('text-amber-600');
    expect(screen.getByText('Entrou na automação em 16/10 às 14:32')).toHaveClass('text-blue-500');
  });

  it('pausado porque o número de saída não existe mais mostra a frase do servidor', async () => {
    const aviso = 'O número de saída deste disparo não existe mais. Crie um novo disparo.';
    s.get.mockResolvedValue({ ...campanha, status: 'paused', pause_reason: 'number_removed', pause_message: aviso });
    tela();
    expect(await screen.findByText(aviso)).toBeInTheDocument();
  });

  it('o filtro "Falhas" chama a fila só com as falhas, na página 1', async () => {
    tela();
    await screen.findByText('Maria');
    s.items.mockResolvedValue(fila([linhas[1]]));
    await userEvent.click(screen.getByRole('radio', { name: 'Falhas' }));
    await waitFor(() => expect(s.items).toHaveBeenLastCalledWith('c1', { status: 'failed', page: 1 }));
    await waitFor(() => expect(screen.queryByText('Maria')).toBeNull());
  });

  it('"Carregar mais" junta a página seguinte', async () => {
    s.items.mockResolvedValueOnce(fila(linhas.slice(0, 2), 4));
    tela();
    await screen.findByText('Maria');
    s.items.mockResolvedValueOnce({ ...fila(linhas.slice(2), 4), meta: { total: 4, page: 2, per_page: 50, counts } });
    await userEvent.click(screen.getByRole('button', { name: 'Carregar mais' }));
    expect(await screen.findByText('Paulo')).toBeInTheDocument();
    expect(screen.getByText('Maria')).toBeInTheDocument();
    expect(s.items).toHaveBeenLastCalledWith('c1', { page: 2 });
    expect(screen.queryByRole('button', { name: 'Carregar mais' })).toBeNull();
  });

  it('enviando, atualiza sozinha a cada 20 s', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    tela();
    await screen.findByText('Maria');
    expect(s.items).toHaveBeenCalledTimes(1);
    await act(async () => { vi.advanceTimersByTime(20000); });
    await waitFor(() => expect(s.items).toHaveBeenCalledTimes(2));
    expect(s.get).toHaveBeenCalledTimes(2);
  });

  it('concluído, não atualiza sozinha', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    s.get.mockResolvedValue({ ...campanha, status: 'completed' });
    tela();
    await screen.findByText('Maria');
    await act(async () => { vi.advanceTimersByTime(20000); });
    expect(s.items).toHaveBeenCalledTimes(1);
  });

  it('pausado por número caído mostra o aviso; Retomar recusado mostra a frase do servidor e continua Pausado', async () => {
    const aviso = 'Pausado: o número (11) 99999-0000 desconectou. Reconecte em Canais e clique em Retomar.';
    s.get.mockResolvedValue({ ...campanha, status: 'paused', pause_reason: 'number_disconnected', pause_message: aviso });
    s.resume.mockRejectedValue({ response: { status: 422, data: { errors: [aviso] } } });
    tela();
    expect(await screen.findByText(aviso)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retomar' }));
    await waitFor(() => expect(s.toastErro).toHaveBeenCalledWith(aviso));
    expect(s.resume).toHaveBeenCalledWith('c1');
    expect(screen.getByText('Pausado')).toBeInTheDocument();
  });

  it('Cancelar pergunta antes e só cancela se confirmar', async () => {
    s.cancel.mockResolvedValue({ ...campanha, status: 'cancelled' });
    tela();
    await screen.findByText('Maria');
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByText('Cancelar este disparo?')).toBeInTheDocument();
    expect(screen.getByText('Quem ainda está na fila não recebe.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(s.cancel).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar disparo' }));
    await waitFor(() => expect(s.cancel).toHaveBeenCalledWith('c1'));
    expect(await screen.findByText('Cancelado')).toBeInTheDocument();
  });

  it('sem permissão, não mostra Pausar nem Cancelar', async () => {
    s.pode.mockReturnValue(false);
    tela();
    await screen.findByText('Maria');
    expect(screen.queryByRole('button', { name: 'Pausar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancelar' })).toBeNull();
  });

  it('disparo que não existe mostra "Disparo não encontrado."', async () => {
    s.get.mockRejectedValue({ response: { status: 404 } });
    s.items.mockRejectedValue({ response: { status: 404 } });
    tela();
    expect(await screen.findByText('Disparo não encontrado.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Voltar aos Disparos' }));
    expect(s.navegar).toHaveBeenCalledWith('/disparos');
  });

  it('sem acesso ao disparo mostra a recusa por cargo', async () => {
    s.get.mockRejectedValue({ response: { status: 403 } });
    s.items.mockRejectedValue({ response: { status: 403 } });
    tela();
    expect(await screen.findByText(NO_ACCESS_MESSAGE)).toBeInTheDocument();
  });

  it('erro ao carregar mostra o erro e Tentar de novo recarrega', async () => {
    s.get.mockRejectedValueOnce(new Error('rede'));
    tela();
    expect(await screen.findByText('Não deu pra carregar')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Maria')).toBeInTheDocument();
  });
});
