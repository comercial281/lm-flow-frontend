import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const perfil = vi.hoisted(() => ({ updateUISettings: vi.fn() }));
vi.mock('@/services/profile/profileService', () => ({ profileService: perfil }));

import { useAuthStore } from '@/store/authStore';
import type { UserResponse } from '@/types/auth';
import { salvarUISettings } from './uiSettings';

const usuario = (ui_settings: Record<string, unknown>) => ({ id: 'u1', email: 'a@b.c', name: 'Ana', ui_settings }) as unknown as UserResponse;

beforeEach(() => {
  vi.clearAllMocks();
  perfil.updateUISettings.mockResolvedValue({});
  useAuthStore.setState({
    currentUser: usuario({ font_size: 'medium', editor_message_key: 'cmd_enter', captacoes_vistas_ate: '2026-10-01T10:00:00.000Z' }),
  });
});

describe('salvarUISettings', () => {
  it('trocar o tamanho da fonte manda as outras chaves como estão', async () => {
    await salvarUISettings({ font_size: 'large' });
    expect(perfil.updateUISettings).toHaveBeenCalledWith({
      font_size: 'large', editor_message_key: 'cmd_enter', captacoes_vistas_ate: '2026-10-01T10:00:00.000Z',
    });
    expect(useAuthStore.getState().currentUser?.ui_settings).toEqual({
      font_size: 'large', editor_message_key: 'cmd_enter', captacoes_vistas_ate: '2026-10-01T10:00:00.000Z',
    });
  });

  it('erro do servidor sobe para quem chamou (a tela avisa)', async () => {
    perfil.updateUISettings.mockRejectedValue(new Error('rede'));
    await expect(salvarUISettings({ font_size: 'small' })).rejects.toThrow('rede');
  });
});

// A tela de Perfil mandava só a chave mudada e apagava as outras (03/10/2026).
describe('a tela de Perfil', () => {
  const src = readFileSync(resolve(__dirname, '../../..', 'src/pages/Shared/Profile/Profile.tsx'), 'utf8');
  it('grava ui_settings pelo salvarUISettings, nunca direto no serviço', () => {
    expect(src).toContain('salvarUISettings(');
    expect(src).not.toContain('profileService.updateUISettings(');
  });
});
