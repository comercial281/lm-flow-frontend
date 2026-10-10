import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Pagina, { ExtrasDaMolduraContext } from './Pagina';

describe('Pagina (moldura única)', () => {
  it('modo página: rola inteira, folga da Roleta e até 1400px', () => {
    render(<Pagina cabecalho={<h2>cab</h2>}><p>corpo</p></Pagina>);
    const largura = screen.getByText('cab').parentElement!;
    expect(largura.className).toContain('max-w-[1400px]');
    expect(largura.className).toContain('mx-auto');
    expect(largura.parentElement!.className).toContain('px-4 pb-20 pt-6 sm:px-6');
    expect(largura.parentElement!.parentElement!.className).toContain('overflow-y-auto');
  });

  it('modo conteúdo: não rola a página; o conteúdo ocupa o resto da altura', () => {
    render(<Pagina rolagem="conteudo" cabecalho={<h2>cab</h2>}><div>lista</div></Pagina>);
    const largura = screen.getByText('cab').parentElement!;
    expect(largura.className).toContain('flex-1');
    expect(largura.className).toContain('min-h-0');
    expect(largura.className).toContain('gap-6');
    expect(document.querySelector('.overflow-y-auto')).toBeNull();
  });

  it('estreita: corpo até max-w-4xl, sem centralizar', () => {
    render(<Pagina estreita cabecalho={<h2>cab</h2>}><p>corpo</p></Pagina>);
    const corpo = screen.getByText('corpo').parentElement!;
    expect(corpo.className).toContain('max-w-4xl');
    expect(corpo.className).not.toContain('mx-auto');
  });

  it('ordem: extras.acima, acima, cabeçalho, extras.abaixoDoCabecalho, corpo', () => {
    render(
      <ExtrasDaMolduraContext.Provider value={{ acima: <span>voltar</span>, abaixoDoCabecalho: <span>abas</span> }}>
        <Pagina acima={<span>trilha</span>} cabecalho={<span>titulo</span>}><span>corpo</span></Pagina>
      </ExtrasDaMolduraContext.Provider>,
    );
    const textos = Array.from(document.querySelectorAll('span')).map(s => s.textContent);
    expect(textos).toEqual(['voltar', 'trilha', 'titulo', 'abas', 'corpo']);
  });

  it('barra do topo fica dentro da rolagem, antes da folga (rola junto, como hoje no Meu site)', () => {
    render(<Pagina barraDoTopo={<nav>barra</nav>} cabecalho={<h2>cab</h2>} />);
    const rolagem = document.querySelector('.overflow-y-auto')!;
    expect(rolagem.firstElementChild!.textContent).toBe('barra');
  });
});
