import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import GrupoDaJanela from './GrupoDaJanela';
import CaixaDaJanela from './CaixaDaJanela';
import CampoDaJanela from './CampoDaJanela';
import GradeDaJanela from './GradeDaJanela';
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
  it('CampoDaJanela: o rótulo liga ao campo pelo htmlFor', () => {
    render(<CampoDaJanela rotulo="Nome" htmlFor="nome"><input id="nome" /></CampoDaJanela>);
    expect(screen.getByLabelText('Nome')).toBeInTheDocument();
  });
  it('CampoDaJanela: obrigatório mostra o asterisco e o nome acessível diz obrigatório', () => {
    render(<CampoDaJanela rotulo="Nome" htmlFor="nome" obrigatorio><input id="nome" /></CampoDaJanela>);
    expect(screen.getByLabelText(/Nome.*obrigatório/)).toBeInTheDocument();
    expect(screen.getByText('*')).toHaveAttribute('aria-hidden', 'true');
  });
  it('CampoDaJanela: erro tem role alert e ajuda aparece', () => {
    render(<CampoDaJanela rotulo="Nome" erro="Preencha o nome" ajuda="Como no documento"><input /></CampoDaJanela>);
    expect(screen.getByRole('alert')).toHaveTextContent('Preencha o nome');
    expect(screen.getByText('Como no documento').className).toContain('text-xs');
  });
  it('CampoDaJanela: colunas={2} aplica sm:col-span-2', () => {
    const { container } = render(<CampoDaJanela rotulo="Nome" colunas={2}><input /></CampoDaJanela>);
    expect((container.firstChild as HTMLElement).className).toContain('sm:col-span-2');
  });
  it('GradeDaJanela: 4 colunas no computador, 1 no celular', () => {
    const { container } = render(<GradeDaJanela><span>x</span></GradeDaJanela>);
    const c = (container.firstChild as HTMLElement).className;
    expect(c).toContain('sm:grid-cols-4');
    expect(c).toContain('grid-cols-1');
  });
});
