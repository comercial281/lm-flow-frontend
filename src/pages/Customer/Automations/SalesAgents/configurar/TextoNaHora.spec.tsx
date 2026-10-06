import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TextoNaHora from './TextoNaHora';

describe('TextoNaHora', () => {
  it('não grava a cada tecla; grava ao sair do campo, uma vez', async () => {
    const aoGravar = vi.fn().mockResolvedValue(true);
    render(<><TextoNaHora id="n" rotulo="Nome que o lead vê" salvo="" aoGravar={aoGravar} /><button>fora</button></>);
    await userEvent.type(screen.getByLabelText('Nome que o lead vê'), 'Bia');
    expect(aoGravar).not.toHaveBeenCalled();
    await userEvent.click(screen.getByText('fora'));
    expect(aoGravar).toHaveBeenCalledTimes(1);
    expect(aoGravar).toHaveBeenCalledWith('Bia');
  });

  it('sair sem mudar nada não grava', async () => {
    const aoGravar = vi.fn();
    render(<><TextoNaHora id="n" rotulo="Nome" salvo="Bia" aoGravar={aoGravar} /><button>fora</button></>);
    await userEvent.click(screen.getByLabelText('Nome'));
    await userEvent.click(screen.getByText('fora'));
    expect(aoGravar).not.toHaveBeenCalled();
  });

  // Review Focus 1: digitou e trocou de página antes de sair do campo.
  it('a página sumiu com o campo editado (sem blur): grava ao desmontar', async () => {
    const aoGravar = vi.fn().mockResolvedValue(true);
    const { unmount } = render(<TextoNaHora id="n" rotulo="Nome" salvo="" aoGravar={aoGravar} />);
    await userEvent.type(screen.getByLabelText('Nome'), 'Bia');
    unmount();
    expect(aoGravar).toHaveBeenCalledWith('Bia');
  });

  it('Enter numa linha grava; numa caixa de várias linhas, não', async () => {
    const aoGravar = vi.fn().mockResolvedValue(true);
    render(<TextoNaHora id="n" rotulo="Pergunta" salvo="" aoGravar={aoGravar} />);
    await userEvent.type(screen.getByLabelText('Pergunta'), 'É pra morar?{Enter}');
    expect(aoGravar).toHaveBeenCalledWith('É pra morar?');
  });

  it('o valor salvo que muda por fora (Desfazer) aparece, se a pessoa não está digitando', () => {
    const { rerender } = render(<TextoNaHora id="n" rotulo="Nome" salvo="Bia" aoGravar={vi.fn()} />);
    rerender(<TextoNaHora id="n" rotulo="Nome" salvo="Ana" aoGravar={vi.fn()} />);
    expect(screen.getByLabelText('Nome')).toHaveValue('Ana');
  });
});
