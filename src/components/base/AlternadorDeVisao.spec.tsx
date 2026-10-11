import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Grid3X3, List, Map as MapIcon } from 'lucide-react';
import AlternadorDeVisao from './AlternadorDeVisao';

const OPCOES = [
  { valor: 'cartoes', icone: Grid3X3, nome: 'Ver em cartões' },
  { valor: 'lista', icone: List, nome: 'Ver em lista' },
  { valor: 'mapa', icone: MapIcon, nome: 'Ver no mapa' },
] as const;

type Visao = (typeof OPCOES)[number]['valor'];

const Controlado = () => {
  const [v, setV] = useState<Visao>('cartoes');
  return <AlternadorDeVisao rotulo="Visão" valor={v} opcoes={[...OPCOES]} aoEscolher={setV} />;
};

describe('AlternadorDeVisao', () => {
  it('é um grupo com nome, cada botão com nome, dica e aria-pressed', () => {
    render(<Controlado />);
    expect(screen.getByRole('group', { name: 'Visão' })).toBeInTheDocument();
    const lista = screen.getByRole('button', { name: 'Ver em lista' });
    expect(lista).toHaveAttribute('title', 'Ver em lista');
    expect(lista).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Ver em cartões' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicar escolhe; clicar no já escolhido não avisa de novo', async () => {
    const aoEscolher = vi.fn();
    render(<AlternadorDeVisao valor="lista" opcoes={[...OPCOES]} aoEscolher={aoEscolher} />);
    await userEvent.click(screen.getByRole('button', { name: 'Ver em lista' }));
    expect(aoEscolher).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Ver no mapa' }));
    expect(aoEscolher).toHaveBeenCalledWith('mapa');
  });

  it('só o escolhido entra no Tab; setas andam e escolhem, dando a volta', async () => {
    render(<Controlado />);
    expect(screen.getByRole('button', { name: 'Ver em lista' })).toHaveAttribute('tabindex', '-1');
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Ver em cartões' })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: 'Ver em lista' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Ver em lista' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(screen.getByRole('button', { name: 'Ver no mapa' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('o selecionado não usa a classe que ganha o degradê do botão principal', () => {
    render(<Controlado />);
    expect(screen.getByRole('button', { name: 'Ver em cartões' })).not.toHaveClass('bg-primary');
  });
});
