import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Caixa, CascaDoPasso, Escolha } from './pecas';

describe('peças do passo a passo', () => {
  it('Caixa: rótulo ligado à caixinha, frase como descrição', async () => {
    const aoMudar = vi.fn();
    render(<Caixa id="c1" rotulo="Mandar o resumo junto" descricao="O corretor recebe o que ela descobriu." marcada={false} aoMudar={aoMudar} />);
    const caixa = screen.getByLabelText('Mandar o resumo junto');
    expect(caixa.getAttribute('aria-describedby')).toBe('c1-desc');
    await userEvent.click(caixa);
    expect(aoMudar).toHaveBeenCalledWith(true);
  });

  it('Escolha: opção desabilitada mostra o motivo', async () => {
    const aoEscolher = vi.fn();
    render(<Escolha nome="q" legenda="Quando passa" valor="a" aoEscolher={aoEscolher}
      opcoes={[{ valor: 'a', titulo: 'Opção A' }, { valor: 'b', titulo: 'Opção B', desabilitada: true, motivo: 'Só quando ela vai até o fim.' }]} />);
    expect(screen.getByLabelText('Opção A')).toBeChecked();
    expect(screen.getByLabelText('Opção B')).toBeDisabled();
    expect(screen.getByText('Só quando ela vai até o fim.')).toBeTruthy();
  });

  it('CascaDoPasso: título do passo e a barra de salvar só com pendência', () => {
    const { rerender } = render(<CascaDoPasso numero={2} pendente={false} salvando={false} erro={null} aoSalvar={vi.fn()} aoDescartar={vi.fn()}><p>campos</p></CascaDoPasso>);
    expect(screen.getByRole('heading', { name: 'Objetivo' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Alterações não salvas' })).toBeNull();
    rerender(<CascaDoPasso numero={2} pendente salvando={false} erro="Não salvou." aoSalvar={vi.fn()} aoDescartar={vi.fn()}><p>campos</p></CascaDoPasso>);
    expect(screen.getByRole('region', { name: 'Alterações não salvas' })).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe('Não salvou.');
  });
});
