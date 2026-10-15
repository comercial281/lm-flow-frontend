import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import SetasDoQuadro, { PASSO_DA_SETA } from './SetasDoQuadro';

// O jsdom não mede nada: a largura do quadro e do conteúdo vêm daqui.
function Quadro({ largura, conteudo, inicio = 0 }: { largura: number; conteudo: number; inicio?: number }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const prender = (el: HTMLDivElement | null) => {
    if (!el || ref.current === el) return;
    Object.defineProperty(el, 'clientWidth', { configurable: true, value: largura });
    Object.defineProperty(el, 'scrollWidth', { configurable: true, value: conteudo });
    el.scrollLeft = inicio;
    el.scrollBy = vi.fn();
    ref.current = el;
  };
  return (
    <div>
      <div ref={prender} data-testid="quadro"><div /></div>
      <SetasDoQuadro quadro={ref} />
    </div>
  );
}

describe('SetasDoQuadro', () => {
  it('sem coluna escondida, nenhuma seta', () => {
    render(<Quadro largura={1000} conteudo={1000} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('no começo do quadro só aparece a seta da direita, e ela anda uma coluna', () => {
    render(<Quadro largura={1000} conteudo={2000} />);
    expect(screen.queryByRole('button', { name: 'Ver colunas à esquerda' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ver colunas à direita' }));
    expect(screen.getByTestId('quadro').scrollBy).toHaveBeenCalledWith({ left: PASSO_DA_SETA, behavior: 'smooth' });
  });

  it('no fim do quadro só aparece a seta da esquerda', () => {
    render(<Quadro largura={1000} conteudo={2000} inicio={1000} />);
    expect(screen.queryByRole('button', { name: 'Ver colunas à direita' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ver colunas à esquerda' }));
    expect(screen.getByTestId('quadro').scrollBy).toHaveBeenCalledWith({ left: -PASSO_DA_SETA, behavior: 'smooth' });
  });

  it('rolar o quadro acende a seta do lado que ficou pra trás', () => {
    render(<Quadro largura={1000} conteudo={2000} />);
    const quadro = screen.getByTestId('quadro');
    act(() => {
      quadro.scrollLeft = 400;
      fireEvent.scroll(quadro);
    });
    expect(screen.getByRole('button', { name: 'Ver colunas à esquerda' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ver colunas à direita' })).toBeTruthy();
  });
});
