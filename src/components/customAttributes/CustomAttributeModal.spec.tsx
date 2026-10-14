// Janela "Campo personalizado": o código interno (chave) só é gerado do nome quando é campo
// novo e a pessoa ainda não mexeu nele à mão. Editar um campo nunca troca a chave.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CustomAttributeDefinition } from '@/types/settings';
import CustomAttributeModal from './CustomAttributeModal';

vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({ t: (chave: string) => chave }),
}));

const EXISTENTE = {
  id: 7,
  attribute_key: 'prioridade',
  attribute_display_name: 'Prioridade',
  attribute_description: 'Quão urgente é',
  attribute_display_type: 'text',
  attribute_model: 'contact_attribute',
} as unknown as CustomAttributeDefinition;

const abrir = (props: { isNew: boolean; attribute?: CustomAttributeDefinition }) => {
  const onSubmit = vi.fn();
  render(<CustomAttributeModal open onOpenChange={() => {}} loading={false} onSubmit={onSubmit} {...props} />);
  return { onSubmit };
};

const nome = () => screen.getByLabelText(/modal\.fields\.displayName\.label/);
const chave = () => screen.getByLabelText(/modal\.fields\.attributeKey\.label/) as HTMLInputElement;

beforeEach(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

describe('CustomAttributeModal: código interno', () => {
  it('editar: mudar o nome não muda a chave', async () => {
    const { onSubmit } = abrir({ isNew: false, attribute: EXISTENTE });
    await userEvent.clear(nome());
    await userEvent.type(nome(), 'Urgência do Cliente');
    expect(chave().value).toBe('prioridade');
    await userEvent.click(screen.getByRole('button', { name: 'actions.update' }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ attribute_key: 'prioridade', attribute_display_name: 'Urgência do Cliente' }),
    );
  });

  it('novo: o nome gera a chave sem acento', async () => {
    abrir({ isNew: true });
    await userEvent.type(nome(), 'Média do Cliente');
    expect(chave().value).toBe('media_do_cliente');
  });

  it('chave editada à mão não volta a ser gerada', async () => {
    abrir({ isNew: true });
    await userEvent.type(nome(), 'Média');
    await userEvent.clear(chave());
    await userEvent.type(chave(), 'meu_codigo');
    await userEvent.type(nome(), ' do Cliente');
    expect(chave().value).toBe('meu_codigo');
  });
});
