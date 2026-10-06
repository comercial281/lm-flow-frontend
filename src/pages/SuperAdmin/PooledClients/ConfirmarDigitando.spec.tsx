import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ConfirmarDigitando from './ConfirmarDigitando';

describe('ConfirmarDigitando', () => {
  it('só confirma com o texto exato (espaços nas pontas não contam)', async () => {
    const aoConfirmar = vi.fn().mockResolvedValue(undefined);
    render(<ConfirmarDigitando aberto titulo="Excluir alfa?" descricao="Não tem volta." esperado="alfa"
      rotuloDaAcao="Excluir" aoConfirmar={aoConfirmar} aoFechar={() => {}} />);
    const botao = screen.getByRole('button', { name: 'Excluir' });
    expect(botao).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'alf' } });
    expect(botao).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  alfa ' } });
    expect(botao).toBeEnabled();
    fireEvent.click(botao);
    await waitFor(() => expect(aoConfirmar).toHaveBeenCalledTimes(1));
  });
});
