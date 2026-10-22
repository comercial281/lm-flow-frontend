import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useConexaoOficial } from './useConexaoOficial';

const connectCloud = vi.fn();
vi.mock('@/services/channels/whatsappService', () => ({
  default: { connectCloud: (...a: unknown[]) => connectCloud(...a) },
}));
vi.mock('@/contexts/GlobalConfigContext', () => ({
  useGlobalConfig: () => ({ wpAppId: 'app1', wpApiVersion: 'v23.0', wpWhatsappConfigId: 'cfg1' }),
}));

let loginCb: ((r: unknown) => void) | undefined;

describe('useConexaoOficial', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
