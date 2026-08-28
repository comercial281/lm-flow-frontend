import '@testing-library/jest-dom';

// ── REDE DE VERDADE É PROIBIDA EM TESTE ──────────────────────────────────────
//
// POR QUE ISTO EXISTE
// Três specs deste projeto ficaram congelados por tempo indeterminado, e a
// suíte completa nunca tinha terminado. Um dos motivos era requisição de rede
// sem mock: o componente chama o serviço ao montar, o axios dispara um XHR, e
// como a variável de ambiente da API não existe em teste a URL sai como
// `undefined/api/v1/...`, que o jsdom resolve contra http://127.0.0.1:3000.
//
// Nesta máquina o socket é RECUSADO na hora e vira só ruído no stderr. Numa
// máquina onde ele PENDURE em vez de recusar — proxy, firewall que descarta em
// silêncio, qualquer coisa escutando na 3000 — a requisição nunca se resolve e
// o arquivo nunca termina.
//
// Ou seja: passar ou congelar dependia de como a máquina de quem roda trata uma
// porta fechada. Isso não é teste, é sorte.
//
// O QUE ISTO FAZ
// Transforma o travamento silencioso numa falha imediata que diz o endereço e o
// que fazer. Se o seu teste bater aqui, mocke o SERVIÇO que faz a chamada
// (`vi.mock('@/services/...')`) — não o axios, não o fetch.
const recusar = (metodo: string, url: unknown): never => {
  throw new Error(
    `[teste] ${metodo} ${String(url)} — requisição de rede de verdade num teste.\n` +
      `Mocke o serviço que faz esta chamada, com vi.mock('@/services/...').\n` +
      `Rede em teste unitário ou está mockada, ou é um travamento esperando a\n` +
      `máquina certa: aqui a porta recusa na hora, em outra ela pendura.`,
  );
};

const abrirOriginal = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function (
  this: XMLHttpRequest,
  ...args: Parameters<typeof abrirOriginal>
) {
  recusar(String(args[0]), args[1]);
  return abrirOriginal.apply(this, args);
};

globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
  recusar(init?.method ?? 'GET', input instanceof Request ? input.url : input)) as typeof fetch;
