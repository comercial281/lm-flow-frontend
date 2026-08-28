import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useConfirmacao } from './useConfirmacao';

const aoConfirmar = vi.fn();

function TelaDeExemplo() {
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const excluir = async () => {
    if (!(await confirmar({
      titulo: 'Excluir imóvel',
      descricao: 'Esta ação não pode ser desfeita.',
      rotuloDaAcao: 'Excluir',
      destrutivo: true,
    }))) return;
    aoConfirmar();
  };
  return (
    <>
      <button onClick={() => void excluir()}>Excluir imóvel agora</button>
      {dialogoDeConfirmacao}
    </>
  );
}

describe('useConfirmacao', () => {
  it('só executa a ação depois do clique em confirmar', async () => {
    const usuario = userEvent.setup();
    aoConfirmar.mockClear();
    render(<TelaDeExemplo />);

    await usuario.click(screen.getByText('Excluir imóvel agora'));
    // Enquanto a pessoa não responde, a ação NÃO pode ter acontecido — é a
    // diferença entre isto e um toast de "tem certeza?".
    expect(aoConfirmar).not.toHaveBeenCalled();

    await usuario.click(await screen.findByRole('button', { name: 'Excluir' }));
    await waitFor(() => expect(aoConfirmar).toHaveBeenCalledTimes(1));
  });

  it('cancelar não executa a ação e fecha o diálogo', async () => {
    const usuario = userEvent.setup();
    aoConfirmar.mockClear();
    render(<TelaDeExemplo />);

    await usuario.click(screen.getByText('Excluir imóvel agora'));
    await usuario.click(await screen.findByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByText('Excluir imóvel')).toBeNull());
    expect(aoConfirmar).not.toHaveBeenCalled();
  });

  it('nada acontece se a pessoa nunca responde — a ação fica esperando, não dispara', async () => {
    const usuario = userEvent.setup();
    aoConfirmar.mockClear();
    render(<TelaDeExemplo />);

    await usuario.click(screen.getByText('Excluir imóvel agora'));
    await new Promise(r => setTimeout(r, 60));
    expect(aoConfirmar).not.toHaveBeenCalled();
    expect(screen.getByText('Excluir imóvel')).toBeInTheDocument();
  });
});
