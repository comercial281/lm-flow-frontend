import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';

import CustomAttributesForm from './CustomAttributesForm';

// Recusa do servidor com frase própria ("Aceite o lead pra editar os dados dele.")
// já é mostrada pelo aviso global: a tela não pode empilhar um segundo, genérico.

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
// `t` estável: o formulário recarrega as definições sempre que `t` muda.
const t = (k: string) => k;
vi.mock('@/hooks/useLanguage', () => ({ useLanguage: () => ({ t }) }));
vi.mock('@/services/customAttributes/customAttributesService', () => ({
  customAttributesService: {
    getCustomAttributes: vi.fn().mockResolvedValue({
      data: [{ attribute_key: 'vip', attribute_display_name: 'VIP', attribute_display_type: 'checkbox' }],
    }),
  },
}));

const recusaComMensagem = {
  response: { status: 403, data: { error: { code: 'OFFER_LOCKED', message: 'Aceite o lead pra editar os dados dele.' } } },
};

afterEach(() => {
  cleanup();
  vi.mocked(toast.error).mockClear();
});

const alternar = async (erro: unknown) => {
  const onUpdateAttributes = vi.fn().mockRejectedValue(erro);
  render(<CustomAttributesForm attributeModel={'contact_attribute' as never} attributes={{}} mode="editable" onUpdateAttributes={onUpdateAttributes} />);
  fireEvent.click(await screen.findByRole('switch'));
  await waitFor(() => expect(onUpdateAttributes).toHaveBeenCalled());
};

describe('CustomAttributesForm — recusa do servidor', () => {
  it('403 com mensagem do servidor não empilha o aviso genérico de erro', async () => {
    await alternar(recusaComMensagem);
    await waitFor(() => expect(screen.getByRole('switch')).not.toBeDisabled());

    expect(toast.error).not.toHaveBeenCalled();
  });

  it('outro erro continua mostrando o aviso de erro da tela', async () => {
    await alternar({ response: { status: 500, data: {} } });

    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
  });

  it('403 FORBIDDEN (ex.: Pundit) também mantém o aviso da tela', async () => {
    await alternar({ response: { status: 403, data: { error: { code: 'FORBIDDEN', message: 'You are not authorized' } } } });

    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
  });

  it('403 de cargo (sem mensagem própria) também continua com o aviso da tela', async () => {
    await alternar({ response: { status: 403, data: { required_permission: 'contacts.update', message: 'x' } } });

    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
  });
});

// Raio-X de 10/10/2026: o corretor abria o card e via o aviso com a chave crua
// `contactSidebar.customAttributes.loadError` — a leitura das definições era
// recusada pelo cargo e a chave nem existia no pt-BR.
describe('CustomAttributesForm — leitura das definições', () => {
  const carregar = async (erro: unknown) => {
    const { customAttributesService } = await import('@/services/customAttributes/customAttributesService');
    vi.mocked(customAttributesService.getCustomAttributes).mockRejectedValueOnce(erro);
    render(<CustomAttributesForm attributeModel={'contact_attribute' as never} attributes={{}} mode="editable" onUpdateAttributes={vi.fn()} />);
    await waitFor(() => expect(customAttributesService.getCustomAttributes).toHaveBeenCalled());
  };

  it('recusa do cargo (403) não mostra aviso nenhum', async () => {
    await carregar({ response: { status: 403, data: { required_permission: 'custom_attribute_definitions.read' } } });
    await new Promise(r => setTimeout(r, 0));

    expect(toast.error).not.toHaveBeenCalled();
  });

  it('outra falha avisa com a frase do pt-BR, não com a chave', async () => {
    await carregar({ response: { status: 500, data: {} } });

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('contactSidebar.customAttributes.loadError'));
  });

  it('a chave do aviso existe no pt-BR', async () => {
    const chat = (await import('@/i18n/locales/pt-BR/chat.json')).default as {
      contactSidebar: Record<string, { loadError?: string }>;
    };
    expect(chat.contactSidebar.customAttributes.loadError).toMatch(/campos personalizados/);
    expect(chat.contactSidebar.conversationAttributes.loadError).toMatch(/campos da conversa/);
  });
});
