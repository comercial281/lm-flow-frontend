import { useSyncExternalStore } from 'react';

// O som do Modo Plantão: "Chegou", escolhido pelo dono do produto em 11/11/2026.
// Toca quando lead chega para o corretor (oferta da roleta e "Lead virou seu").
// É obrigatório: não passa pela chave "Alertas de áudio" do Perfil, que segue
// valendo só para o som de mensagem.
//
// Três coisas moram aqui porque todo caminho que toca o som precisa delas:
// - o anti-duplo: o mesmo lead pode chegar pelo push (service worker) e pelo
//   pop-up/sininho quase ao mesmo tempo; dentro de 3 s toca uma vez só;
// - o bloqueio: sem nenhum clique na página o navegador recusa o som. A tela
//   mostra uma faixa pra ligar SÓ depois de uma recusa de verdade (o dono vetou
//   faixa que aparece para todo mundo);
// - a aba líder: com duas abas do LM Flow abertas, só uma toca (senão o som da
//   oferta repetiria em dobro a cada 10 s).

export const LEAD_ALERT_SRC = '/audio/notifications/chegou.mp3';
export const DEDUPE_MS = 3_000;
const LOCK_NAME = 'lmflow-lead-ringer';

// ── O som ────────────────────────────────────────────────────────────────────
//
// Um player só, pré-carregado quando o app abre (preloadLeadAlert). Baixar o
// arquivo na hora do lead fazia o primeiro toque passar de 1,5 s: o service
// worker já tinha mostrado o aviso com o som do sistema, e o Chegou vinha
// depois (som em dobro).

let player: HTMLAudioElement | null = null;

function pegarPlayer(): HTMLAudioElement {
  if (!player) {
    player = new Audio(LEAD_ALERT_SRC);
    player.preload = 'auto';
  }
  return player;
}

// Criar o player com `preload = 'auto'` já começa a baixar o arquivo.
export function preloadLeadAlert(): void {
  try {
    pegarPlayer();
  } catch {
    /* navegador sem áudio: toca (ou não) na hora */
  }
}

let ultimoToque = Number.NEGATIVE_INFINITY;
// Pedido que chega no meio de um toque recebe o resultado REAL dele. Responder
// "toquei" antes da hora faria o service worker calar o aviso do sistema mesmo
// que o navegador recusasse o som.
let emAndamento: Promise<boolean> | null = null;

export function playLeadAlert(): Promise<boolean> {
  if (emAndamento) return emAndamento;
  if (Date.now() - ultimoToque < DEDUPE_MS) return Promise.resolve(true);

  emAndamento = (async () => {
    try {
      const audio = pegarPlayer();
      audio.currentTime = 0;
      audio.volume = 1;
      await audio.play();
      ultimoToque = Date.now();
      setBlocked(false);
      return true;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') setBlocked(true);
      return false;
    } finally {
      emAndamento = null;
    }
  })();
  return emAndamento;
}

// ── Bloqueio do navegador ────────────────────────────────────────────────────

let bloqueado = false;
const ouvintes = new Set<() => void>();

function setBlocked(valor: boolean) {
  if (bloqueado === valor) return;
  bloqueado = valor;
  ouvintes.forEach((avisar) => avisar());
}

export function clearSoundBlocked(): void {
  setBlocked(false);
}

function assinar(avisar: () => void) {
  ouvintes.add(avisar);
  return () => {
    ouvintes.delete(avisar);
  };
}

export function useSoundBlocked(): boolean {
  return useSyncExternalStore(assinar, () => bloqueado, () => false);
}

// ── Aba líder ────────────────────────────────────────────────────────────────
//
// A líder é a aba que o corretor está USANDO: ao ficar visível ou ganhar foco,
// ela toma a trava do navegador (Web Locks, `steal`), e a que perdeu para de
// tocar. Escondida, a aba só entra na fila; quando a líder fecha (ou a tela dela
// sai do app), a próxima assume sozinha. Assim o "Ver depois" clicado numa aba
// cala a oferta (quem clicou é a líder), e a aba que o corretor está olhando é
// a que toca. Navegador sem a trava: toda aba é líder (preferimos tocar em dobro
// a não tocar).

let lider = false;
let ativo = false;
let seq = 0;
let dono = 0;
let soltar: (() => void) | null = null;

function travas(): LockManager | undefined {
  return typeof navigator === 'undefined' ? undefined : navigator.locks;
}

function pedirTrava(roubar: boolean) {
  const locks = travas();
  if (!locks?.request) return;
  const meu = ++seq;
  const quandoChegar = () => {
    // A tela já saiu: devolve a trava na hora pra outra aba assumir.
    if (!ativo) return Promise.resolve();
    dono = meu;
    lider = true;
    return new Promise<void>((devolver) => {
      soltar = () => {
        if (dono === meu) lider = false;
        soltar = null;
        devolver();
      };
    });
  };
  const pedido = roubar ? locks.request(LOCK_NAME, { steal: true }, quandoChegar) : locks.request(LOCK_NAME, quandoChegar);
  // Rejeitada = outra aba roubou (ou o navegador recusou). Só perde a liderança
  // se ESTE pedido era o dono: um roubo da própria aba não pode derrubá-la.
  void pedido.catch(() => {
    if (dono === meu) {
      lider = false;
      soltar = null;
    }
  });
}

function assumirSeVisivel() {
  if (!ativo || lider) return;
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') pedirTrava(true);
}

function aoFocar() {
  if (!ativo || lider) return;
  pedirTrava(true);
}

export function startRingLeaderElection(): () => void {
  const locks = travas();
  if (!locks?.request || ativo) return () => {};
  ativo = true;
  pedirTrava(false);
  assumirSeVisivel();
  document.addEventListener('visibilitychange', assumirSeVisivel);
  window.addEventListener('focus', aoFocar);

  return () => {
    ativo = false;
    document.removeEventListener('visibilitychange', assumirSeVisivel);
    window.removeEventListener('focus', aoFocar);
    soltar?.();
    lider = false;
  };
}

export function isRingLeader(): boolean {
  if (!travas()?.request) return true;
  return lider;
}
