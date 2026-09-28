import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

// O bloco "Números de atendimento" do Perfil. Leitura de fundo: falha só
// esconde o bloco (sem aviso vermelho), e sem a regra ele não existe.
const myNumbers = vi.hoisted(() => vi.fn());
const setMyPrimary = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());

vi.mock('@/services/numbers/numbersService', () => ({ default: { myNumbers, setMyPrimary } }));
vi.mock('@/contexts/TenantFeaturesContext', () => ({ useClientToggle: () => false }));
vi.mock('sonner', () => ({ toast: { success: toastSuccess, error: toastError } }));

import MyNumbersCard from './MyNumbersCard';

const n1 = { inbox_id: 'i1', name: 'WhatsApp 1', phone: '+5511912341234', connection: 'connected' as const, principal: true };
const n2 = { inbox_id: 'i2', name: 'WhatsApp 2', phone: '+5511900001111', connection: 'connected' as const, principal: false };

function renderCard() {
  return render(<MemoryRouter><MyNumbersCard /></MemoryRouter>);
}

beforeEach(() => {
  myNumbers.mockReset();
  setMyPrimary.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
});

describe('MyNumbersCard', () => {
  it('sem a regra no cliente: o bloco não existe', async () => {
    myNumbers.mockResolvedValue({ number_owner_rule: false, numbers: [n1] });

    const { container } = renderCard();

    // L6: espera a promessa de `myNumbers` assentar (e o state atualizar)
    // ANTES de afirmar DOM vazio — senão o teste passa com a tela de ANTES da
    // resposta chegar, não com o estado real "sem a regra".
    await waitFor(() => expect(myNumbers).toHaveBeenCalled());
    await act(async () => {});
    expect(container).toBeEmptyDOMElement();
  });

  it('leitura que falhou: some calado, sem aviso', async () => {
    myNumbers.mockRejectedValue(new Error('404'));

    const { container } = renderCard();

    await waitFor(() => expect(myNumbers).toHaveBeenCalled());
    await act(async () => {});
    expect(container).toBeEmptyDOMElement();
    expect(toastError).not.toHaveBeenCalled();
  });

  it('com a regra: os números dela, o principal marcado', async () => {
    myNumbers.mockResolvedValue({ number_owner_rule: true, numbers: [n1, n2] });

    renderCard();

    expect(await screen.findByText('Números de atendimento')).toBeInTheDocument();
    expect(screen.getByText('(11) 91234-1234')).toBeInTheDocument();
    expect(screen.getAllByText('Principal')).toHaveLength(1);
  });

  it('trocar o principal mostra a nova ordem que o servidor devolveu', async () => {
    myNumbers.mockResolvedValue({ number_owner_rule: true, numbers: [n1, n2] });
    setMyPrimary.mockResolvedValue({
      number_owner_rule: true, numbers: [{ ...n2, principal: true }, { ...n1, principal: false }],
    });

    renderCard();
    await userEvent.click(await screen.findByRole('button', { name: 'Tornar principal' }));

    expect(setMyPrimary).toHaveBeenCalledWith('i2');
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Número principal atualizado.'));
    expect(screen.getAllByRole('link', { name: 'alterar em Canais' })[0]).toHaveAttribute('href', '/channels/i2/settings');
  });

  it('com a regra e sem número: explica quem define o dono', async () => {
    myNumbers.mockResolvedValue({ number_owner_rule: true, numbers: [] });

    renderCard();

    expect(await screen.findByText(/Quem define o dono de um número é o gestor, em Canais/)).toBeInTheDocument();
  });
});
