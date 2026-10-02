import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SeletorComAbas, decodificar, type AbaDoSeletor } from './SeletorComAbas';

const toque = vi.hoisted(() => ({ atual: false }));
vi.mock('@/hooks/usePonteiroDeToque', () => ({ usePonteiroDeToque: () => toque.atual }));

const ABAS: AbaDoSeletor[] = [
  { chave: 'corretor', rotulo: 'Corretores', opcoes: [{ valor: 'u1', rotulo: 'Ana' }, { valor: 'u2', rotulo: 'Bia' }] },
  { chave: 'roleta', rotulo: 'Roleta', opcoes: [], vazio: 'Nenhuma roleta ligada.' },
];

afterEach(() => {
  toque.atual = false;
});

describe('SeletorComAbas', () => {
  it('no computador abre com as abas no topo e mostra só a aba escolhida', () => {
    const onChange = vi.fn();
    render(<SeletorComAbas aria-label="Responsável" abas={ABAS} value={null} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Responsável' }));
    expect(screen.getByRole('tab', { name: 'Corretores' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('option', { name: 'Ana' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Roleta' }));
    expect(screen.queryByRole('option', { name: 'Ana' })).not.toBeInTheDocument();
    expect(screen.getByText('Nenhuma roleta ligada.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Corretores' }));
    fireEvent.click(screen.getByRole('option', { name: 'Bia' }));
    expect(onChange).toHaveBeenCalledWith({ aba: 'corretor', valor: 'u2' });
  });

  it('a caixa mostra o rótulo do que está escolhido', () => {
    render(<SeletorComAbas aria-label="Responsável" abas={ABAS} value={{ aba: 'corretor', valor: 'u1' }} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Responsável' })).toHaveTextContent('Ana');
  });

  it('no celular vira a lista do sistema, com um grupo por aba', () => {
    toque.atual = true;
    const onChange = vi.fn();
    render(<SeletorComAbas aria-label="Responsável" abas={ABAS} value={null} onChange={onChange} />);

    expect(screen.getByRole('group', { name: 'Corretores' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Responsável'), { target: { value: 'corretor:u1' } });
    expect(onChange).toHaveBeenCalledWith({ aba: 'corretor', valor: 'u1' });
  });

  it('decodificar separa aba e valor pelo primeiro ":"', () => {
    expect(decodificar('roleta:abc-1')).toEqual({ aba: 'roleta', valor: 'abc-1' });
    expect(decodificar('')).toBeNull();
  });
});
