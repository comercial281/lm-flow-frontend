/**
 * O Pixel da Meta na landing, carregado DEPOIS da página.
 *
 * O script do Pixel pesa ~250 KB (o próprio `fbevents.js` mais a configuração
 * que ele puxa) e a Meta o serve com 20 minutos de cache — nada disso é nosso
 * para mudar. O que é nosso é QUANDO ele entra: colado à página, ele disputa
 * rede e processador com a capa e o formulário no exato momento em que o lead
 * está esperando a primeira tela.
 *
 * O trecho oficial da Meta já funciona com fila: `fbq('init')` e
 * `fbq('track', 'PageView')` são enfileirados na hora e disparam quando o
 * script chega. Então a chamada sai AGORA (o PageView conta do mesmo jeito) e
 * o download do script espera a página terminar de carregar — com um teto,
 * para uma imagem pendurada não segurar o Pixel para sempre.
 *
 * A Meta atribui o PageView ao carregamento do script, então o lead que fecha
 * a aba em menos de ~2 s não é contado — e não seria um lead.
 */

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-expressions, prefer-spread -- trecho oficial do Pixel da Meta, mantido como ela publica */

const SCRIPT_SRC = 'https://connect.facebook.net/en_US/fbevents.js';
/** Teto de espera pelo evento `load`: página com imagem pendurada não pode
 *  deixar a Meta sem o PageView. */
export const PIXEL_LOAD_CEILING_MS = 3000;

export interface InstallPixelOptions {
  pageView?: boolean;
  /** Só para teste: injeta o "documento" e a janela. */
  win?: any;
}

/** Devolve a função `fbq` (a fila até o script chegar), instalando-a se preciso. */
export function ensureFbq(w: any = window): (...args: unknown[]) => void {
  if (!w.fbq) {
    const n: any = (w.fbq = function (...args: unknown[]) {
      n.callMethod ? n.callMethod.apply(n, args) : n.queue.push(args);
    });
    if (!w._fbq) w._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = '2.0';
    n.queue = [];
  }
  return w.fbq;
}

/** Baixa o script do Pixel depois de a página carregar (uma vez só). */
export function loadPixelScript(w: any = window): void {
  const doc = w.document;
  if (!doc || w.__lmPixelScriptRequested) return;
  w.__lmPixelScriptRequested = true;

  let done = false;
  const append = () => {
    if (done) return;
    done = true;
    const t = doc.createElement('script');
    t.async = true;
    t.src = SCRIPT_SRC;
    doc.head.appendChild(t);
  };

  if (doc.readyState === 'complete') {
    append();
    return;
  }
  w.addEventListener('load', append, { once: true });
  w.setTimeout(append, PIXEL_LOAD_CEILING_MS);
}

/** Instala o Pixel para esta landing: `init` (e `PageView`) na hora, script depois. */
export function installPixel(pixelId: string, opts: InstallPixelOptions = {}): void {
  const w = opts.win ?? window;
  const fbq = ensureFbq(w);
  fbq('init', pixelId);
  if (opts.pageView !== false) fbq('track', 'PageView');
  loadPixelScript(w);
}
