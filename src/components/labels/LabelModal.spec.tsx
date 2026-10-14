import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LabelModal from './LabelModal';

vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: () => ({ can: () => true }) }));

function abrir() {
  const onSubmit = vi.fn();
  render(<LabelModal open onOpenChange={vi.fn()} isNew loading={false} onSubmit={onSubmit} />);
  return onSubmit;
}

// O botão final é o último da janela.
const salvar = async () => {
  const botoes = screen.getAllByRole('button');
  await userEvent.click(botoes[botoes.length - 1]);
};

describe('LabelModal', () => {
  it('não mostra o código da cor', () => {
    abrir();
    expect(screen.queryByRole('textbox', { name: /cor/i })).toBeNull();
    // o único campo de texto é o nome; a cor é escolhida na paleta ou no seletor
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
  });

  it('escolher uma cor da paleta salva a cor', async () => {
    const onSubmit = abrir();
    await userEvent.type(screen.getByRole('textbox'), 'quente');
    await userEvent.click(screen.getByRole('button', { name: 'Laranja' }));
    await salvar();
    expect(onSubmit).toHaveBeenCalledWith({ title: 'quente', color: '#f97316' });
  });

  it('outra cor também vale e a paleta tem nomes', async () => {
    const onSubmit = abrir();
    expect(screen.getByRole('button', { name: 'Azul' })).toBeInTheDocument();
    await userEvent.type(screen.getByRole('textbox'), 'frio');
    fireEvent.change(screen.getByLabelText('Outra cor'), { target: { value: '#123456' } });
    await salvar();
    expect(onSubmit).toHaveBeenCalledWith({ title: 'frio', color: '#123456' });
  });
});
