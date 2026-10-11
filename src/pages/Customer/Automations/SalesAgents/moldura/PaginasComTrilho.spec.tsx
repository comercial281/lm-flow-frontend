import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AlignLeft, SquareCheck, CalendarDays } from 'lucide-react';
import PaginasComTrilho, { type GrupoDoTrilho } from './PaginasComTrilho';

const grupos: GrupoDoTrilho<'a' | 'b' | 'c'>[] = [
  { id: 'g1', rotulo: 'Como ela fala', itens: [
    { id: 'a', titulo: 'Instruções', frase: 'Frase A', icone: AlignLeft },
    { id: 'b', titulo: 'Regras', frase: 'Frase B', icone: SquareCheck, contagem: 13, pendente: true },
  ] },
  { id: 'g2', rotulo: 'Repasse', itens: [
    { id: 'c', titulo: 'Agendamento', frase: 'Frase C', icone: CalendarDays, trava: { dica: 'Só com visita', leitor: '(travada)' }, contagem: 4 },
  ] },
];

describe('PaginasComTrilho', () => {
  it('cabeçalho com grupo, título e frase da página aberta', () => {
    render(<PaginasComTrilho rotulo="Páginas" grupos={grupos} atual="a" aoIr={vi.fn()}><p>conteúdo</p></PaginasComTrilho>);
    expect(screen.getByRole('heading', { name: 'Instruções' })).toBeInTheDocument();
    expect(screen.getByText('Frase A')).toBeInTheDocument();
    expect(screen.getByText('Como ela fala', { selector: 'header p' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Instruções/ })).toHaveAttribute('aria-current', 'page');
  });

  it('todo item tem ícone escondido do leitor de tela', () => {
    const { container } = render(<PaginasComTrilho rotulo="Páginas" grupos={grupos} atual="a" aoIr={vi.fn()}>x</PaginasComTrilho>);
    expect(container.querySelectorAll('nav button svg[aria-hidden="true"]').length).toBe(3 + 1);
  });

  it('pendência tira o contador; sem pendência o contador aparece', () => {
    render(<PaginasComTrilho rotulo="Páginas" grupos={grupos} atual="a" aoIr={vi.fn()}>x</PaginasComTrilho>);
    const regras = screen.getByRole('button', { name: /Regras/ });
    expect(regras).toHaveTextContent('(tem pendência)');
    expect(regras).not.toHaveTextContent('13');
    expect(screen.getByRole('button', { name: /Agendamento/ })).toHaveTextContent('4');
  });

  it('trava mostra a dica e o texto do leitor', () => {
    render(<PaginasComTrilho rotulo="Páginas" grupos={grupos} atual="a" aoIr={vi.fn()}>x</PaginasComTrilho>);
    const ag = screen.getByRole('button', { name: /Agendamento/ });
    expect(ag).toHaveAttribute('title', 'Só com visita');
    expect(ag).toHaveTextContent('(travada)');
  });

  it('clicar vai pra página', async () => {
    const aoIr = vi.fn();
    render(<PaginasComTrilho rotulo="Páginas" grupos={grupos} atual="a" aoIr={aoIr}>x</PaginasComTrilho>);
    await userEvent.click(screen.getByRole('button', { name: /Regras/ }));
    expect(aoIr).toHaveBeenCalledWith('b');
  });
});
