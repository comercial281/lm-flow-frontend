import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import BaseHeader from './BaseHeader';

describe('BaseHeader', () => {
  it('título com a barrinha e a frase', () => {
    render(<BaseHeader title="Contatos" subtitle="Todas as pessoas" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Contatos' })).toBeInTheDocument();
    expect(screen.getByText('Todas as pessoas')).toBeInTheDocument();
  });

  it('título aceita elemento (nome editável)', () => {
    render(<BaseHeader title={<span>Roleta A <button type="button">Mudar o nome</button></span>} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Roleta A');
  });

  it('aDireita entra na linha do título, junto do botão principal', () => {
    render(
      <BaseHeader
        title="Visitas"
        aDireita={<button type="button">Calendário</button>}
        primaryAction={{ label: 'Agendar visita', onClick: vi.fn() }}
      />,
    );
    const linha = screen.getByRole('heading', { level: 1 }).closest('[data-linha-do-titulo]')!;
    expect(linha).toContainElement(screen.getByRole('button', { name: 'Calendário' }));
    expect(linha).toContainElement(screen.getByRole('button', { name: 'Agendar visita' }));
  });

  it('sem busca, filtro nem ação secundária, não desenha a linha da busca (sem buraco embaixo do título)', () => {
    const { container } = render(<BaseHeader title="Integrações" />);
    expect(container.querySelector('[data-linha-da-busca]')).toBeNull();
  });

  it('com busca, desenha a linha da busca', () => {
    const { container } = render(<BaseHeader title="Contatos" onSearchChange={vi.fn()} searchValue="" />);
    expect(container.querySelector('[data-linha-da-busca]')).not.toBeNull();
  });

  it('sem título (aba dentro de outra página): sem h1, ação continua', () => {
    render(<BaseHeader primaryAction={{ label: 'Novo time', onClick: vi.fn() }} />);
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    expect(screen.getByRole('button', { name: 'Novo time' })).toBeInTheDocument();
  });
});
