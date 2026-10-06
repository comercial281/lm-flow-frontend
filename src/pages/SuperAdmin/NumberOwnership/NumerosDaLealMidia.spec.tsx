// src/pages/SuperAdmin/NumberOwnership/NumerosDaLealMidia.spec.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const platformNumbers = vi.hoisted(() => vi.fn());
vi.mock('@/services/superAdmin/numberOwnershipService', () => ({ default: { platformNumbers } }));

import NumerosDaLealMidia from './NumerosDaLealMidia';

const ok = <T,>(data: T) => ({ data: { data } });

describe('Números da Leal Mídia', () => {
  // Com chaves: o beforeEach que devolve uma função a roda como limpeza (e chamaria o mock que rejeita).
  beforeEach(() => {
    platformNumbers.mockReset();
  });

  it('lista nome, telefone e situação de cada número da plataforma', async () => {
    platformNumbers.mockResolvedValue(ok({
      unreadable: false,
      numbers: [
        { name: 'Operacional (LM01)', phone: '5511999990001', status: 'connected' },
        { name: 'Sara', phone: null, status: 'disconnected' },
      ],
    }));

    render(<NumerosDaLealMidia recarga={0} />);

    expect(await screen.findByText('Operacional (LM01)')).toBeInTheDocument();
    expect(screen.getByText('(11) 99999-0001')).toBeInTheDocument();
    expect(screen.getByText('Conectado')).toBeInTheDocument();
    expect(screen.getByText('sem telefone gravado')).toBeInTheDocument();
    expect(screen.getByText('Caído')).toBeInTheDocument();
  });

  it('servidor sem leitura: "Não consegui ler" com "Tentar de novo"', async () => {
    platformNumbers
      .mockResolvedValueOnce(ok({ unreadable: true, numbers: [] }))
      .mockResolvedValueOnce(ok({ unreadable: false, numbers: [{ name: 'Sara', phone: null, status: 'connected' }] }));

    render(<NumerosDaLealMidia recarga={0} />);

    expect(await screen.findByText('Não consegui ler os números da Leal Mídia')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Sara')).toBeInTheDocument();
  });

  it('pedido que falha também é erro, nunca lista vazia', async () => {
    platformNumbers.mockRejectedValue(new Error('caiu'));

    render(<NumerosDaLealMidia recarga={0} />);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('Nenhum número da Leal Mídia no servidor.')).not.toBeInTheDocument();
  });

  it('sem número da plataforma, diz isso', async () => {
    platformNumbers.mockResolvedValue(ok({ unreadable: false, numbers: [] }));

    render(<NumerosDaLealMidia recarga={0} />);

    expect(await screen.findByText('Nenhum número da Leal Mídia no servidor.')).toBeInTheDocument();
  });

  it('o Atualizar da tela (recarga) lê de novo', async () => {
    platformNumbers.mockResolvedValue(ok({ unreadable: false, numbers: [] }));

    const { rerender } = render(<NumerosDaLealMidia recarga={0} />);
    await waitFor(() => expect(platformNumbers).toHaveBeenCalledTimes(1));
    rerender(<NumerosDaLealMidia recarga={1} />);

    await waitFor(() => expect(platformNumbers).toHaveBeenCalledTimes(2));
  });
});
