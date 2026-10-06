// src/contexts/PendingOffersContext.spec.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';

const listMine = vi.fn();
vi.mock('@/services/roletaConfig/brokerAssignmentsService', () => ({
  brokerAssignmentsService: { listMine: () => listMine() },
}));

import { PendingOffersProvider } from './PendingOffersContext';

// O pop-up de aceite precisa abrir em até 15 s em qualquer tela. Por isso a
// lista de ofertas checa a cada 15 s — mas SÓ com a aba visível: aba escondida
// não checa (são dezenas de corretores com o app aberto o dia inteiro), e na
// volta para a aba checa na hora, sem esperar o próximo ciclo.
const mudarVisibilidade = (estado: 'visible' | 'hidden') => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => estado });
  document.dispatchEvent(new Event('visibilitychange'));
};

const montar = async () => {
  await act(async () => {
    render(
      <PendingOffersProvider>
        <div />
      </PendingOffersProvider>,
    );
  });
};

describe('PendingOffersProvider — checagem das ofertas', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    listMine.mockReset();
    listMine.mockResolvedValue([]);
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
  });

  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(document, 'visibilityState');
  });

  it('com a aba visível, checa ao abrir e a cada 15 s', async () => {
    await montar();
    expect(listMine).toHaveBeenCalledTimes(1);

    await act(async () => { vi.advanceTimersByTime(14_000); });
    expect(listMine).toHaveBeenCalledTimes(1);
    await act(async () => { vi.advanceTimersByTime(1_000); });
    expect(listMine).toHaveBeenCalledTimes(2);
    await act(async () => { vi.advanceTimersByTime(15_000); });
    expect(listMine).toHaveBeenCalledTimes(3);
  });

  it('com a aba escondida, não checa', async () => {
    await montar();
    expect(listMine).toHaveBeenCalledTimes(1);

    act(() => { mudarVisibilidade('hidden'); });
    await act(async () => { vi.advanceTimersByTime(120_000); });
    expect(listMine).toHaveBeenCalledTimes(1);
  });

  it('na volta para a aba, checa na hora', async () => {
    await montar();
    act(() => { mudarVisibilidade('hidden'); });
    await act(async () => { vi.advanceTimersByTime(60_000); });
    expect(listMine).toHaveBeenCalledTimes(1);

    await act(async () => { mudarVisibilidade('visible'); });
    expect(listMine).toHaveBeenCalledTimes(2);

    // E o ciclo segue normal depois da volta.
    await act(async () => { vi.advanceTimersByTime(15_000); });
    expect(listMine).toHaveBeenCalledTimes(3);
  });

  it('esconder a aba não dispara checagem', async () => {
    await montar();
    await act(async () => { mudarVisibilidade('hidden'); });
    expect(listMine).toHaveBeenCalledTimes(1);
  });
});
