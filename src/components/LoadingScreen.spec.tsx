// Tela de partida (guarda de rota): a rodinha sai roxa (classes que existem) e o
// leitor de tela ouve o que está acontecendo ("Verificando autenticação…").
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import LoadingScreen from './LoadingScreen';

describe('LoadingScreen', () => {
  it('anuncia o rótulo pro leitor de tela', () => {
    render(<LoadingScreen rotulo="Verificando autenticação…" />);
    expect(screen.getByRole('status', { name: /Verificando autenticação/ })).toBeInTheDocument();
  });

  it('sem rótulo, anuncia "Carregando…" e usa as cores do tema', () => {
    const { container } = render(<LoadingScreen />);
    expect(screen.getByRole('status', { name: /Carregando/ })).toBeInTheDocument();
    expect(container.querySelector('.bg-neutral-background-default, .text-primary-interaction-default')).toBeNull();
    expect(container.querySelector('.bg-background')).not.toBeNull();
    expect(container.querySelector('svg.text-primary')).not.toBeNull();
  });
});
