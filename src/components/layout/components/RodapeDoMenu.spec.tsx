import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import { TooltipProvider } from '@/components/ui/ds';
import RodapeDoMenu from './RodapeDoMenu';

const tema = { theme: 'light', toggleTheme: vi.fn() };
const demo = { demoMode: false, toggleDemoMode: vi.fn() };
vi.mock('@/hooks/useDarkMode', () => ({ useDarkMode: () => tema }));
vi.mock('@/hooks/useDemoMode', () => ({ useDemoMode: () => demo }));

const GUIA = [{ name: 'Guia do LM Flow', href: '/tutorials', icon: GraduationCap }];

const montar = (rota = '/dashboard', recolhido = false) =>
  render(
    <MemoryRouter initialEntries={[rota]}>
      <TooltipProvider>
        <RodapeDoMenu itens={GUIA} recolhido={recolhido} />
      </TooltipProvider>
    </MemoryRouter>,
  );

describe('rodapé do menu em ícones', () => {
  beforeEach(() => {
    tema.theme = 'light';
    demo.demoMode = false;
    tema.toggleTheme.mockClear();
    demo.toggleDemoMode.mockClear();
  });

  it('mostra Guia, Suporte, divisória, Tema e Modo demo, nessa ordem', () => {
    const { container } = montar();
    const rodape = container.querySelector('[data-rodape-do-menu]')!;
    const nomes = Array.from(rodape.children).map(el =>
      el.hasAttribute('data-divisoria') ? '|' : el.getAttribute('aria-label'),
    );
    expect(nomes).toEqual(['Guia do LM Flow', 'Falar com o suporte', '|', 'Tema escuro', 'Modo demo']);
  });

  it('o Guia acende quando a tela aberta é ele', () => {
    montar('/tutorials');
    expect(screen.getByRole('link', { name: 'Guia do LM Flow' })).toHaveAttribute('aria-current', 'page');
  });

  it('o tema diz o que o clique faz e troca o tema', () => {
    tema.theme = 'dark';
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Tema claro' }));
    expect(tema.toggleTheme).toHaveBeenCalled();
  });

  it('o modo demo mostra se está ligado', () => {
    demo.demoMode = true;
    montar();
    const botao = screen.getByRole('button', { name: 'Modo demo' });
    expect(botao).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(botao);
    expect(demo.toggleDemoMode).toHaveBeenCalled();
  });

  it('recolhido, empilha os ícones', () => {
    const { container } = montar('/dashboard', true);
    expect(container.querySelector('[data-rodape-do-menu]')!.className).toContain('flex-col');
  });
});
