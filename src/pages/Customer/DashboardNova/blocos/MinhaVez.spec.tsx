// src/pages/Customer/DashboardNova/blocos/MinhaVez.spec.tsx
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

const queuePosition = vi.fn();
vi.mock('@/services/roletaConfig/brokerAssignmentsService', () => ({
  brokerAssignmentsService: { queuePosition: () => queuePosition() },
}));
let ofertas: { id: string }[] = [];
vi.mock('@/contexts/PendingOffersContext', () => ({ usePendingOffers: () => ({ offers: ofertas }) }));

import { MinhaVez } from './MinhaVez';
import type { ContextoBloco } from '../usePodeAbrir';

const pode = { imoveis: true, agenda: true, propostas: true, funil: true, roleta: false, conversas: true };
const ctx = (over: Partial<ContextoBloco> = {}): ContextoBloco =>
  ({ dados: null, carregando: false, visao: 'corretor', pode, filtros: { preset: 'last_7_days' },
    funil: { dados: null, carregando: false, pendente: false, erro: null, recarregar: vi.fn() }, abrirLista: vi.fn(), mudarFunil: vi.fn(), ...over });

const linha = (id: string, nome: string, extra = {}) =>
  ({ roleta_id: id, roleta_nome: nome, situacao: 'na_fila', posicao: 3, total: 8, com_oferta: false, ...extra });

const montar = async (c: ContextoBloco) => {
  let r!: ReturnType<typeof render>;
  await act(async () => { r = render(<MinhaVez {...c} />); });
  return r;
};

const mudarVisibilidade = (estado: 'visible' | 'hidden') => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => estado });
  document.dispatchEvent(new Event('visibilitychange'));
};

const arrastar = (de: number, ate: number) => {
  const alvo = screen.getByTestId('minha-vez-arraste');
  fireEvent.pointerDown(alvo, { clientX: de });
  fireEvent.pointerUp(alvo, { clientX: ate });
};

describe('MinhaVez', () => {
  beforeAll(() => {
    // O jsdom não tem PointerEvent: sem ele o clientX do arraste chega vazio.
    if (!('PointerEvent' in window)) {
      (window as unknown as { PointerEvent: typeof MouseEvent }).PointerEvent = class extends MouseEvent {};
    }
  });

  beforeEach(() => {
    queuePosition.mockReset();
    ofertas = [];
  });

  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(document, 'visibilityState');
  });

  it('mostra a posição e quantos estão na frente', async () => {
    queuePosition.mockResolvedValue([linha('r1', 'Vendas')]);
    await montar(ctx());
    expect(screen.getByText('Sua vez na fila')).toBeInTheDocument();
    expect(screen.getByText('Vendas')).toBeInTheDocument();
    expect(screen.getByText('3º')).toBeInTheDocument();
    expect(screen.getByText('de 8 na fila')).toBeInTheDocument();
    expect(screen.getByText('2 corretores na sua frente.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Próxima roleta' })).not.toBeInTheDocument();
  });

  it('na vez dele, diz que é o próximo', async () => {
    queuePosition.mockResolvedValue([linha('r1', 'Vendas', { posicao: 1 })]);
    await montar(ctx());
    expect(screen.getByText('Você é o próximo a receber.')).toBeInTheDocument();
  });

  it('com oferta aberta, fala da oferta e esconde a posição', async () => {
    queuePosition.mockResolvedValue([linha('r1', 'Vendas', { posicao: 8, com_oferta: true })]);
    await montar(ctx());
    expect(screen.getByText('Você está com um lead esperando seu aceite.')).toBeInTheDocument();
    expect(screen.queryByText('8º')).not.toBeInTheDocument();
  });

  it('pausado ou fora da fila: sem número, com o motivo', async () => {
    queuePosition.mockResolvedValue([
      linha('r1', 'Vendas', { situacao: 'pausado', posicao: null }),
      linha('r2', 'Locação', { situacao: 'fora', posicao: null }),
    ]);
    await montar(ctx());
    expect(screen.getByText(/Você está pausado nesta roleta/)).toBeInTheDocument();
    expect(screen.queryByText(/º$/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Próxima roleta' }));
    expect(screen.getByText(/Você está fora desta fila agora/)).toBeInTheDocument();
  });

  it('com várias roletas, passa de uma para outra pelas setas e arrastando para o lado', async () => {
    queuePosition.mockResolvedValue([linha('r1', 'Vendas'), linha('r2', 'Locação', { posicao: 1 })]);
    await montar(ctx());
    expect(screen.getByText('1 de 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Roleta anterior' })).toBeDisabled();

    arrastar(200, 100);
    expect(screen.getByText('Locação')).toBeInTheDocument();
    expect(screen.getByText('2 de 2')).toBeInTheDocument();

    // Arrastar além da última não faz nada; um toque curto também não.
    arrastar(200, 100);
    expect(screen.getByText('Locação')).toBeInTheDocument();
    arrastar(100, 120);
    expect(screen.getByText('Locação')).toBeInTheDocument();

    arrastar(100, 200);
    expect(screen.getByText('Vendas')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Próxima roleta' }));
    expect(screen.getByText('Locação')).toBeInTheDocument();
  });

  it('sem roleta Fila, não aparece', async () => {
    queuePosition.mockResolvedValue([]);
    const { container } = await montar(ctx());
    expect(container).toBeEmptyDOMElement();
  });

  it('servidor antigo (sem o endereço): não aparece e não quebra', async () => {
    queuePosition.mockRejectedValue(new Error('404'));
    const { container } = await montar(ctx());
    expect(container).toBeEmptyDOMElement();
  });

  it('não aparece na visão do gestor, e nem pergunta', () => {
    const { container } = render(<MinhaVez {...ctx({ visao: 'gestor' })} />);
    expect(container).toBeEmptyDOMElement();
    expect(queuePosition).not.toHaveBeenCalled();
  });

  it('atualiza a cada 2 minutos só com a aba visível', async () => {
    vi.useFakeTimers();
    queuePosition.mockResolvedValue([linha('r1', 'Vendas')]);
    await montar(ctx());
    expect(queuePosition).toHaveBeenCalledTimes(1);

    await act(async () => { vi.advanceTimersByTime(60_000); });
    expect(queuePosition).toHaveBeenCalledTimes(1);
    await act(async () => { vi.advanceTimersByTime(60_000); });
    expect(queuePosition).toHaveBeenCalledTimes(2);

    act(() => { mudarVisibilidade('hidden'); });
    await act(async () => { vi.advanceTimersByTime(360_000); });
    expect(queuePosition).toHaveBeenCalledTimes(2);

    await act(async () => { mudarVisibilidade('visible'); });
    expect(queuePosition).toHaveBeenCalledTimes(3);
  });

  it('busca de novo na hora em que chega uma oferta para ele', async () => {
    queuePosition.mockResolvedValue([linha('r1', 'Vendas', { posicao: 1 })]);
    const { rerender } = await montar(ctx());
    expect(queuePosition).toHaveBeenCalledTimes(1);

    ofertas = [{ id: 'o1' }];
    queuePosition.mockResolvedValue([linha('r1', 'Vendas', { posicao: 8, com_oferta: true })]);
    await act(async () => { rerender(<MinhaVez {...ctx()} />); });
    expect(queuePosition).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Você está com um lead esperando seu aceite.')).toBeInTheDocument();
  });
});
