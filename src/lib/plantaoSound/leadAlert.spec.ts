import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// O som do plantão guarda estado no módulo (anti-duplo, bloqueio, aba líder):
// cada teste carrega o módulo do zero.
async function carregar() {
  vi.resetModules();
  return import('./leadAlert');
}

const criados: Array<{ src: string; volume: number }> = [];
let tocar: () => Promise<void>;

class AudioFalso {
  volume = 0.5;
  constructor(public src: string) {
    criados.push(this);
  }
  play() {
    return tocar();
  }
}

describe('leadAlert', () => {
  beforeEach(() => {
    criados.length = 0;
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
    expect(criados).toHaveLength(1);

    vi.advanceTimersByTime(3_000);
    await m.playLeadAlert();
    expect(criados).toHaveLength(2);
  });

  it('pedido recusado não segura o próximo pela janela de 3 s', async () => {
    const m = await carregar();
    tocar = () => Promise.reject(new DOMException('sem clique', 'NotAllowedError'));
    await m.playLeadAlert();
    tocar = () => Promise.resolve();
    await expect(m.playLeadAlert()).resolves.toBe(true);
    expect(criados).toHaveLength(2);
  });

  it('sem navigator.locks, toda aba é líder', async () => {
    vi.stubGlobal('navigator', { ...navigator, locks: undefined });
    const m = await carregar();
    m.startRingLeaderElection();
    expect(m.isRingLeader()).toBe(true);
  });

  it('com navigator.locks, só é líder quem pegou a trava', async () => {
    let entregar: (() => unknown) | undefined;
    const request = vi.fn((_nome: string, cb: () => unknown) => {
      entregar = cb;
      return new Promise(() => {});
    });
    vi.stubGlobal('navigator', { ...navigator, locks: { request } });
    const m = await carregar();
    m.startRingLeaderElection();
    expect(request).toHaveBeenCalledWith('lmflow-lead-ringer', expect.any(Function));
    expect(m.isRingLeader()).toBe(false);

    entregar?.();
    expect(m.isRingLeader()).toBe(true);
  });
});
