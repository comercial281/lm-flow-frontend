import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BotoesDeEscolha from './BotoesDeEscolha';

const OPCOES = [
  { valor: 'always', rotulo: '24 horas' },
  { valor: 'outside_business', rotulo: 'Fora do comercial' },
  { valor: 'custom', rotulo: 'Personalizado' },
] as const;

function abrir(valor: string | null = 'always', aoEscolher = vi.fn()) {
  render(<BotoesDeEscolha rotulo="Horário" valor={valor} opcoes={[...OPCOES]} aoEscolher={aoEscolher} />);
  return aoEscolher;
}

describe('BotoesDeEscolha', () => {
  it('é um grupo de rádio com o nome do bloco e a opção marcada', () => {
    abrir('outside_business');
    expect(screen.getByRole('radiogroup', { name: 'Horário' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Fora do comercial' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: '24 horas' })).toHaveAttribute('aria-checked', 'false');
  });

  it('clicar escolhe; clicar na já marcada não chama de novo', async () => {
    const aoEscolher = abrir('always');
    await userEvent.click(screen.getByRole('radio', { name: 'Personalizado' }));
    expect(aoEscolher).toHaveBeenCalledWith('custom');
    await userEvent.click(screen.getByRole('radio', { name: '24 horas' }));
    expect(aoEscolher).toHaveBeenCalledTimes(1);
  });

  it('só a marcada entra no Tab; as setas andam e escolhem', async () => {
    const aoEscolher = abrir('always');
    expect(screen.getByRole('radio', { name: '24 horas' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('radio', { name: 'Personalizado' })).toHaveAttribute('tabindex', '-1');
    screen.getByRole('radio', { name: '24 horas' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(aoEscolher).toHaveBeenLastCalledWith('outside_business');
    expect(screen.getByRole('radio', { name: 'Fora do comercial' })).toHaveFocus();
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(aoEscolher).toHaveBeenLastCalledWith('custom'); // volta pelo fim
  });

  it('sem nenhuma marcada (valor antigo), a primeira recebe o Tab', () => {
    abrir(null);
    expect(screen.getByRole('radio', { name: '24 horas' })).toHaveAttribute('tabindex', '0');
    screen.getAllByRole('radio').forEach((r) => expect(r).toHaveAttribute('aria-checked', 'false'));
  });

  it('opção desabilitada não escolhe, diz o motivo e fica fora das setas', async () => {
    const aoEscolher = vi.fn();
    render(
      <BotoesDeEscolha rotulo="Duração" valor="30" aoEscolher={aoEscolher}
        opcoes={[{ valor: '30', rotulo: '30 min' }, { valor: '45', rotulo: '45 min', desabilitada: true, motivo: 'Só com a Agenda' }, { valor: '60', rotulo: '1 hora' }]} />,
    );
    const travada = screen.getByRole('radio', { name: '45 min' });
    expect(travada).toHaveAttribute('aria-disabled', 'true');
    expect(travada).toHaveAttribute('title', 'Só com a Agenda');
    await userEvent.click(travada);
    expect(aoEscolher).not.toHaveBeenCalled();
    screen.getByRole('radio', { name: '30 min' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(aoEscolher).toHaveBeenCalledWith('60');
  });
});
