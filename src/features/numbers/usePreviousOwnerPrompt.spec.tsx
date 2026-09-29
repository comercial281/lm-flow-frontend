import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { usePreviousOwnerPrompt, type AskPreviousOwnerParams } from './usePreviousOwnerPrompt';

// Trocar o Dono do número (fase 2b.1) não tira o dono ANTERIOR de Colaboradores
// sozinho — a tela pergunta. Este hook mora em `ChannelSettings`, NUNCA em
// `CollaboratorsForm`: o `onOwnerChange` de lá chama `loadChannelData()`, que
// desmonta a aba inteira (spinner de página) no meio do `await` — um
// `useConfirmacao` pedido de dentro do `CollaboratorsForm` ficaria preso numa
// instância morta, e o Dialog nunca apareceria em produção. Por isso o hook é
// testado isolado, com um "hospedeiro" mínimo — ele não sabe (nem precisa
// saber) de `ChannelSettings`.

const t = vi.hoisted(() => (key: string) => key);
vi.mock('@/hooks/useLanguage', () => ({ useLanguage: () => ({ t }) }));
const removeMembers = vi.hoisted(() => vi.fn());
vi.mock('@/services/channels/inboxMembersService', () => ({ default: { remove: removeMembers } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// jsdom não implementa estas três APIs de ponteiro que o Dialog (Radix) usa.
beforeEach(() => {
  Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
  Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
});

beforeEach(() => {
  removeMembers.mockReset().mockResolvedValue(undefined);
});

function Hospedeiro({ params }: { params: AskPreviousOwnerParams }) {
  const { ask, dialog } = usePreviousOwnerPrompt('inbox-1');
  return (
    <>
      <button onClick={() => { void ask(params); }}>perguntar</button>
      {dialog}
    </>
  );
}

const anaEJoao = (extra: Partial<AskPreviousOwnerParams> = {}): AskPreviousOwnerParams => ({
  rule: true,
  previousOwner: { id: 'u-ana', name: 'Ana' },
  newOwnerId: 'u-joao',
  ...extra,
});

describe('usePreviousOwnerPrompt', () => {
  it('com a regra e dono anterior diferente: pergunta, e "Tirar" remove só o anterior', async () => {
    render(<Hospedeiro params={anaEJoao()} />);

    await userEvent.click(screen.getByText('perguntar'));
    expect(
      await screen.findByText('O número era de Ana. Tirar Ana dos Colaboradores também?'),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Tirar' }));

    await waitFor(() => expect(removeMembers).toHaveBeenCalledWith('inbox-1', ['u-ana']));
  });

  it('"Manter liberado" não remove ninguém', async () => {
    render(<Hospedeiro params={anaEJoao()} />);

    await userEvent.click(screen.getByText('perguntar'));
    await screen.findByText('O número era de Ana. Tirar Ana dos Colaboradores também?');
    await userEvent.click(screen.getByRole('button', { name: 'Manter liberado' }));

    expect(removeMembers).not.toHaveBeenCalled();
  });

  it('com a regra desligada: não pergunta nada', async () => {
    render(<Hospedeiro params={anaEJoao({ rule: false })} />);

    await userEvent.click(screen.getByText('perguntar'));
    await new Promise(r => setTimeout(r, 30));

    expect(screen.queryByText(/O número era de/)).not.toBeInTheDocument();
    expect(removeMembers).not.toHaveBeenCalled();
  });

  it('sem dono anterior: não pergunta nada', async () => {
    render(<Hospedeiro params={anaEJoao({ previousOwner: null })} />);

    await userEvent.click(screen.getByText('perguntar'));
    await new Promise(r => setTimeout(r, 30));

    expect(screen.queryByText(/O número era de/)).not.toBeInTheDocument();
    expect(removeMembers).not.toHaveBeenCalled();
  });

  it('quando o "novo" é a mesma pessoa que já era dona: não pergunta nada', async () => {
    render(<Hospedeiro params={anaEJoao({ newOwnerId: 'u-ana' })} />);

    await userEvent.click(screen.getByText('perguntar'));
    await new Promise(r => setTimeout(r, 30));

    expect(screen.queryByText(/O número era de/)).not.toBeInTheDocument();
    expect(removeMembers).not.toHaveBeenCalled();
  });

  it('erro ao remover mostra toast com a mensagem do servidor', async () => {
    removeMembers.mockRejectedValueOnce({ response: { data: { error: { message: 'Falhou de verdade' } } } });
    render(<Hospedeiro params={anaEJoao()} />);

    await userEvent.click(screen.getByText('perguntar'));
    await screen.findByText('O número era de Ana. Tirar Ana dos Colaboradores também?');
    await userEvent.click(screen.getByRole('button', { name: 'Tirar' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Falhou de verdade'));
  });
});
