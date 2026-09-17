/**
 * A landing de anúncio já com o conteúdo DENTRO do HTML.
 *
 * POR QUE ISTO EXISTE
 * Mesmo com a entrada enxuta, a landing ainda tinha uma fila: o HTML chegava,
 * pedia o conteúdo ao servidor da API (outra origem, outra conexão, ~500 ms no
 * celular), e só então descobria QUAL foto é a capa — o maior elemento da
 * primeira tela, o LCP do PageSpeed. A capa era invisível para o navegador
 * até o React montar.
 *
 * O middleware do Vercel (`middleware.ts`, na raiz) busca o conteúdo do lado
 * de lá, onde a API está a um salto, e o costura no HTML por estas funções:
 * o conteúdo vira `window.__lmLanding` (que a página consome sem pedir nada) e
 * a capa vira um `<link rel="preload">` — o navegador começa a baixá-la no
 * mesmo instante em que lê o HTML, em paralelo com o código.
 *
 * Funções PURAS, sem rede: é o que permite testá-las aqui, e o middleware é
 * uma casca fina em volta delas.
 */
import type { PublicLandingDTO } from './landingLoader';

/** Onde o middleware costura os dados. Sem o marcador, o HTML volta intacto
 *  e a página busca o conteúdo sozinha (o caminho de sempre). */
export const LANDING_DATA_MARKER = '<!--LM_LANDING_DATA-->';

const LOADING_TITLE = '<title>Carregando…</title>';

/** Título e atributos vão para dentro de HTML: nada do conteúdo (que é
 *  digitado no editor) pode virar marcação. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** JSON dentro de `<script>`: um `</script>` no meio de um texto da landing
 *  fecharia a tag e executaria o resto como HTML. Escapado em unicode, o JSON
 *  continua válido e o navegador não vê marcação. */
export function jsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    // Os separadores de linha do Unicode (U+2028/2029) são válidos em JSON e
    // quebram um <script> — escritos por código para nenhuma normalização de
    // editor os apagar (mesma cicatriz do intervalo de acentos da landing).
    .replace(new RegExp(String.fromCharCode(0x2028), 'g'), '\\u2028')
    .replace(new RegExp(String.fromCharCode(0x2029), 'g'), '\\u2029');
}

interface RawBlock {
  type?: unknown;
  visible?: unknown;
  config?: { imageUrl?: unknown } | null;
}

/**
 * A imagem que vai ser o LCP: a capa do PRIMEIRO bloco de capa visível — a
 * mesma regra do bloco na tela (imagem escolhida no editor, senão a capa
 * redimensionada do imóvel, senão a original). Divergir daqui faria o
 * navegador pré-carregar uma foto e a página mostrar outra: duas fotos
 * baixadas, nenhuma mais cedo.
 */
export function lcpImageUrl(dto: PublicLandingDTO): string | null {
  const blocks = Array.isArray(dto.content_blocks) ? (dto.content_blocks as RawBlock[]) : [];
  const hero = blocks.find((b) => b && typeof b === 'object' && b.type === 'hero' && b.visible !== false);
  if (!hero) return null;
  const chosen = hero.config?.imageUrl;
  if (typeof chosen === 'string' && chosen) return chosen;
  const photos = dto.property?.photos ?? [];
  const cover = photos.find((p) => p.is_cover) ?? photos[0];
  if (!cover) return null;
  return cover.hero_url || cover.file_url || null;
}

export interface LandingInjection {
  tenant: string;
  slug: string;
  dto: PublicLandingDTO;
}

/** Costura o conteúdo no HTML da entrada enxuta. Sem o marcador, devolve o
 *  HTML como veio — nunca quebra a página por causa de um detalhe do HTML. */
export function injectLandingIntoHtml(html: string, { tenant, slug, dto }: LandingInjection): string {
  if (!html.includes(LANDING_DATA_MARKER)) return html;

  const parts: string[] = [];
  const image = lcpImageUrl(dto);
  if (image) {
    parts.push(`<link rel="preload" as="image" href="${escapeHtml(image)}" fetchpriority="high" />`);
  }
  parts.push(`<script>window.__lmLanding=${jsonForScript({ tenant, slug, data: dto })}</script>`);

  let out = html.replace(LANDING_DATA_MARKER, parts.join('\n    '));
  if (dto.title) out = out.replace(LOADING_TITLE, `<title>${escapeHtml(dto.title)}</title>`);
  return out;
}
