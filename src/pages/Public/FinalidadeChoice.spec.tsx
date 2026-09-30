import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FinalidadeChoice from './FinalidadeChoice';

describe('FinalidadeChoice', () => {
  it('mostra as duas opções com a marcada', () => {
    render(<FinalidadeChoice value="locacao" onChange={() => {}} />);

    expect(screen.getByRole('radio', { name: 'Quero alugar' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Quero comprar' })).not.toBeChecked();
  });

  it('avisa a escolha', async () => {
    const onChange = vi.fn();
    render(<FinalidadeChoice value="venda" onChange={onChange} />);

    await userEvent.setup().click(screen.getByRole('radio', { name: 'Quero alugar' }));

    expect(onChange).toHaveBeenCalledWith('locacao');
  });
});
