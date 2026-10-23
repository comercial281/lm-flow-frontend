import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { CartaoDeFluxo } from './CartaoDeFluxo';

// Casca única do cartão das listas de Funis de mensagem (abas Manual e
// Follow-up): filete na cor do estado, título, selos, linha e ações.

const FILETE: Record<string, string> = {
  ligado: 'bg-emerald-600',
  desligado: 'bg-red-600',
  montando: 'bg-amber-500',
  arquivado: 'bg-slate-400',
};

describe('CartaoDeFluxo', () => {
  it.each(Object.keys(FILETE))('o filete do estado %s tem a cor certa', estado => {
    render(
      <ul>
        <CartaoDeFluxo titulo="Primeiro contato" aoAbrir={() => {}} estado={estado as 'ligado'} acoes={<span>acoes</span>} />
      </ul>,
    );
    const cartao = screen.getByTestId('cartao-de-fluxo');
    expect(cartao.tagName).toBe('LI');
    expect(cartao.getAttribute('data-estado')).toBe(estado);
    expect(within(cartao).getByTestId('filete-do-cartao').className).toContain(FILETE[estado]);
  });

  it('título clicável abre; selos, linha e ações aparecem', () => {
    const abrir = vi.fn();
    render(
      <ul>
        <CartaoDeFluxo
          titulo="Pós-visita"
          aoAbrir={abrir}
          estado="ligado"
          selos={<span>selo-x</span>}
          linha={<span>linha-y</span>}
          acoes={<button type="button">acao-z</button>}
        />
      </ul>,
    );
    const titulo = screen.getByRole('button', { name: 'Pós-visita' });
    expect(titulo.className).toContain('text-sm');
    expect(titulo.className).toContain('font-semibold');
    expect(titulo.className).toContain('truncate');
    fireEvent.click(titulo);
    expect(abrir).toHaveBeenCalledTimes(1);
    expect(screen.getByText('selo-x')).toBeTruthy();
    expect(screen.getByText('linha-y').closest('div')!.className).toContain('text-xs');
    expect(screen.getByRole('button', { name: 'acao-z' })).toBeTruthy();
  });
});
