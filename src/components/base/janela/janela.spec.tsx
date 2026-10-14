import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import GrupoDaJanela from './GrupoDaJanela';
import CaixaDaJanela from './CaixaDaJanela';
import { ESCOLHA } from './escolha';

describe('peças do miolo da janela', () => {
  it('GrupoDaJanela: título em caixa alta e conteúdo embaixo, grupo com nome', () => {
    render(<GrupoDaJanela titulo="Situação"><span>x</span></GrupoDaJanela>);
    expect(screen.getByRole('group', { name: 'Situação' })).toBeInTheDocument();
    expect(screen.getByText('Situação').className).toContain('uppercase');
  });
  it('CaixaDaJanela: título com contagem, parte fixa e corpo que rola', () => {
    render(<CaixaDaJanela titulo="Histórico" contagem={10} fixo={<input aria-label="filtro" />}><p>evento</p></CaixaDaJanela>);
    expect(screen.getByRole('heading', { name: /Histórico/ })).toHaveTextContent('Histórico · 10');
    expect(screen.getByText('evento').parentElement!.className).toContain('overflow-y-auto');
  });
  it('ESCOLHA usa contorno e roxo claro', () => {
    expect(ESCOLHA).toContain('aria-pressed:border-primary');
  });
});
