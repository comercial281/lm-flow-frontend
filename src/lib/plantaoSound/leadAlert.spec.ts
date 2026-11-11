import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// O som do plantão guarda estado no módulo (anti-duplo, bloqueio, aba líder):
// cada teste carrega o módulo do zero.
async function carregar() {
  vi.resetModules();
  return import('./leadAlert');
}

const criados: AudioFalso[] = [];
let tocar: () => Promise<void>;
let toques = 0;

class AudioFalso {
  volume = 0.5;
  preload = '';
  currentTime = 0;
  constructor(public src: string) {
    criados.push(this);
  }
  play() {
    toques += 1;
    return tocar();
  }
}

describe('leadAlert', () => {
  beforeEach(() => {
    criados.length = 0;
    toques = 0;
    tocar = () => Promise.resolve();
    vi.stubGlobal('Audio', AudioFalso);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('toca o Chegou no volume máximo e devolve true', async () => {
    const m = await carregar();
    await expect(m.playLeadAlert()).resolves.toBe(true);
    expect(criados).toHaveLength(1);
    expect(criados[0].src).toBe('/audio/notifications/chegou.mp3');
    expect(criados[0].volume).toBe(1);
  });

  it('navegador recusa o som: devolve false e marca o bloqueio até alguém limpar', async () => {
    const m = await carregar();
    tocar = () => Promise.reject(new DOMException('sem clique', 'NotAllowedError'));
    const { result } = renderHook(() => m.useSoundBlocked());
    expect(result.current).toBe(false);

    let tocou: boolean | undefined;
    await act(async () => {
      tocou = await m.playLeadAlert();
    });
    expect(tocou).toBe(false);
    expect(result.current).toBe(true);

    act(() => m.clearSoundBlocked());
    expect(result.current).toBe(false);
  });

  it('erro que não é bloqueio (arquivo fora do ar) não marca a faixa', async () => {
    const m = await carregar();
    tocar = () => Promise.reject(new DOMException('sem arquivo', 'NotSupportedError'));
    await expect(m.playLeadAlert()).resolves.toBe(false);
    const { result } = renderHook(() => m.useSoundBlocked());
    expect(result.current).toBe(false);
  });

  it('dois pedidos em menos de 3 s tocam uma vez só; depois de 3 s toca de novo', async () => {
    vi.useFakeTimers();
    const m = await carregar();
    await expect(m.playLeadAlert()).resolves.toBe(true);
    await expect(m.playLeadAlert()).resolves.toBe(true);
    expect(toques).toBe(1);

    vi.advanceTimersByTime(3_000);
    await m.playLeadAlert();
    expect(toques).toBe(2);
  });

  it('pedido recusado não segura o próximo pela janela de 3 s', async () => {
    const m = await carregar();
    tocar = () => Promise.reject(new DOMException('sem clique', 'NotAllowedError'));
    await m.playLeadAlert();
    tocar = () => Promise.resolve();
    await expect(m.playLeadAlert()).resolves.toBe(true);
    expect(toques).toBe(2);
  });

  // Revisão (I2): o segundo pedido no meio de um toque em andamento recebe o
  // resultado REAL dele. Responder "toquei" antes da hora faria o aviso do
  // sistema sair calado sem som nenhum.
  it('pedido durante um toque em andamento recebe o resultado desse toque', async () => {
    const m = await carregar();
    let recusar!: (e: unknown) => void;
    tocar = () => new Promise((_ok, falha) => { recusar = falha; });
    const primeiro = m.playLeadAlert();
    const segundo = m.playLeadAlert();
    recusar(new DOMException('sem clique', 'NotAllowedError'));
    await expect(primeiro).resolves.toBe(false);
    await expect(segundo).resolves.toBe(false);
    expect(toques).toBe(1);
  });

  // Revisão (I3): um player só, pré-carregado ao abrir o app. Com o arquivo
  // baixando na hora do lead, o toque passava de 1,5 s e o aviso do sistema já
  // tinha tocado (som em dobro).
  it('pré-carrega o som e reaproveita o mesmo player, voltando ao começo', async () => {
    vi.useFakeTimers();
    const m = await carregar();
    m.preloadLeadAlert();
    expect(criados).toHaveLength(1);
    expect(criados[0].preload).toBe('auto');

    criados[0].currentTime = 1.2;
    await m.playLeadAlert();
    expect(criados).toHaveLength(1);
    expect(criados[0].currentTime).toBe(0);
  });

  it('sem navigator.locks, toda aba é líder', async () => {
    vi.stubGlobal('navigator', { ...navigator, locks: undefined });
    const m = await carregar();
    m.startRingLeaderElection();
    expect(m.isRingLeader()).toBe(true);
  });

  // Revisão (C2): a líder é a aba que o corretor está usando, não a primeira
  // que abriu. Aba que fica visível ou ganha foco toma a trava (steal); a que
  // perdeu deixa de tocar; a tela que sai solta a trava.
  describe('aba líder', () => {
    interface Pedido { opts?: { steal?: boolean }; cb: () => Promise<void> | void; rejeitar: (e: unknown) => void }
    let pedidos: Pedido[];
    let visivel: 'visible' | 'hidden';
    // Cada teste carrega o módulo de novo: o que um teste liga, ele desliga,
    // senão os ouvintes de foco dele seguem presos no document do próximo.
    const paradas: Array<() => void> = [];
    const iniciar = (m: Awaited<ReturnType<typeof carregar>>) => {
      const parar = m.startRingLeaderElection();
      paradas.push(parar);
      return parar;
    };

    beforeEach(() => {
      pedidos = [];
      visivel = 'hidden';
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visivel });
      const request = vi.fn((_nome: string, a: unknown, b?: unknown) => {
        const cb = (typeof a === 'function' ? a : b) as Pedido['cb'];
        const opts = (typeof a === 'function' ? undefined : a) as Pedido['opts'];
        return new Promise<void>((_ok, rejeitar) => { pedidos.push({ opts, cb, rejeitar }); });
      });
      vi.stubGlobal('navigator', { ...navigator, locks: { request } });
    });
    afterEach(() => {
      paradas.splice(0).forEach((parar) => parar());
      Reflect.deleteProperty(document, 'visibilityState');
    });

    it('aba escondida entra na fila sem roubar; só é líder quando a trava chega', async () => {
      const m = await carregar();
      iniciar(m);
      expect(pedidos).toHaveLength(1);
      expect(pedidos[0].opts?.steal).toBeFalsy();
      expect(m.isRingLeader()).toBe(false);
      pedidos[0].cb();
      expect(m.isRingLeader()).toBe(true);
    });

    it('aba visível ao abrir toma a trava na hora', async () => {
      visivel = 'visible';
      const m = await carregar();
      iniciar(m);
      expect(pedidos.some((p) => p.opts?.steal)).toBe(true);
    });

    it('ficar visível ou ganhar foco toma a trava', async () => {
      const m = await carregar();
      iniciar(m);
      visivel = 'visible';
      document.dispatchEvent(new Event('visibilitychange'));
      expect(pedidos.filter((p) => p.opts?.steal)).toHaveLength(1);
      pedidos.at(-1)!.cb();
      expect(m.isRingLeader()).toBe(true);

      // Já é líder: foco não pede de novo.
      window.dispatchEvent(new Event('focus'));
      expect(pedidos.filter((p) => p.opts?.steal)).toHaveLength(1);
    });

    it('outra aba roubou a trava: deixa de ser líder', async () => {
      const m = await carregar();
      iniciar(m);
      pedidos[0].cb();
      expect(m.isRingLeader()).toBe(true);
      pedidos[0].rejeitar(new DOMException('roubada', 'AbortError'));
      await Promise.resolve();
      await Promise.resolve();
      expect(m.isRingLeader()).toBe(false);
    });

    it('a tela que sai solta a trava e para de ouvir foco', async () => {
      const m = await carregar();
      const parar = iniciar(m);
      const segurando = pedidos[0].cb() as Promise<void>;
      let soltou = false;
      void segurando.then(() => { soltou = true; });
      parar();
      await Promise.resolve();
      expect(soltou).toBe(true);
      expect(m.isRingLeader()).toBe(false);

      visivel = 'visible';
      document.dispatchEvent(new Event('visibilitychange'));
      expect(pedidos).toHaveLength(1);
    });

    it('trava concedida depois de a tela sair é devolvida na hora', async () => {
      const m = await carregar();
      const parar = iniciar(m);
      parar();
      await expect(Promise.resolve(pedidos[0].cb())).resolves.toBeUndefined();
      expect(m.isRingLeader()).toBe(false);
    });
  });
});
