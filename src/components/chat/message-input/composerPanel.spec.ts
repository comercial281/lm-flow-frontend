import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useComposerPanel } from './composerPanel';

// Automações · sprint 4 (04/10/2026): um painel por vez no campo de mensagem.

describe('um painel por vez', () => {
  it('abrir um fecha o outro; clicar no aberto fecha', () => {
    const { result } = renderHook(() => useComposerPanel());
    act(() => result.current.toggle('funnel'));
    expect(result.current.open).toBe('funnel');
    act(() => result.current.toggle('emoji'));
    expect(result.current.open).toBe('emoji');
    act(() => result.current.toggle('emoji'));
    expect(result.current.open).toBeNull();
  });

  it('o "fechar" de um painel não fecha o outro que acabou de abrir', () => {
    const { result } = renderHook(() => useComposerPanel());
    act(() => result.current.toggle('funnel'));
    // O clique fora do emoji chega atrasado: não pode fechar o funil.
    act(() => result.current.close('emoji'));
    expect(result.current.open).toBe('funnel');
    act(() => result.current.close('funnel'));
    expect(result.current.open).toBeNull();
  });

  it('o campo de mensagem usa o estado único (sem um useState por painel)', () => {
    const codigo = readFileSync(resolve(__dirname, 'MessageInput.tsx'), 'utf8');
    expect(codigo).toContain('useComposerPanel()');
    expect(codigo).not.toMatch(/const \[show(EmojiPicker|Funnels|BookPicker), set/);
    expect(codigo).toContain('<DispararFunilPanel');
    expect(codigo).not.toContain('MessageFunnelPopover');
  });
});
