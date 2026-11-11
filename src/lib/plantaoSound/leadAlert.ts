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

let ultimoToque = Number.NEGATIVE_INFINITY;

export async function playLeadAlert(): Promise<boolean> {
  const agora = Date.now();
  if (agora - ultimoToque < DEDUPE_MS) return true;
  // Marca ANTES do play: duas chamadas no mesmo instante não podem tocar duas.
  ultimoToque = agora;
  try {
    const audio = new Audio(LEAD_ALERT_SRC);
    audio.volume = 1;
    await audio.play();
    setBlocked(false);
    return true;
  } catch (err) {
    ultimoToque = Number.NEGATIVE_INFINITY;
    if (err instanceof DOMException && err.name === 'NotAllowedError') setBlocked(true);
    return false;
  }
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
// A trava do navegador (Web Locks) fica com UMA aba enquanto ela estiver aberta;
// fechou, a próxima da fila assume sozinha. Navegador sem a trava: toda aba é
// líder (preferimos tocar em dobro a não tocar).

let lider = false;
let eleicaoIniciada = false;

function travas(): LockManager | undefined {
  return typeof navigator === 'undefined' ? undefined : navigator.locks;
}

export function startRingLeaderElection(): void {
  if (eleicaoIniciada) return;
  eleicaoIniciada = true;
  const locks = travas();
  if (!locks?.request) return;
  void locks
    .request(LOCK_NAME, () => {
      lider = true;
      return new Promise<void>(() => {});
    })
    .catch(() => {
      lider = true;
    });
}

export function isRingLeader(): boolean {
  if (!travas()?.request) return true;
  return lider;
}
