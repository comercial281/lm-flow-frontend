import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Carregando from './Carregando';

describe('Carregando: esqueleto cinza da casa', () => {
  it('avisa o leitor de tela que está carregando, sem ler as formas cinzas', () => {
    const { container } = render(<Carregando />);
    const caixa = screen.getByRole('status');
    expect(caixa).toHaveAttribute('aria-busy', 'true');
    expect(caixa).toHaveTextContent('Carregando…');
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it('lista: uma bolinha de avatar e duas linhas por item, 3 itens por padrão', () => {
    const { container } = render(<Carregando />);
    expect(container.querySelectorAll('.rounded-full')).toHaveLength(3);
    expect(container.querySelectorAll('.bg-muted\\/70')).toHaveLength(3);
  });

  it('é cinza, pulsa e para quando o sistema pede menos movimento', () => {
    const { container } = render(<Carregando variante="texto" linhas={4} />);
    const formas = container.querySelectorAll('[aria-hidden="true"] .rounded');
    expect(formas).toHaveLength(4);
    formas.forEach(f => {
      expect(f.className).toMatch(/bg-muted/);
      expect(f.className).toContain('motion-reduce:animate-none');
      expect(f.className).not.toMatch(/bg-accent|bg-primary/);
    });
  });

  it('cartões: um cartão por item e rótulo próprio', () => {
    const { container } = render(<Carregando variante="cartoes" linhas={2} rotulo="Carregando imóveis…" />);
    expect(container.querySelectorAll('.border-border\\/60')).toHaveLength(2);
    expect(screen.getByRole('status')).toHaveTextContent('Carregando imóveis…');
  });
});
