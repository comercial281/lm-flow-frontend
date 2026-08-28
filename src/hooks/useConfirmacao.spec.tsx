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

  // Este caso saiu do PropertyMenu: um menu flutuante que se fecha ao clicar
  // fora. O clique que abriria o diálogo é o mesmo que desmonta o menu — e sem
  // a limpeza no desmonte, o `await confirmar(...)` nunca voltava. Promise
  // pendurada não quebra tela nem estoura no console: só some com o passo
  // seguinte, em silêncio.
  it('desmontar com um pedido no ar responde `false` em vez de pendurar a Promise', async () => {
    const usuario = userEvent.setup();
    let resposta: boolean | 'ainda esperando' = 'ainda esperando';

    function TelaQueSomeem() {
      const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
      const perguntar = async () => {
        resposta = await confirmar({ titulo: 'Excluir a propriedade?' });
      };
      return (
        <>
          <button onClick={() => void perguntar()}>Excluir</button>
          {dialogoDeConfirmacao}
        </>
      );
    }

    const { unmount } = render(<TelaQueSomeem />);
    await usuario.click(screen.getByText('Excluir'));
    expect(resposta).toBe('ainda esperando');

    unmount();
    await waitFor(() => expect(resposta).toBe(false));
  });
});
