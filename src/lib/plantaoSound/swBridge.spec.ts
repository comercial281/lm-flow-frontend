import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const playLeadAlert = vi.fn(async () => true);
let lider = true;
vi.mock('./leadAlert', () => ({
  playLeadAlert: () => playLeadAlert(),
  isRingLeader: () => lider,
}));

import { installLeadAlertBridge, LEAD_ALERT_MESSAGE } from './swBridge';

// A ponte entre o service worker e a aba: o SW avisa "chegou lead", a aba líder
// toca o Chegou e responde se conseguiu. Oferta da roleta também relê a lista de
// ofertas na hora (sem esperar os 15 s), o que abre o pop-up e começa a repetição.
function swFalso() {
  const ouvintes: Array<(e: MessageEvent) => void> = [];
  return {
    ouvintes,
    addEventListener: vi.fn((_t: string, fn: (e: MessageEvent) => void) => ouvintes.push(fn)),
    removeEventListener: vi.fn((_t: string, fn: (e: MessageEvent) => void) => {
      const i = ouvintes.indexOf(fn);
      if (i >= 0) ouvintes.splice(i, 1);
    }),
  };
}

async function mandar(sw: ReturnType<typeof swFalso>, data: unknown) {
  const porta = { postMessage: vi.fn() };
  sw.ouvintes.forEach((fn) => fn({ data, ports: [porta] } as unknown as MessageEvent));
  await vi.waitFor(() => expect(porta.postMessage).toHaveBeenCalled());
  return porta;
}

describe('installLeadAlertBridge', () => {
  let sw: ReturnType<typeof swFalso>;

  beforeEach(() => {
    playLeadAlert.mockReset();
    playLeadAlert.mockResolvedValue(true);
    lider = true;
    sw = swFalso();
    vi.stubGlobal('navigator', { ...navigator, serviceWorker: sw });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('aba líder toca e responde played: true', async () => {
    installLeadAlertBridge(vi.fn());
    const porta = await mandar(sw, { type: LEAD_ALERT_MESSAGE, event: 'lead.atribuido', url: '/contacts/1' });
    expect(playLeadAlert).toHaveBeenCalledTimes(1);
    expect(porta.postMessage).toHaveBeenCalledWith({ played: true });
  });

  it('navegador bloqueou o som: responde played: false', async () => {
    playLeadAlert.mockResolvedValue(false);
    installLeadAlertBridge(vi.fn());
    const porta = await mandar(sw, { type: LEAD_ALERT_MESSAGE, event: 'lead.atribuido', url: '/x' });
    expect(porta.postMessage).toHaveBeenCalledWith({ played: false });
  });

  it('oferta da roleta relê as ofertas na hora', async () => {
    const onOffer = vi.fn();
    installLeadAlertBridge(onOffer);
    await mandar(sw, { type: LEAD_ALERT_MESSAGE, event: 'roleta.oferta_recebida', url: '/roleta/aceite/a' });
    expect(onOffer).toHaveBeenCalledTimes(1);
  });

  it('"Lead virou seu" não relê as ofertas', async () => {
    const onOffer = vi.fn();
    installLeadAlertBridge(onOffer);
    await mandar(sw, { type: LEAD_ALERT_MESSAGE, event: 'lead.atribuido', url: '/x' });
    expect(onOffer).not.toHaveBeenCalled();
  });

  it('aba que não é a líder responde played: false sem tocar, mas relê as ofertas', async () => {
    lider = false;
    const onOffer = vi.fn();
    installLeadAlertBridge(onOffer);
    const porta = await mandar(sw, { type: LEAD_ALERT_MESSAGE, event: 'roleta.oferta_recebida', url: '/x' });
    expect(playLeadAlert).not.toHaveBeenCalled();
    expect(porta.postMessage).toHaveBeenCalledWith({ played: false });
    expect(onOffer).toHaveBeenCalledTimes(1);
  });

  it('mensagem de outro tipo é ignorada', async () => {
    const onOffer = vi.fn();
    installLeadAlertBridge(onOffer);
    const porta = { postMessage: vi.fn() };
    sw.ouvintes.forEach((fn) => fn({ data: { type: 'SKIP_WAITING' }, ports: [porta] } as unknown as MessageEvent));
    await Promise.resolve();
    expect(playLeadAlert).not.toHaveBeenCalled();
    expect(porta.postMessage).not.toHaveBeenCalled();
    expect(onOffer).not.toHaveBeenCalled();
  });

  it('desinstalar tira o ouvinte; sem service worker não quebra', () => {
    const tirar = installLeadAlertBridge(vi.fn());
    tirar();
    expect(sw.ouvintes).toHaveLength(0);

    vi.stubGlobal('navigator', { ...navigator, serviceWorker: undefined });
    expect(() => installLeadAlertBridge(vi.fn())()).not.toThrow();
  });
});
