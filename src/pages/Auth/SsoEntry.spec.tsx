import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';

// Entrar do painel (auditoria 3E-04): o passe não passa mais pela URL. A tela
// troca o código de uso único pelo passe e tira o que veio da barra na hora.
const mocks = vi.hoisted(() => ({
  setAccessToken: vi.fn(),
  exchange: vi.fn(),
  replace: vi.fn(),
}));

vi.mock('@/store/authStore', () => ({
  useAuthStore: { getState: () => ({ setAccessToken: mocks.setAccessToken }) },
}));

vi.mock('@/services/auth/ssoEntryService', () => ({
  ssoEntryService: { exchange: mocks.exchange },
}));

import SsoEntry, { lerEntradaDaUrl } from './SsoEntry';

const locationOriginal = window.location;

function abrir(url: string) {
  window.history.replaceState(null, '', url);
}

describe('SsoEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...locationOriginal, replace: mocks.replace, search: '', pathname: '/sso' },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: locationOriginal });
  });

  it('lê o código e já limpa a barra', () => {
    Object.defineProperty(window, 'location', { configurable: true, value: locationOriginal });
    abrir('/sso?code=abc');
    const lido = lerEntradaDaUrl();
    expect(lido.code).toBe('abc');
    expect(window.location.search).toBe('');
  });

  it('troca o código pelo passe e entra', async () => {
    (window.location as { search: string }).search = '?code=abc';
    mocks.exchange.mockResolvedValue('passe-1');
    render(<SsoEntry />);
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/'));
    expect(mocks.exchange).toHaveBeenCalledWith('abc');
    expect(mocks.setAccessToken).toHaveBeenCalledWith('passe-1');
  });

  it('código vencido ou usado: vai pro login sem gravar nada', async () => {
    (window.location as { search: string }).search = '?code=velho';
    mocks.exchange.mockResolvedValue(null);
    render(<SsoEntry />);
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/login'));
    expect(mocks.setAccessToken).not.toHaveBeenCalled();
  });

  it('link antigo com ?token= ainda entra, sem chamar a troca', async () => {
    (window.location as { search: string }).search = '?token=antigo';
    render(<SsoEntry />);
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/'));
    expect(mocks.exchange).not.toHaveBeenCalled();
    expect(mocks.setAccessToken).toHaveBeenCalledWith('antigo');
  });

  it('a página não manda o próprio endereço como Referer', () => {
    (window.location as { search: string }).search = '?code=abc';
    mocks.exchange.mockReturnValue(new Promise(() => {}));
    render(<SsoEntry />);
    expect(document.querySelector('meta[name="referrer"]')?.getAttribute('content')).toBe('no-referrer');
  });
});
