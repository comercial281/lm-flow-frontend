import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { toast } from 'sonner';

import { useEditarContato } from './useEditarContato';
import type { Contact } from '@/types/chat/api';

// Recusa do servidor com frase própria já foi avisada pelo aviso global: a edição
// do contato não pode empilhar o "erro ao atualizar" genérico por cima.

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/hooks/useLanguage', () => ({ useLanguage: () => ({ t: (k: string) => k }) }));
vi.mock('@/hooks/chat/useConversations', () => ({ useConversations: () => ({ updateContactInConversations: vi.fn() }) }));

const updateContact = vi.fn();
vi.mock('@/services/contacts/contactsService', () => ({
  contactsService: { updateContact: (...a: unknown[]) => updateContact(...a) },
}));

let enviar: ((d: unknown) => Promise<void>) | undefined;
vi.mock('@/components/contacts/ContactModal', () => ({
  default: (p: { onSubmit: (d: unknown) => Promise<void> }) => {
    enviar = p.onSubmit;
    return null;
  },
}));

const contato = { id: 'c1', name: 'Ana' } as unknown as Contact;

function Host() {
  const { abrir, modal } = useEditarContato(contato);
  return (
    <>
      <button onClick={abrir}>abrir</button>
      {modal}
    </>
  );
}

const salvarComErro = async (erro: unknown) => {
  updateContact.mockRejectedValue(erro);
  const { getByText } = render(<Host />);
  act(() => getByText('abrir').click());
  await act(async () => {
    await enviar!({});
  });
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('useEditarContato — recusa do servidor', () => {
  it('403 com mensagem do servidor não empilha o aviso genérico', async () => {
    await salvarComErro({ response: { status: 403, data: { error: { message: 'Aceite o lead pra editar os dados dele.' } } } });

    expect(toast.error).not.toHaveBeenCalled();
  });

  it('outro erro mantém o aviso da tela', async () => {
    await salvarComErro({ response: { status: 500, data: {} } });

    expect(toast.error).toHaveBeenCalledTimes(1);
  });
});
