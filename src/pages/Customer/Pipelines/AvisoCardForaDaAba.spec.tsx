import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AvisoCardForaDaAba from './AvisoCardForaDaAba';

describe('AvisoCardForaDaAba', () => {
  it('diz que o card não está nesta aba, sem bloquear o quadro, e fecha pelo X', async () => {
    const aoFechar = vi.fn();
    render(<AvisoCardForaDaAba aoFechar={aoFechar} />);

    const aviso = screen.getByRole('status');
    expect(aviso).toHaveTextContent('Este lead não está nesta aba.');
    await userEvent.click(screen.getByRole('button', { name: 'Fechar aviso' }));
    expect(aoFechar).toHaveBeenCalledTimes(1);
  });
});
