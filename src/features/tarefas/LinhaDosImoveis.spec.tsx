import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import LinhaDosImoveis, { textoDosImoveis } from './LinhaDosImoveis';

describe('LinhaDosImoveis (f2-07)', () => {
  it('escreve singular e plural por aba', () => {
    expect(textoDosImoveis('hoje', 1).titulo).toBe('1 imóvel vence hoje');
    expect(textoDosImoveis('hoje', 3).titulo).toBe('3 imóveis vencem hoje');
    expect(textoDosImoveis('atrasadas', 8).titulo).toBe('8 imóveis desatualizados');
    expect(textoDosImoveis('proxima_semana', 2).titulo).toBe('2 imóveis vencem semana que vem');
  });

  it('mostra Atrasada só nos já vencidos e abre a lista no clique', () => {
    const aoAbrir = vi.fn();
    const { rerender } = render(<ul><LinhaDosImoveis balde="atrasadas" quantidade={8} deQuem="seus" aoAbrir={aoAbrir} /></ul>);
    expect(screen.getByText('Atrasada')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /8 imóveis desatualizados/ }));
    expect(aoAbrir).toHaveBeenCalled();
    rerender(<ul><LinhaDosImoveis balde="amanha" quantidade={2} deQuem="seus" aoAbrir={aoAbrir} /></ul>);
    expect(screen.queryByText('Atrasada')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});
