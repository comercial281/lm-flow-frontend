import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CorrigirContatoDialog from './CorrigirContatoDialog';

// O lápis do card: nome pro responsável ou gestor (11/10/2026); telefone/e-mail
// só gestor em lead cadastrado à mão. Manda só o que mudou.

const updateContact = vi.hoisted(() => vi.fn());
vi.mock('@/services/contacts/contactsService', () => ({ contactsService: { updateContact } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const abrir = (extra: Partial<Parameters<typeof CorrigirContatoDialog>[0]> = {}) => {
  const onCorrigido = vi.fn();
  render(
    <CorrigirContatoDialog
      open
      onOpenChange={vi.fn()}
      contactId="c1"
      nomeAtual="Ana Teste"
      podeNome
      podeContato={false}
      telefoneAtual="+5511900000001"
      emailAtual="ana@teste.com"
      onCorrigido={onCorrigido}
      {...extra}
    />,
  );
  return onCorrigido;
};

beforeEach(() => updateContact.mockReset().mockResolvedValue({}));

describe('CorrigirContatoDialog', () => {
  it('responsável: só o nome aparece e só o nome vai', async () => {
    const onCorrigido = abrir();

    expect(screen.queryByLabelText('E-mail')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: '  Ana   Souza ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar correção' }));

    await waitFor(() => expect(updateContact).toHaveBeenCalledWith('c1', { name: 'Ana Souza' }));
    expect(onCorrigido).toHaveBeenCalledWith({ name: 'Ana Souza', phone_number: '+5511900000001', email: 'ana@teste.com' });
  });

  it('nome vazio não salva', () => {
    abrir();
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: ' ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar correção' }));

    expect(updateContact).not.toHaveBeenCalled();
  });

  it('gestor em lead manual: nome, telefone e e-mail', () => {
    abrir({ podeContato: true });

    expect(screen.getByLabelText('Nome')).toBeInTheDocument();
    expect(screen.getByLabelText('E-mail')).toBeInTheDocument();
  });
});
