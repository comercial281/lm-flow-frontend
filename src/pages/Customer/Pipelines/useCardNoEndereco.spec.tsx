import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { useCardNoEndereco } from './useCardNoEndereco';

// E0 do funil (spec §7): F5 mantém o card aberto. Antes, o quadro abria o card
// pelo ?card= e apagava o endereço inteiro na mesma hora — F5 fechava o card e
// o link copiado só servia uma vez.

type Item = { id: string; nome: string };
const A: Item = { id: 'c1', nome: 'Ana' };
const B: Item = { id: 'c2', nome: 'Bruno' };
type Props = { itens: Item[]; carregando: boolean };

function montar(endereco: string, props: Props) {
  const aoAbrir = vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[endereco]}>{children}</MemoryRouter>
  );
  const r = renderHook(
    (p: Props) => ({ card: useCardNoEndereco({ ...p, aoAbrir }), local: useLocation(), ir: useNavigate() }),
    { wrapper, initialProps: props },
  );
  return { ...r, aoAbrir };
}

describe('useCardNoEndereco (E0: F5 mantém o card aberto)', () => {
  it('abre o card do ?card= quando o quadro carrega e NÃO tira o card do endereço', () => {
    const { result, rerender, aoAbrir } = montar('/pipelines/p1?card=c1&etapa=e9', { itens: [], carregando: true });
    expect(aoAbrir).not.toHaveBeenCalled();

    rerender({ itens: [A, B], carregando: false });

    expect(aoAbrir).toHaveBeenCalledTimes(1);
    expect(aoAbrir).toHaveBeenCalledWith(A);
    expect(result.current.local.search).toBe('?card=c1&etapa=e9');
  });

  it('o quadro recarregando (a cada 60 s e ao vivo) não reabre o card', () => {
    const { rerender, aoAbrir } = montar('/pipelines/p1?card=c1', { itens: [A], carregando: false });
    rerender({ itens: [{ ...A }, B], carregando: false });
    rerender({ itens: [{ ...A }], carregando: false });
    expect(aoAbrir).toHaveBeenCalledTimes(1);
  });

  it('fechar tira só o card do endereço (o resto fica)', () => {
    const { result } = montar('/pipelines/p1?card=c1&aba=perdidos', { itens: [A], carregando: false });
    act(() => result.current.card.fecharNoEndereco());
    expect(result.current.local.search).toBe('?aba=perdidos');
    expect(result.current.card.cardId).toBeNull();
  });

  it('abrir pelo clique grava o card no endereço, sem abrir de novo pelo efeito', () => {
    const { result, aoAbrir } = montar('/pipelines/p1?aba=abertos', { itens: [A, B], carregando: false });
    act(() => result.current.card.abrirNoEndereco('c2'));
    expect(result.current.local.search).toBe('?aba=abertos&card=c2');
    expect(aoAbrir).not.toHaveBeenCalled();
  });

  it('link novo com outro card abre o outro', () => {
    const { result, aoAbrir } = montar('/pipelines/p1?card=c1', { itens: [A, B], carregando: false });
    act(() => result.current.ir('/pipelines/p1?card=c2'));
    expect(aoAbrir).toHaveBeenLastCalledWith(B);
    expect(aoAbrir).toHaveBeenCalledTimes(2);
  });

  it('as funções de abrir e fechar não mudam de identidade (o card do quadro é memoizado)', () => {
    const { result, rerender } = montar('/pipelines/p1', { itens: [A], carregando: false });
    const { abrirNoEndereco, fecharNoEndereco } = result.current.card;
    act(() => result.current.card.abrirNoEndereco('c1'));
    rerender({ itens: [A, B], carregando: false });
    expect(result.current.card.abrirNoEndereco).toBe(abrirNoEndereco);
    expect(result.current.card.fecharNoEndereco).toBe(fecharNoEndereco);
  });

  // Review Focus 5 (parte desta entrega): link de card que não está no quadro.
  describe('card que não está no quadro', () => {
    it('arquivado ou de outra aba: avisa, não abre e mantém o endereço — nunca tela em branco', () => {
      const { result, rerender, aoAbrir } = montar('/pipelines/p1?card=sumiu', { itens: [], carregando: true });
      expect(result.current.card.foraDaAba).toBe(false); // ainda carregando: não acusa antes da hora

      rerender({ itens: [A], carregando: false });

      expect(result.current.card.foraDaAba).toBe(true);
      expect(aoAbrir).not.toHaveBeenCalled();
      expect(result.current.local.search).toBe('?card=sumiu');
    });

    it('o card que chega no recarregamento (lead novo do Bolsão) abre e o aviso some', () => {
      const { result, rerender, aoAbrir } = montar('/pipelines/p1?card=c2', { itens: [A], carregando: false });
      expect(result.current.card.foraDaAba).toBe(true);

      rerender({ itens: [A, B], carregando: false });

      expect(aoAbrir).toHaveBeenCalledWith(B);
      expect(result.current.card.foraDaAba).toBe(false);
    });

    it('fechar o aviso tira o ?card= e o aviso some', () => {
      const { result } = montar('/pipelines/p1?card=sumiu', { itens: [A], carregando: false });
      act(() => result.current.card.fecharNoEndereco());
      expect(result.current.card.foraDaAba).toBe(false);
      expect(result.current.local.search).toBe('');
    });

    it('sem ?card= não há aviso', () => {
      const { result } = montar('/pipelines/p1', { itens: [], carregando: false });
      expect(result.current.card.foraDaAba).toBe(false);
    });
  });
});
