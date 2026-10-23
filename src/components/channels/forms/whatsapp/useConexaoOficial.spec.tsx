import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { origemDaMeta, useConexaoOficial } from './useConexaoOficial';

const connectCloud = vi.fn();
vi.mock('@/services/channels/whatsappService', () => ({
  default: { connectCloud: (...a: unknown[]) => connectCloud(...a) },
}));
const config = vi.hoisted(() => ({
  atual: { wpAppId: 'app1', wpApiVersion: 'v23.0', wpWhatsappConfigId: 'cfg1' } as Record<string, string | undefined>,
}));
vi.mock('@/contexts/GlobalConfigContext', () => ({
  useGlobalConfig: () => config.atual,
}));

const evento = (event: string, origin = 'https://www.facebook.com', extra: Record<string, unknown> = {}) =>
  new MessageEvent('message', {
    origin,
    data: JSON.stringify({
      type: 'WA_EMBEDDED_SIGNUP',
      event,
      data: { phone_number_id: 'pn1', waba_id: 'wa1', business_id: 'b1', ...extra },
    }),
  });

let loginCb: ((r: unknown) => void) | undefined;

describe('useConexaoOficial', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    loginCb = undefined;
    config.atual = { wpAppId: 'app1', wpApiVersion: 'v23.0', wpWhatsappConfigId: 'cfg1' };
    (window as any).FB = {
      getLoginStatus: vi.fn(),
      init: vi.fn(),
      login: (cb: (r: unknown) => void) => {
        loginCb = cb;
      },
    };
    connectCloud.mockResolvedValue({ inbox_id: '9', name: 'Loja', phone_number: '+55', verified_name: 'Loja' });
  });

  it('com inboxId manda inbox_id e o caminho no connectCloud', async () => {
    const aoConectar = vi.fn();
    const { result } = renderHook(() => useConexaoOficial({ inboxId: '9', aoConectar }));
    act(() => result.current.iniciar('coexistence'));
    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          origin: 'https://www.facebook.com',
          data: JSON.stringify({
            type: 'WA_EMBEDDED_SIGNUP',
            event: 'FINISH',
            data: { phone_number_id: 'pn1', waba_id: 'wa1', business_id: 'b1' },
          }),
        }),
      );
      loginCb?.({ authResponse: { code: 'c1' } });
    });
    expect(connectCloud).toHaveBeenCalledWith(
      expect.objectContaining({ inbox_id: '9', mode: 'coexistence', code: 'c1', waba_id: 'wa1' }),
    );
    expect(aoConectar).toHaveBeenCalled();
  });

  it('aceita a janela da Meta de qualquer subdomínio de facebook.com, e só dele', () => {
    expect(origemDaMeta('https://business.facebook.com')).toBe(true);
    expect(origemDaMeta('https://www.facebook.com')).toBe(true);
    expect(origemDaMeta('https://facebook.com')).toBe(true);
    expect(origemDaMeta('https://evilfacebook.com')).toBe(false);
    expect(origemDaMeta('https://facebook.com.golpe.io')).toBe(false);
    expect(origemDaMeta('null')).toBe(false);
  });

  it('evento de fim vindo de business.facebook.com conecta; de evilfacebook.com é ignorado', async () => {
    const { result } = renderHook(() => useConexaoOficial({ aoConectar: vi.fn() }));
    act(() => result.current.iniciar('new_number'));
    await act(async () => {
      window.dispatchEvent(evento('FINISH', 'https://evilfacebook.com'));
      loginCb?.({ authResponse: { code: 'c1' } });
    });
    expect(connectCloud).not.toHaveBeenCalled();
    await act(async () => {
      window.dispatchEvent(evento('FINISH', 'https://business.facebook.com'));
    });
    expect(connectCloud).toHaveBeenCalledWith(expect.objectContaining({ code: 'c1', phone_number_id: 'pn1' }));
  });

  it('evento de fim que chega depois do prazo de 30 s não conecta', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useConexaoOficial({ aoConectar: vi.fn() }));
    act(() => result.current.iniciar('new_number'));
    act(() => loginCb?.({ authResponse: { code: 'c1' } }));
    act(() => vi.advanceTimersByTime(30_000));
    expect(result.current.erro).toBe('A Meta não confirmou a conexão a tempo. Tente de novo.');
    await act(async () => {
      window.dispatchEvent(evento('FINISH'));
    });
    expect(connectCloud).not.toHaveBeenCalled();
    expect(result.current.carregando).toBe(false);
  });

  it('falha antes do retorno do login não arma o prazo nem guarda o código', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useConexaoOficial({ aoConectar: vi.fn() }));
    act(() => result.current.iniciar('new_number'));
    act(() => {
      window.dispatchEvent(evento('CANCEL'));
    });
    act(() => loginCb?.({ authResponse: { code: 'c1' } }));
    act(() => vi.advanceTimersByTime(30_000));
    // Continua a frase do cancelamento: o prazo não foi armado.
    expect(result.current.erro).toBe('Você fechou a janela da Meta antes de terminar.');
    await act(async () => {
      window.dispatchEvent(evento('FINISH'));
    });
    expect(connectCloud).not.toHaveBeenCalled();
  });

  it('CANCEL e ERROR usam frase própria, nunca a mensagem crua da Meta', () => {
    const { result } = renderHook(() => useConexaoOficial({ aoConectar: vi.fn() }));
    act(() => result.current.iniciar('new_number'));
    act(() => {
      window.dispatchEvent(evento('CANCEL', undefined, { error_message: 'User cancelled login' }));
    });
    expect(result.current.erro).toBe('Você fechou a janela da Meta antes de terminar.');
    act(() => result.current.iniciar('new_number'));
    act(() => {
      window.dispatchEvent(evento('ERROR', undefined, { error_message: 'Something went wrong' }));
    });
    expect(result.current.erro).toBe('A Meta não conseguiu concluir a conexão. Tente de novo.');
  });

  it('sem a configuração do login da Meta a conexão não está liberada', () => {
    config.atual = { wpAppId: 'app1', wpApiVersion: 'v23.0', wpWhatsappConfigId: undefined };
    const { result } = renderHook(() => useConexaoOficial({ aoConectar: vi.fn() }));
    expect(result.current.liberado).toBe(false);
  });
});
