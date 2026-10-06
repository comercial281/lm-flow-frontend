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
  response: { status: 403, data: { error: { code: 'FORBIDDEN', message: 'Aceite o lead pra editar os dados dele.' } } },
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
    await new Promise(r => setTimeout(r, 0));

    expect(toast.error).not.toHaveBeenCalled();
  });

  it('outro erro continua mostrando o aviso de erro da tela', async () => {
    await alternar({ response: { status: 500, data: {} } });

    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
  });

  it('403 de cargo (sem mensagem própria) também continua com o aviso da tela', async () => {
    await alternar({ response: { status: 403, data: { required_permission: 'contacts.update', message: 'x' } } });

    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
  });
});
