import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AlignLeft, SquareCheck, CalendarDays } from 'lucide-react';
import { simularCelular } from '@/test/telaDeCelular';
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
    const regras = screen.getByRole('button', { name: /^Regras/ });
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
    await userEvent.click(screen.getByRole('button', { name: /^Regras/ }));
    expect(aoIr).toHaveBeenCalledWith('b');
  });
});

describe('PaginasComTrilho: o molde do Configurar', () => {
  const seguidas: GrupoDoTrilho<'a' | 'b' | 'c'>[] = [
    { id: 'g', rotulo: 'Configurar', itens: [
      { id: 'a', titulo: 'Modo operante', frase: 'Frase A', icone: AlignLeft },
      { id: 'b', titulo: 'Números e usuários', frase: 'Frase B', icone: SquareCheck },
      { id: 'c', titulo: 'Condução', frase: 'Frase C', icone: CalendarDays },
    ] },
  ];
  const desenhar = (atual: 'a' | 'b' | 'c', aoIr = vi.fn()) =>
    render(<PaginasComTrilho rotulo="Páginas" grupos={seguidas} atual={atual} aoIr={aoIr}><p>conteúdo</p></PaginasComTrilho>);

  it('um sticky só: o índice (o pé e o meio não grudam)', () => {
    const { container } = desenhar('b');
    expect(container.querySelectorAll('[class*="sticky"]')).toHaveLength(1);
    expect(screen.getByRole('navigation', { name: 'Páginas' }).className).toMatch(/lg:sticky/);
  });

  it('emCard: título, frase e blocos moram num Card só; o pé fica fora dele', () => {
    const { container } = render(<PaginasComTrilho rotulo="Páginas" grupos={seguidas} atual="b" aoIr={vi.fn()} emCard><p>bloco</p></PaginasComTrilho>);
    const card = container.querySelector('[data-slot="card"]') as HTMLElement;
    expect(container.querySelectorAll('[data-slot="card"]')).toHaveLength(1);
    expect(within(card).getByRole('heading', { name: 'Números e usuários' })).toBeInTheDocument();
    expect(within(card).getByText('Frase B')).toBeInTheDocument();
    expect(within(card).getByText('bloco')).toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: /Próxima/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Próxima → Condução' })).toBeInTheDocument();
  });

  it('moldura na largura toda da Pagina (sem teto próprio) e índice de lg:w-52', () => {
    const { container } = desenhar('b');
    expect((container.firstChild as HTMLElement).className).not.toMatch(/max-w-/);
    expect(screen.getByRole('navigation', { name: 'Páginas' }).className).toMatch(/lg:w-52/);
  });

  it('o pé traz "← Anterior <título>" e "Próxima → <título>" e navega', async () => {
    const aoIr = vi.fn();
    desenhar('b', aoIr);
    const anterior = screen.getByRole('button', { name: '← Anterior Modo operante' });
    const proxima = screen.getByRole('button', { name: 'Próxima → Condução' });
    await userEvent.click(anterior);
    await userEvent.click(proxima);
    expect(aoIr.mock.calls).toEqual([['a'], ['c']]);
  });

  it('na primeira não tem Anterior; na última não tem Próxima', () => {
    const { unmount } = desenhar('a');
    expect(screen.queryByRole('button', { name: /^← Anterior/ })).toBeNull();
    expect(screen.getByRole('button', { name: /^Próxima →/ })).toBeInTheDocument();
    unmount();
    desenhar('c');
    expect(screen.queryByRole('button', { name: /^Próxima →/ })).toBeNull();
    expect(screen.getByRole('button', { name: /^← Anterior/ })).toBeInTheDocument();
  });

  it('o Ensinar usa a mesma moldura (pé e índice, com os grupos dele)', () => {
    render(<PaginasComTrilho rotulo="Páginas do Ensinar" grupos={grupos} atual="b" aoIr={vi.fn()}>x</PaginasComTrilho>);
    expect(screen.getByRole('button', { name: '← Anterior Instruções' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Próxima → Agendamento' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Repasse' })).toBeInTheDocument();
  });

  describe('celular (400 px)', () => {
    let tela: ReturnType<typeof simularCelular>;
    beforeEach(() => { tela = simularCelular(); });
    afterEach(() => tela.restaurar());

    it('o índice vira pílulas que quebram linha, sem rolar pro lado e sem grudar', () => {
      const { container } = desenhar('b');
      const nav = screen.getByRole('navigation', { name: 'Páginas' });
      expect(nav).toHaveAttribute('data-estilo', 'pilulas');
      expect(nav.className).toMatch(/flex-wrap/);
      expect(container.querySelectorAll('[class*="sticky"]')).toHaveLength(0);
      expect(container.innerHTML).not.toMatch(/overflow-x-(auto|scroll)|whitespace-nowrap/);
      expect(within(nav).getAllByRole('button')).toHaveLength(3);
      expect(screen.getByRole('button', { name: 'Números e usuários' })).toHaveAttribute('aria-current', 'page');
    });

    it('o pé continua e a coluna é uma só', () => {
      const { container } = desenhar('b');
      expect(screen.getByRole('button', { name: 'Próxima → Condução' })).toBeInTheDocument();
      expect((container.firstChild as HTMLElement).className).toMatch(/flex-col/);
    });
  });

  it('no computador o índice é a coluna de sempre', () => {
    desenhar('b');
    expect(screen.getByRole('navigation', { name: 'Páginas' })).not.toHaveAttribute('data-estilo', 'pilulas');
  });
});
