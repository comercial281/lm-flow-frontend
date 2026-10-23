import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AvisoListaVaziaNumero, FaixaReconectar } from './AvisoNumero';

const navigate = vi.fn();
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}));

// Número da API oficial não tem QR code: o botão leva pra página dele em Canais.
describe('AvisoNumero com número da API oficial', () => {
  beforeEach(() => navigate.mockReset());

  it('lista vazia: Conectar agora abre a página do número oficial e não fala em QR', async () => {
    render(<AvisoListaVaziaNumero aviso={{ tipo: 'foraDoAr', numeros: [{ id: '9', nome: 'Loja', oficial: true }] }} />);
    expect(screen.getByText('Reconecte este número pela página dele em Canais.')).toBeInTheDocument();
    expect(screen.queryByText(/QR/)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Conectar agora' }));
    expect(navigate).toHaveBeenCalledWith('/channels/9/oficial');
  });

  it('faixa: Reconectar abre a página do número oficial', async () => {
    render(<FaixaReconectar numeros={[{ id: '9', nome: 'Loja', oficial: true }]} />);
    await userEvent.click(screen.getByRole('button', { name: 'Reconectar' }));
    expect(navigate).toHaveBeenCalledWith('/channels/9/oficial');
  });

  it('número por QR continua indo pra configuração da conexão', async () => {
    render(<FaixaReconectar numeros={[{ id: '7', nome: 'Ana' }]} />);
    await userEvent.click(screen.getByRole('button', { name: 'Reconectar' }));
    expect(navigate).toHaveBeenCalledWith('/channels/7/settings?tab=configuration');
  });
});
