// Código do link: o id (UUID) escrito em base58, 22 caracteres, sem hífen.
//
// O WhatsApp reconhece UUID (8-4-4-4-12) como chave Pix aleatória e, no toque,
// copia a "chave" em vez de abrir o link: a URL inteira deixa de ser link
// (Pinot, 19/10/2026). Os links que saem no WhatsApp levam este código; a tela
// troca de volta pelo UUID antes de qualquer rota montar (LinkSemPix).
//
// Por que base58 e não o hex sem hífen: só 9 dos 58 símbolos são algarismos,
// então o código praticamente nunca forma 11 dígitos seguidos (cara de CPF ou
// telefone). Tamanho fixo 22: nunca confunde com UUID, com `teste` (aceite de
// teste) nem com o número curto da conversa.
//
// Os mesmos pares de teste estão no backend (Links::PublicId).

const ALFABETO = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BASE = 58n;
const TAMANHO = 22;
const MAIOR_UUID = (1n << 128n) - 1n;
const CODIGO = /^[1-9A-HJ-NP-Za-km-z]{22}$/;
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const UUID_INTEIRO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function codigoDoUuid(uuid: string): string {
  if (!UUID_INTEIRO.test(uuid)) return uuid;
  let n = BigInt(`0x${uuid.replace(/-/g, '')}`);
  let codigo = '';
  while (n > 0n) {
    codigo = ALFABETO[Number(n % BASE)] + codigo;
    n /= BASE;
  }
  return codigo.padStart(TAMANHO, ALFABETO[0]);
}

export function uuidDoCodigo(codigo: string): string | null {
  if (!CODIGO.test(codigo)) return null;
  let n = 0n;
  for (const letra of codigo) n = n * BASE + BigInt(ALFABETO.indexOf(letra));
  if (n > MAIOR_UUID) return null;
  const hex = n.toString(16).padStart(32, '0');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Link pra colar no WhatsApp: cada UUID do texto vira o código. */
export function trocarUuidsPorCodigo(texto: string): string {
  return texto.replace(UUID, (uuid) => codigoDoUuid(uuid));
}

// Só as rotas que recebem id por link de fora. Slug (landing, imóvel, portal)
// pode ter 22 letras e não é código: fica de fora de propósito.
const ROTAS_COM_ID: RegExp[] = [
  /^\/roleta\/aceite\/([^/]+)$/,
  /^\/conversations\/([^/]+)$/,
  /^\/contacts\/([^/]+)$/,
  /^\/pipelines\/([^/]+)\/card\/([^/]+)$/,
  /^\/pipelines\/([^/]+)$/,
  /^\/academia\/curso\/([^/]+)$/,
];
const PARAMETROS_COM_ID: Record<string, string> = {
  '/pipelines/': 'card',
  '/academia/curso/': 'lesson',
};

/**
 * O endereço com o UUID no lugar do código, ou null quando não há o que trocar
 * (endereço já com UUID, aceite de teste, rota que não recebe id).
 */
export function enderecoComUuid(pathname: string, search: string): string | null {
  const partes = ROTAS_COM_ID.map((r) => r.exec(pathname)).find(Boolean);
  if (!partes) return null;

  let caminho = pathname;
  for (const parte of partes.slice(1)) {
    const uuid = uuidDoCodigo(parte);
    if (uuid) caminho = caminho.replace(`/${parte}`, `/${uuid}`);
  }

  // Troca só o valor do parâmetro: o resto do endereço segue como chegou.
  let query = search;
  const prefixo = Object.keys(PARAMETROS_COM_ID).find((p) => pathname.startsWith(p));
  if (prefixo) {
    const chave = PARAMETROS_COM_ID[prefixo];
    const valor = new URLSearchParams(search).get(chave) ?? '';
    const uuid = uuidDoCodigo(valor);
    if (uuid) query = search.replace(`${chave}=${valor}`, `${chave}=${uuid}`);
  }

  if (caminho === pathname && query === search) return null;
  return `${caminho}${query}`;
}
