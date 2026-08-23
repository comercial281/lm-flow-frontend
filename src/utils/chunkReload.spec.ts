// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isChunkError, reloadForNewVersion, retryImport } from './chunkReload';

describe('chunkReload — protocolo nova versão sem tela de erro (LM Flow)', () => {
  let reload: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sessionStorage.clear();
    reload = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload },
    });
  });

  it('detecta erro de chunk e ignora erro normal', () => {
    expect(isChunkError(new Error('Failed to fetch dynamically imported module: /assets/index-X.js'))).toBe(true);
    expect(isChunkError(new Error('Importing a module script failed'))).toBe(true);
    expect(isChunkError(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(isChunkError(null)).toBe(false);
  });

  it('recarrega no máximo 1x por janela (anti-loop)', async () => {
    expect(await reloadForNewVersion()).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(await reloadForNewVersion()).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('retryImport: import ok passa direto, sem reload', async () => {
    const mod = { default: 'ok' };
    await expect(retryImport(() => Promise.resolve(mod))).resolves.toBe(mod);
    expect(reload).not.toHaveBeenCalled();
  });

  it('retryImport: chunk faltando dispara reload e fica pendente (sem tela de erro)', async () => {
    const p = retryImport(() => Promise.reject(new Error('Failed to fetch dynamically imported module: /assets/x.js')));
    await new Promise((r) => setTimeout(r, 0));
    expect(reload).toHaveBeenCalledTimes(1);
    const race = await Promise.race([p.then(() => 'resolveu'), Promise.resolve('pendente')]);
    expect(race).toBe('pendente');
  });

  it('retryImport: erro normal (não-chunk) é repassado', async () => {
    await expect(retryImport(() => Promise.reject(new Error('boom normal')))).rejects.toThrow('boom normal');
  });
});
