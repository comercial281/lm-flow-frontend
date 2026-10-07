import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DiasDaSemana from './DiasDaSemana';

describe('DiasDaSemana', () => {
  it('segunda primeiro, nome inteiro pro leitor de tela, marcado com aria-pressed', () => {
    render(<DiasDaSemana rotulo="Dias de atendimento" dias={[1, 2]} aoMudar={vi.fn()} />);
    const botoes = screen.getAllByRole('button');
    expect(botoes[0]).toHaveAccessibleName('Segunda');
    expect(botoes[6]).toHaveAccessibleName('Domingo');
    expect(screen.getByRole('button', { name: 'Segunda' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Sábado' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicar liga/desliga e devolve em ordem numérica', async () => {
    const aoMudar = vi.fn();
    render(<DiasDaSemana rotulo="Dias" dias={[3, 1]} aoMudar={aoMudar} />);
    await userEvent.click(screen.getByRole('button', { name: 'Domingo' }));
    expect(aoMudar).toHaveBeenCalledWith([0, 1, 3]);
    await userEvent.click(screen.getByRole('button', { name: 'Quarta' }));
    expect(aoMudar).toHaveBeenLastCalledWith([1]);
  });

  it('não deixa ficar sem nenhum dia (vazio no servidor quer dizer TODOS)', async () => {
    const aoMudar = vi.fn();
    render(<DiasDaSemana rotulo="Dias" dias={[5]} aoMudar={aoMudar} />);
    await userEvent.click(screen.getByRole('button', { name: 'Sexta' }));
    expect(aoMudar).not.toHaveBeenCalled();
    expect(screen.getByText('Deixe pelo menos um dia.')).toBeInTheDocument();
  });
});
