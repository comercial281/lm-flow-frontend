import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePergunta } from './usePergunta';

// `null` é a resposta de quem desistiu; 'ainda esperando' marca a Promise que
// não voltou. Distinguir os dois é o ponto da maioria dos testes aqui.
type Resposta = string | null | 'ainda esperando';

function TelaDeExemplo({ aoResponder }: { aoResponder: (r: Resposta) => void }) {
  const { perguntar, dialogoDePergunta } = usePergunta();
  const criar = async () => {
    aoResponder(await perguntar({
      titulo: 'Nova pasta',
      rotuloDoCampo: 'Nome',
      valorInicial: '',
    }));
  };
  return (
    <>
      <button onClick={() => void criar()}>Criar pasta</button>
      {dialogoDePergunta}
    </>
  );
}

describe('usePergunta', () => {
  it('devolve o texto digitado', async () => {
    const usuario = userEvent.setup();
    let resposta: Resposta = 'ainda esperando';
    render(<TelaDeExemplo aoResponder={r => (resposta = r)} />);

    await usuario.click(screen.getByText('Criar pasta'));
    await usuario.type(await screen.findByLabelText('Nome'), 'Campanhas');
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(resposta).toBe('Campanhas'));
  });

  it('devolve `null` no cancelar, igual ao window.prompt', async () => {
    const usuario = userEvent.setup();
    let resposta: Resposta = 'ainda esperando';
    render(<TelaDeExemplo aoResponder={r => (resposta = r)} />);

    await usuario.click(screen.getByText('Criar pasta'));
    await usuario.type(await screen.findByLabelText('Nome'), 'Campanhas');
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(resposta).toBeNull());
  });

  // A caixinha do navegador deixava confirmar em branco, e por isso TODO
  // chamador repetia o mesmo `if (!nome?.trim()) return`. Aqui a regra mora no
  // hook: em branco não sai, e o que sai já vem aparado.
  it('não deixa enviar em branco, e apara o que sai', async () => {
    const usuario = userEvent.setup();
    let resposta: Resposta = 'ainda esperando';
    render(<TelaDeExemplo aoResponder={r => (resposta = r)} />);

    await usuario.click(screen.getByText('Criar pasta'));
    const salvar = screen.getByRole('button', { name: 'Salvar' });
    expect(salvar).toBeDisabled();

    await usuario.type(await screen.findByLabelText('Nome'), '   ');
    expect(salvar).toBeDisabled();

    await usuario.type(screen.getByLabelText('Nome'), 'Campanhas   ');
    await usuario.click(salvar);
    await waitFor(() => expect(resposta).toBe('Campanhas'));
  });

  // A caixinha aceitava Enter. Trocar por um Dialog que só responde a clique
  // seria trocar por algo pior — daí o <form> dentro do DialogContent.
  it('Enter envia', async () => {
    const usuario = userEvent.setup();
    let resposta: Resposta = 'ainda esperando';
    render(<TelaDeExemplo aoResponder={r => (resposta = r)} />);

    await usuario.click(screen.getByText('Criar pasta'));
    await usuario.type(await screen.findByLabelText('Nome'), 'Campanhas{Enter}');

    await waitFor(() => expect(resposta).toBe('Campanhas'));
  });

  it('desmontar com uma pergunta no ar responde `null` em vez de pendurar a Promise', async () => {
    const usuario = userEvent.setup();
    let resposta: Resposta = 'ainda esperando';
    const { unmount } = render(<TelaDeExemplo aoResponder={r => (resposta = r)} />);

    await usuario.click(screen.getByText('Criar pasta'));
    expect(resposta).toBe('ainda esperando');

    unmount();
    await waitFor(() => expect(resposta).toBeNull());
  });
});
