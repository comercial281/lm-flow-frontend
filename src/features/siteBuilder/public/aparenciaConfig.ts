// Aparência do site (sites.settings['appearance'], Meu site › Aparência, C3).
// Espelho do Sites::AppearanceConfig do servidor. O servidor já sanea; aqui o
// front só se protege de servidor velho (sem `appearance`) ou de lixo, caindo
// sempre no padrão de fábrica, que é o visual de antes do C3 sem nenhuma
// diferença: fundo claro, topo transparente sobre a capa, faixa de cima com
// telefone, e-mail e redes, capa de meia tela com o degradê de sempre e o
// rodapé em colunas com a frase de sempre.
import { obj } from './homeConfig';

export type Fundo = 'light' | 'dark';
export type EstiloDoTopo = 'transparent' | 'brand' | 'white';
export type FaixaDeCima = 'two_phones' | 'one_phone' | 'icons' | 'hidden';
export type AlturaDaCapa = 'full' | 'half';
export type LayoutDoRodape = 'columns' | 'compact';

export const FUNDOS: Fundo[] = ['light', 'dark'];
export const ESTILOS_DO_TOPO: EstiloDoTopo[] = ['transparent', 'brand', 'white'];
export const FAIXAS_DE_CIMA: FaixaDeCima[] = ['two_phones', 'one_phone', 'icons', 'hidden'];
export const ALTURAS_DA_CAPA: AlturaDaCapa[] = ['full', 'half'];
export const LAYOUTS_DO_RODAPE: LayoutDoRodape[] = ['columns', 'compact'];

export interface Aparencia {
  background: Fundo;
  header_style: EstiloDoTopo;
  /** Logo clara (http/https) pro topo transparente e na cor principal. */
  logo_light_url: string | null;
  top_bar: FaixaDeCima;
  hero_height: AlturaDaCapa;
  /** Força do filtro escuro da capa, de 0 a 80. Ver `filtroDaCapa`. */
  hero_overlay: number;
  footer_layout: LayoutDoRodape;
  /** Frase do rodapé (até 200). Nulo = a frase de fábrica. */
  footer_text: string | null;
}

export const FILTRO_FABRICA = 45;
export const FILTRO_MAXIMO = 80;
export const TETO_TEXTO_RODAPE = 200;
export const TEXTO_RODAPE_FABRICA = 'Seu portal de imóveis com atendimento de verdade.';

export const APARENCIA_FABRICA: Aparencia = {
  background: 'light',
  header_style: 'transparent',
  logo_light_url: null,
  top_bar: 'two_phones',
  hero_height: 'half',
  hero_overlay: FILTRO_FABRICA,
  footer_layout: 'columns',
  footer_text: null,
};

const umDe = <T extends string>(lista: T[], v: unknown, padrao: T): T =>
  (typeof v === 'string' && (lista as string[]).includes(v) ? v : padrao) as T;

const ehHttp = (v: unknown): v is string => typeof v === 'string' && /^https?:\/\/\S+$/i.test(v.trim());

export function resolverAparencia(raw: unknown): Aparencia {
  const r = obj(raw);
  const filtro = typeof r.hero_overlay === 'number' && Number.isFinite(r.hero_overlay)
    ? Math.round(Math.min(FILTRO_MAXIMO, Math.max(0, r.hero_overlay)))
    : FILTRO_FABRICA;
  const texto = typeof r.footer_text === 'string' ? r.footer_text.trim().slice(0, TETO_TEXTO_RODAPE) : '';
  return {
    background: umDe(FUNDOS, r.background, APARENCIA_FABRICA.background),
    header_style: umDe(ESTILOS_DO_TOPO, r.header_style, APARENCIA_FABRICA.header_style),
    logo_light_url: ehHttp(r.logo_light_url) ? r.logo_light_url.trim() : null,
    top_bar: umDe(FAIXAS_DE_CIMA, r.top_bar, APARENCIA_FABRICA.top_bar),
    hero_height: umDe(ALTURAS_DA_CAPA, r.hero_height, APARENCIA_FABRICA.hero_height),
    hero_overlay: filtro,
    footer_layout: umDe(LAYOUTS_DO_RODAPE, r.footer_layout, APARENCIA_FABRICA.footer_layout),
    footer_text: texto || null,
  };
}

/* ── Capa ──────────────────────────────────────────────────────────────────── */

/** O degradê de antes do C3, que o filtro de fábrica (45) reproduz letra a letra. */
export const DEGRADE_DA_CAPA_FABRICA = 'linear-gradient(180deg, rgba(23,20,15,0.35) 0%, rgba(23,20,15,0.55) 55%, var(--paper) 100%)';

const alfa = (n: number) => String(Number(Math.min(0.9, Math.max(0, n)).toFixed(3)));

/**
 * Filtro escuro sobre a foto da capa, combinado com o servidor
 * (Sites::AppearanceConfig, Task 7). Com a força `o` (0 a 80):
 * topo = (o − 10) / 100 e meio, aos 55%, = (o + 10) / 100, os dois presos
 * entre 0 e 0,9; o pé continua desbotando no fundo do site (`--paper`).
 * Assim 45 (fábrica) dá 0,35 e 0,55, exatamente o degradê de antes do C3
 * (a força é a média das duas paradas); 0 dá 0 e 0,1; 80 dá 0,7 e 0,9.
 */
export function filtroDaCapa(forca: number): string {
  const o = Math.min(FILTRO_MAXIMO, Math.max(0, Number.isFinite(forca) ? forca : FILTRO_FABRICA));
  if (o === FILTRO_FABRICA) return DEGRADE_DA_CAPA_FABRICA;
  return `linear-gradient(180deg, rgba(23,20,15,${alfa((o - 10) / 100)}) 0%, rgba(23,20,15,${alfa((o + 10) / 100)}) 55%, var(--paper) 100%)`;
}

/* ── Cores ─────────────────────────────────────────────────────────────────── */

/** Tinta escura fixa (não troca com o fundo): texto sobre cor clara. */
export const TINTA_ESCURA = '#17140F';

/**
 * Variáveis do fundo. `--site-card` é a caixa (cartão, formulário, rodapé;
 * o nome não é `--card` pra não cobrir o token do CRM) e `--solid` a faixa ou
 * botão escuro com texto branco ("Ver detalhes", a faixa de contato). No claro
 * os valores são os de antes do C3; `--solid` = o `--ink` de sempre.
 */
export const CORES_DO_FUNDO: Record<Fundo, { paper: string; ink: string; card: string; solid: string }> = {
  light: { paper: '#FAF7F2', ink: '#17140F', card: '#FFFFFF', solid: '#17140F' },
  dark: { paper: '#14110D', ink: '#F4EFE7', card: '#1E1A15', solid: '#332C25' },
};

/** Contraste mínimo (WCAG AA, texto normal) do texto na cor da marca. */
export const CONTRASTE_MINIMO = 4.5;

function rgbDe(cor: string): [number, number, number] | null {
  const h = cor.trim().replace(/^#/, '');
  const cheio = /^[0-9a-f]{3}$/i.test(h) ? h.split('').map(c => c + c).join('') : h;
  if (!/^[0-9a-f]{6}$/i.test(cheio)) return null;
  return [0, 2, 4].map(i => parseInt(cheio.slice(i, i + 2), 16)) as [number, number, number];
}

/** Luminância relativa (WCAG 2.x). */
function luminancia([r, g, b]: [number, number, number]): number {
  const c = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
}

const contraste = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/** Contraste WCAG entre duas cores hex; `null` se alguma não for hex. */
export function contrasteEntre(a: string, b: string): number | null {
  const ra = rgbDe(a); const rb = rgbDe(b);
  return ra && rb ? contraste(luminancia(ra), luminancia(rb)) : null;
}

const hex = (rgb: number[]) => `#${rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()}`;

/**
 * A cor clareada (misturada com branco, de 2 em 2%) até dar `minimo` de
 * contraste sobre `fundo`. Usada no texto na cor da marca do fundo escuro
 * (`--brand-text`): uma marca azul-marinho ou roxa some sobre o quase preto.
 * Cor que já dá o contraste volta como está; cor que não é hex vira a tinta
 * clara do fundo escuro.
 */
export function clarearAte(cor: string, fundo: string, minimo = CONTRASTE_MINIMO): string {
  const rgb = rgbDe(cor);
  if (!rgb || !rgbDe(fundo)) return CORES_DO_FUNDO.dark.ink;
  for (let t = 0; t <= 1.0001; t += 0.02) {
    const c = hex(rgb.map(v => v + (255 - v) * t));
    if ((contrasteEntre(c, fundo) ?? 0) >= minimo) return t === 0 ? cor : c;
  }
  return '#FFFFFF';
}

/**
 * Cor do texto sobre uma cor de fundo (selo na cor de destaque, topo na cor
 * principal): branco ou a tinta escura, a que tiver mais contraste. Cor que
 * não é hexadecimal fica com branco, como sempre foi.
 */
export function textoSobre(cor: string | null | undefined): '#FFFFFF' | typeof TINTA_ESCURA {
  const rgb = cor ? rgbDe(cor) : null;
  if (!rgb) return '#FFFFFF';
  const l = luminancia(rgb);
  return contraste(1, l) >= contraste(luminancia(rgbDe(TINTA_ESCURA)!), l) ? '#FFFFFF' : TINTA_ESCURA;
}

/* ── Fontes ────────────────────────────────────────────────────────────────── */

/** As fontes que o Meu site oferece (Aparência). Todas do Google Fonts. */
export const FONTES_DO_SITE = [
  'Inter', 'Space Grotesk', 'Lato', 'Poppins', 'Montserrat', 'Roboto',
  'DM Sans', 'Playfair Display', 'Nunito', 'Raleway',
];

/** Fontes com serifa: a reserva enquanto ela carrega também tem serifa. */
const COM_SERIFA = new Set(['Playfair Display']);

/** Pilha de fontes e o endereço do Google Fonts (pesos 400 a 700, todas as 10 têm). */
export function fonteDoSite(fontFamily?: string | null): { font: string; fontStack: string; fontHref: string } {
  const font = fontFamily || 'Inter';
  const principal = font.split(',')[0].trim();
  const reserva = COM_SERIFA.has(principal) ? 'Georgia, serif' : 'system-ui, sans-serif';
  const fontStack = font.includes(',') ? font : `${font}, ${reserva}`;
  const fontHref = `https://fonts.googleapis.com/css2?family=${principal.replace(/ /g, '+')}:wght@400;500;600;700&display=swap`;
  return { font, fontStack, fontHref };
}

/* ── Logo ──────────────────────────────────────────────────────────────────── */

/** O que fica atrás da logo: a foto da capa, a cor principal, branco ou o fundo do site. */
export type Superficie = 'foto' | 'marca' | 'branco' | 'fundo';

/**
 * Qual logo vai numa superfície. A clara entra onde o fundo atrás dela é
 * escuro: o topo transparente sobre a capa, o topo na cor principal quando
 * ela é escura (o texto do topo sai branco: `textoSobre(brand)`) e, no fundo
 * escuro, o topo sólido e o rodapé. Sem logo clara, a normal. `clara` diz se
 * a logo clara foi usada (a foto da capa sem logo clara continua deixando a
 * normal branca, como sempre).
 */
export function logoNaSuperficie(
  logo: string | null | undefined, ap: Aparencia, superficie: Superficie, brand?: string | null,
): { url: string | null; clara: boolean } {
  const marcaEscura = superficie === 'marca' && textoSobre(brand) === '#FFFFFF';
  const pedeClara = superficie === 'foto' || marcaEscura || (superficie === 'fundo' && ap.background === 'dark');
  if (pedeClara && ap.logo_light_url) return { url: ap.logo_light_url, clara: true };
  return { url: logo || null, clara: false };
}
