import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AvisoDoCardForaDoQuadro from './AvisoDoCardForaDoQuadro';

// O tooltip do X observa o tamanho; sem isto o jsdom falha de vez em quando.
beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

describe('AvisoDoCardForaDoQuadro', () => {
  it('nada a dizer enquanto busca, quando achou ou quando não há card no endereço', () => {
    const { container, rerender } = render(<AvisoDoCardForaDoQuadro estado={{ estado: 'nada' }} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<AvisoDoCardForaDoQuadro estado={{ estado: 'buscando' }} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<AvisoDoCardForaDoQuadro estado={{ estado: 'achou', item: { id: 'i1' } as never }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('sem acesso: a frase, sem botão', () => {
    render(<AvisoDoCardForaDoQuadro estado={{ estado: 'sem-acesso' }} />);
    expect(screen.getByRole('status')).toHaveTextContent('Você não tem acesso a este lead');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('erro: a frase e "Tentar de novo"', async () => {
    const tentarDeNovo = vi.fn();
    render(<AvisoDoCardForaDoQuadro estado={{ estado: 'erro', tentarDeNovo }} />);
    expect(screen.getByRole('status')).toHaveTextContent('Não consegui abrir este lead.');
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(tentarDeNovo).toHaveBeenCalled();
  });

  it('com aoFechar, o X fecha o aviso (o quadro tira o ?card=, como o aviso da E0)', async () => {
    const aoFechar = vi.fn();
    render(<AvisoDoCardForaDoQuadro estado={{ estado: 'sem-acesso' }} aoFechar={aoFechar} />);
    await userEvent.click(screen.getByRole('button', { name: 'Fechar aviso' }));
    expect(aoFechar).toHaveBeenCalledTimes(1);
  });
});
