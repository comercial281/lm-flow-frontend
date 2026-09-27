import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAuthStore } from '@/store/authStore';
import type { UserResponse } from '@/types/auth';
import { useIsSuperAdmin, useIsOwner, isSupportUser } from './useIsSuperAdmin';

const pessoa = (email: string, is_support?: boolean) => ({ id: email, email, name: email, is_support }) as UserResponse;

describe('suporte da Leal Mídia', () => {
  beforeEach(() => useAuthStore.setState({ currentUser: null }));

  it('vem do sinal do servidor (Equipe do painel raiz)', () => {
    useAuthStore.setState({ currentUser: pessoa('freela@gmail.com', true) });
    expect(renderHook(() => useIsSuperAdmin()).result.current).toBe(true);
  });

  it('o e-mail sozinho não vale mais — nem o do dono', () => {
    useAuthStore.setState({ currentUser: pessoa('forjado@lealmidia.com.br') });
    expect(renderHook(() => useIsSuperAdmin()).result.current).toBe(false);
    useAuthStore.setState({ currentUser: pessoa('comercial@lealmidia.com.br', false) });
    expect(renderHook(() => useIsSuperAdmin()).result.current).toBe(false);
  });

  it('o dono continua reconhecido para o atalho da Área do Admin', () => {
    useAuthStore.setState({ currentUser: pessoa('Comercial@LealMidia.com.br') });
    expect(renderHook(() => useIsOwner()).result.current).toBe(true);
    expect(isSupportUser(null)).toBe(false);
  });

  it('resiliência: servidor antigo sem o campo cai no e-mail do dono, nunca "todo mundo é suporte"', () => {
    // `is_support` AUSENTE (servidor antigo, janela de deploy) — não confundir
    // com `false` explícito, que já é coberto no teste acima.
    useAuthStore.setState({ currentUser: pessoa('comercial@lealmidia.com.br') });
    expect(renderHook(() => useIsSuperAdmin()).result.current).toBe(true);
    useAuthStore.setState({ currentUser: pessoa('qualquer@gmail.com') });
    expect(renderHook(() => useIsSuperAdmin()).result.current).toBe(false);
  });
});
