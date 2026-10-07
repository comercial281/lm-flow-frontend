import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EtiquetasDeEscolha from './EtiquetasDeEscolha';

const RESTRICOES = [
  { valor: 'address', rotulo: 'Endereço exato' },
  { valor: 'discount', rotulo: 'Desconto' },
];

describe('EtiquetasDeEscolha', () => {
  it('cada etiqueta é um botão de ligar com aria-pressed; clicar troca a lista', async () => {
    const aoMudar = vi.fn();
    render(<EtiquetasDeEscolha rotulo="O que ela não informa" opcoes={RESTRICOES} escolhidas={['address']} aoMudar={aoMudar} />);
    expect(screen.getByRole('group', { name: 'O que ela não informa' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Endereço exato' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Desconto' }));
    expect(aoMudar).toHaveBeenCalledWith(['address', 'discount']);
    await userEvent.click(screen.getByRole('button', { name: 'Endereço exato' }));
    expect(aoMudar).toHaveBeenLastCalledWith([]);
  });

  it('as próprias aparecem com "Tirar" e o campo de adicionar só manda texto limpo e novo', async () => {
    const aoTirarPropria = vi.fn();
    const aoAdicionar = vi.fn();
    render(
      <EtiquetasDeEscolha rotulo="O que ela não informa" opcoes={RESTRICOES} escolhidas={[]} aoMudar={vi.fn()}
        proprias={['Permuta']} aoTirarPropria={aoTirarPropria}
        adicionar={{ rotulo: 'Nova restrição', placeholder: 'Outra coisa que ela não faz…', aoAdicionar }} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Tirar Permuta' }));
    expect(aoTirarPropria).toHaveBeenCalledWith('Permuta');
    const campo = screen.getByRole('textbox', { name: 'Nova restrição' });
    await userEvent.type(campo, '  permuta {Enter}');
    expect(aoAdicionar).not.toHaveBeenCalled(); // repetida (sem diferenciar maiúscula)
    await userEvent.clear(campo);
    await userEvent.type(campo, 'Financiamento direto');
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar' }));
    expect(aoAdicionar).toHaveBeenCalledWith('Financiamento direto');
    expect(campo).toHaveValue('');
  });
});
