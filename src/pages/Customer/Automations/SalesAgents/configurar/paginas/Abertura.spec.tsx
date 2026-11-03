import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { agenteDeTeste } from '@/test/salesAgents/agenteDeTeste';
import { gravarDeTeste } from '@/test/salesAgents/gravarDeTeste';
import Abertura from './Abertura';

describe('Abertura', () => {
  it('"Com texto de base" mostra o texto (sem gravar); "Automática" limpa o texto gravado', async () => {
    const gravar = gravarDeTeste('conducao');
    render(<><Abertura agent={agenteDeTeste()} inboxes={[]} gravar={gravar} irPara={vi.fn()} diagnostico={null} /><button>fora</button></>);
    await userEvent.click(screen.getByRole('radio', { name: 'Com texto de base' }));
    expect(gravar).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText('Texto de base'), 'Oi, tudo bem?');
    await userEvent.click(screen.getByText('fora'));
    expect(gravar).toHaveBeenCalledWith({ greeting: 'Oi, tudo bem?' });
  });

  // Achado da revisão (3.8): digitar o texto e clicar "Automática" deixava o texto
  // gravado com a tela dizendo Automática (a IA lida ainda não tinha o texto, e o
  // "limpar" só rodava com texto já gravado).
  it('digitou o texto e clicou "Automática": o último a gravar é o null', async () => {
    const gravar = gravarDeTeste('conducao');
    render(<Abertura agent={agenteDeTeste({ greeting: null })} inboxes={[]} gravar={gravar} irPara={vi.fn()} diagnostico={null} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Com texto de base' }));
    await userEvent.type(screen.getByLabelText('Texto de base'), 'Oi, tudo bem?');
    await userEvent.click(screen.getByRole('radio', { name: 'Automática' }));
    expect(gravar).toHaveBeenCalledWith({ greeting: 'Oi, tudo bem?' });
    expect(gravar).toHaveBeenLastCalledWith({ greeting: null });
  });

  // Sem blur (o campo some no desmonte e grava o que tinha): o null ainda vem depois.
  it('"Automática" sem o campo perder o foco: o null grava DEPOIS do texto pendente', () => {
    const gravar = gravarDeTeste('conducao');
    render(<Abertura agent={agenteDeTeste({ greeting: null })} inboxes={[]} gravar={gravar} irPara={vi.fn()} diagnostico={null} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Com texto de base' }));
    fireEvent.change(screen.getByLabelText('Texto de base'), { target: { value: 'Oi' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Automática' }));
    expect(screen.queryByLabelText('Texto de base')).toBeNull();
    expect(gravar.mock.calls.map((c) => c[0])).toEqual([{ greeting: 'Oi' }, { greeting: null }]);
  });

});
