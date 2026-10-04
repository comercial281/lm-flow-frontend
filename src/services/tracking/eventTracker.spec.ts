import { describe, it, expect, afterEach, vi } from 'vitest';
import { permissaoDeNotificacao } from './eventTracker';

describe('permissaoDeNotificacao', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('lê Notification.permission', () => {
    vi.stubGlobal('Notification', { permission: 'denied' });
    expect(permissaoDeNotificacao()).toBe('denied');
  });

  it('navegador sem a API (iPhone fora do app instalado) vira unsupported', () => {
    vi.stubGlobal('Notification', undefined);
    expect(permissaoDeNotificacao()).toBe('unsupported');
  });
});
