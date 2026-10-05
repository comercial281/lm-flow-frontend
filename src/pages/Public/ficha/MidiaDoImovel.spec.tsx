import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import MidiaDoImovel from './MidiaDoImovel';

/* Largura do player: sozinho ocupa a linha (no computador, só a coluna de
   conteúdo, alinhado à esquerda); com vídeo e tour, duas colunas. */

const VIDEO = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const TOUR = 'https://my.matterport.com/show/?m=SxQL3iGyoDo';
const caixa = (titulo: string) => screen.getByTitle(titulo).parentElement!;

describe('MidiaDoImovel', () => {
  it('só o vídeo: o player ocupa a linha inteira e, no computador, a largura da coluna de conteúdo', () => {
    render(<MidiaDoImovel videoUrl={VIDEO} />);

    const c = caixa('Vídeo do imóvel');
    expect(c).toHaveClass('sm:col-span-2', 'lg:max-w-[calc(100%-400px)]');
    expect(c.parentElement).toHaveClass('grid', 'sm:grid-cols-2');
  });

  it('só o tour: mesma coisa', () => {
    render(<MidiaDoImovel tourUrl={TOUR} />);

    expect(caixa('Tour virtual do imóvel')).toHaveClass('sm:col-span-2', 'lg:max-w-[calc(100%-400px)]');
  });

  it('vídeo e tour: duas colunas, nenhum ocupa a linha', () => {
    render(<MidiaDoImovel videoUrl={VIDEO} tourUrl={TOUR} />);

    const v = caixa('Vídeo do imóvel');
    const t = caixa('Tour virtual do imóvel');
    expect(v.parentElement).toBe(t.parentElement);
    expect(v.parentElement).toHaveClass('sm:grid-cols-2');
    for (const c of [v, t]) {
      expect(c).not.toHaveClass('sm:col-span-2');
      expect(c).not.toHaveClass('lg:max-w-[calc(100%-400px)]');
    }
  });

  it('vídeo com player e tour só com botão: o player fica sozinho na linha', () => {
    render(<MidiaDoImovel videoUrl={VIDEO} tourUrl="https://tour.exemplo.com/123" />);

    expect(caixa('Vídeo do imóvel')).toHaveClass('sm:col-span-2');
    expect(screen.getByRole('link', { name: 'Fazer o tour virtual' })).toBeInTheDocument();
  });
});
