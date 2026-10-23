import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { CloudWhatsappForm } from './CloudWhatsappForm';

const connectCloud = vi.fn();
const navigate = vi.fn();
let wpAppId = 'app123';

vi.mock('@/services/channels/whatsappService', () => ({
  default: { connectCloud: (...a: unknown[]) => connectCloud(...a) },
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));
vi.mock('@/contexts/GlobalConfigContext', () => ({
  useGlobalConfig: () => ({ wpAppId, wpApiVersion: 'v23.0', wpWhatsappConfigId: 'cfg1' }),
}));

let loginCb: ((r: unknown) => void) | undefined;
const login = vi.fn((cb: (r: unknown) => void) => {
  loginCb = cb;
});

const sinal = (event: string, data: Record<string, string>) => {
  window.dispatchEvent(
    new MessageEvent('message', {
      origin: 'https://www.facebook.com',
      data: JSON.stringify({ type: 'WA_EMBEDDED_SIGNUP', event, data }),
    }),
  );
};

const conectarComo = async (cartao: string, evento = 'FINISH') => {
  fireEvent.click(screen.getByRole('radio', { name: new RegExp(cartao) }));
  fireEvent.click(await screen.findByRole('button', { name: /Conectar pela Meta/ }));
  await act(async () => {
    sinal(evento, { phone_number_id: 'pn1', waba_id: 'wa1', business_id: 'b1' });
    loginCb?.({ authResponse: { code: 'codigo1' } });
  });
};

describe('CloudWhatsappForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    wpAppId = 'app123';
    (window as any).FB = { getLoginStatus: vi.fn(), init: vi.fn(), login };
    connectCloud.mockResolvedValue({ inbox_id: '9', name: 'Loja', phone_number: '+55', verified_name: 'Loja' });
  });

  it('chip novo manda mode new_number com o número do evento', async () => {
    render(<CloudWhatsappForm canFB />);
    await conectarComo('Chip novo');
    await waitFor(() =>
      expect(connectCloud).toHaveBeenCalledWith({
        code: 'codigo1', phone_number_id: 'pn1', waba_id: 'wa1', business_id: 'b1', mode: 'new_number',
      }),
    );
    expect(login.mock.calls[0][1].extras.featureType).toBeUndefined();
  });

  it('já uso manda mode coexistence e pede o app WhatsApp Business', async () => {
    render(<CloudWhatsappForm canFB />);
    await conectarComo('Já uso', 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING');
    await waitFor(() => expect(connectCloud).toHaveBeenCalledWith(expect.objectContaining({ mode: 'coexistence' })));
    expect(login.mock.calls[0][1].extras.featureType).toBe('whatsapp_business_app_onboarding');
  });

  it('mostra a frase do servidor no 422', async () => {
    connectCloud.mockRejectedValue({ response: { data: { error: 'Esse número já está em outro cliente.' } } });
    render(<CloudWhatsappForm canFB />);
    await conectarComo('Chip novo');
    expect(await screen.findByText('Esse número já está em outro cliente.')).toBeTruthy();
  });

  it('depois de conectar mostra o aviso de cobrança e abre a página do número', async () => {
    render(<CloudWhatsappForm canFB />);
    await conectarComo('Chip novo');
    expect(await screen.findByText(/A Meta cobra as mensagens no cartão da sua empresa/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir o número' }));
    expect(navigate).toHaveBeenCalledWith('/channels/9/oficial');
  });

  it('o serviço real não tem mais a troca de código pela rota antiga', async () => {
    const real: any = (await vi.importActual('@/services/channels/whatsappService')).default;
    expect(real.exchangeCode).toBeUndefined();
    expect(typeof real.connectCloud).toBe('function');
  });

  it('depois do 422 o botão volta a funcionar', async () => {
    connectCloud.mockRejectedValueOnce({ response: { data: { error: 'Frase do servidor.' } } });
    render(<CloudWhatsappForm canFB />);
    await conectarComo('Chip novo');
    await screen.findByText('Frase do servidor.');
    const botao = screen.getByRole('button', { name: /Conectar pela Meta/ }) as HTMLButtonElement;
    expect(botao.disabled).toBe(false);
    await act(async () => {
      fireEvent.click(botao);
      sinal('FINISH', { phone_number_id: 'pn1', waba_id: 'wa1', business_id: 'b1' });
      loginCb?.({ authResponse: { code: 'codigo2' } });
    });
    await waitFor(() => expect(connectCloud).toHaveBeenCalledTimes(2));
    expect(connectCloud.mock.calls[1][0].code).toBe('codigo2');
  });

  describe('sem evento de fim', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('libera a tela depois de 30 s', async () => {
      render(<CloudWhatsappForm canFB />);
      fireEvent.click(screen.getByRole('radio', { name: /Chip novo/ }));
      fireEvent.click(screen.getByRole('button', { name: /Conectar pela Meta/ }));
      act(() => loginCb?.({ authResponse: { code: 'c' } }));
      act(() => { vi.advanceTimersByTime(30_000); });
      expect(screen.getByText('A Meta não confirmou a conexão a tempo. Tente de novo.')).toBeTruthy();
      expect((screen.getByRole('button', { name: /Conectar pela Meta/ }) as HTMLButtonElement).disabled).toBe(false);
      expect(connectCloud).not.toHaveBeenCalled();
    });

    it('evento de fim não tratado vira erro', () => {
      render(<CloudWhatsappForm canFB />);
      fireEvent.click(screen.getByRole('radio', { name: /Chip novo/ }));
      fireEvent.click(screen.getByRole('button', { name: /Conectar pela Meta/ }));
      act(() => loginCb?.({ authResponse: { code: 'c' } }));
      act(() => sinal('FINISH_OBO_MIGRATION', {}));
      expect(screen.getByText('Esse tipo de conexão não é aceito aqui. Tente de novo escolhendo o número.')).toBeTruthy();
      act(() => { vi.advanceTimersByTime(30_000); });
      expect(screen.queryByText(/não confirmou a conexão a tempo/)).toBeNull();
    });
  });

  it('sem wpAppId mostra que não está liberado e sem botão', () => {
    wpAppId = '';
    render(<CloudWhatsappForm canFB />);
    expect(screen.getByText('A conexão com a API oficial ainda não está liberada neste LM Flow.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Conectar pela Meta/ })).toBeNull();
  });
});
