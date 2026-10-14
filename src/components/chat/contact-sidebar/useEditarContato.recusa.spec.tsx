import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
const getContact = vi.fn();
vi.mock('@/services/contacts/contactsService', () => ({
  contactsService: {
    updateContact: (...a: unknown[]) => updateContact(...a),
    getContact: (...a: unknown[]) => getContact(...a),
  },
}));

let enviar: ((d: unknown) => Promise<void>) | undefined;
let contatoDaJanela: { default_assignee_id?: number | null } | undefined;
vi.mock('@/components/contacts/ContactModal', () => ({
  default: (p: { onSubmit: (d: unknown) => Promise<void>; contact: { default_assignee_id?: number | null } }) => {
    enviar = p.onSubmit;
    contatoDaJanela = p.contact;
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
  await act(async () => getByText('abrir').click());
  await act(async () => {
    await enviar!({});
  });
};

beforeEach(() => {
  getContact.mockResolvedValue({ id: 'c1', name: 'Ana', default_assignee_id: 7 });
  contatoDaJanela = undefined;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('useEditarContato — recusa do servidor', () => {
  it('403 com mensagem do servidor não empilha o aviso genérico', async () => {
    await salvarComErro({ response: { status: 403, data: { error: { code: 'OFFER_LOCKED', message: 'Aceite o lead pra editar os dados dele.' } } } });

    expect(toast.error).not.toHaveBeenCalled();
  });

  it('403 FORBIDDEN (ex.: Pundit) mantém o aviso da tela', async () => {
    await salvarComErro({ response: { status: 403, data: { error: { code: 'FORBIDDEN', message: 'You are not authorized' } } } });

    expect(toast.error).toHaveBeenCalledTimes(1);
  });

  it('outro erro mantém o aviso da tela', async () => {
    await salvarComErro({ response: { status: 500, data: {} } });

    expect(toast.error).toHaveBeenCalledTimes(1);
  });

  it('abre com o contato completo do servidor (traz o responsável)', async () => {
    const { getByText } = render(<Host />);
    await act(async () => getByText('abrir').click());

    expect(getContact).toHaveBeenCalledWith('c1', false);
    expect(contatoDaJanela?.default_assignee_id).toBe(7);
  });

  it('falha ao buscar o contato: avisa e não abre a janela', async () => {
    getContact.mockRejectedValue(new Error('rede'));
    const { getByText } = render(<Host />);
    await act(async () => getByText('abrir').click());

    expect(toast.error).toHaveBeenCalledWith('contactSidebar.contactDetails.actions.loadError');
    expect(contatoDaJanela).toBeUndefined();
  });
});
