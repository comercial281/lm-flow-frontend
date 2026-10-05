import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { fetchAllPortalProperties } from './portalProperties';
import { imovelHref } from './finalidade';
import { ehAba, itensDoMenu, menuPersonalizado, NOME_DE_FABRICA, type LinkDoMenu } from '@/features/siteBuilder/public/menuConfig';
import { caminhoDoSite, type CtxDoSite } from '@/features/siteBuilder/public/dominioDoSite';
import { useCtxDoSite } from '@/features/siteBuilder/public/useTenantDoSite';
import { cabecalhosDoSite, ehPrevia } from '@/features/siteBuilder/public/previa';
import PortalTranslate from './PortalTranslate';
import { tituloDaAba } from '@/features/siteBuilder/public/tituloDaAba';
import { filterProperties, opcoesSemRepetir, type PortalFilters, type PortalProperty, type PortalTab } from '@/features/siteBuilder/public/filtros';
import { ROTULO_TIPO, rotuloTipo } from '@/features/siteBuilder/public/tiposDeImovel';
import { resolverHome, type AbaId } from '@/features/siteBuilder/public/homeConfig';
import { abasVisiveis } from '@/features/siteBuilder/public/vitrines';
import { seloDaFase } from '@/features/properties/listingKind';
import { ORDENS, ROTULO_ORDEM, ehOrdem, type Ordem } from '@/features/siteBuilder/public/listaConfig';
import {
  CORES_DO_FUNDO, TEXTO_RODAPE_FABRICA, clarearAte, fonteDoSite, logoNaSuperficie, resolverAparencia, textoSobre,
  type Aparencia, type Superficie,
} from '@/features/siteBuilder/public/aparenciaConfig';

// Tipos e filtro moram em filtros.ts (sem ciclo com vitrines.ts); reexportados aqui.
export { filterProperties };
export type { PortalFilters, PortalProperty, PortalTab };

/* ────────────────────────────────────────────────────────────────────────────
   Portal Imobiliário — peças compartilhadas (Produto A do LM Flow)
   Tipos, utilitários, ícones, componentes e o hook de dados usados tanto pela
   home (PortalHomePage) quanto pela página dedicada de busca (PortalSearchPage).
   TUDO é dirigido pelos tokens de marca do cliente (logo, cores, fonte,
   WhatsApp). Zero marca hardcoded.
──────────────────────────────────────────────────────────────────────────── */

/* ── Tipos ───────────────────────────────────────────────────────────────── */
export interface Branding {
  logo_url?: string | null;
  /** Ícone da aba do navegador (Meu site › Aparência). */
  favicon_url?: string | null;
  primary_color?: string | null;
  accent_color?: string | null;
  font_family?: string | null;
}
/** Banco na página de financiamento. O servidor só manda os que têm link. */
export interface PortalBank {
  key: string;
  name: string;
  color: string;
  ink?: string | null;
  url?: string | null;
  logo_url?: string | null;
}
export interface PortalFinancing {
  enabled?: boolean;
  title?: string;
  intro?: string;
  footer?: string;
  banks?: PortalBank[];
}
export interface PortalListing {
  enabled?: boolean;
  title?: string;
  intro?: string;
  whatsapp_text?: string;
  thanks_title?: string;
  thanks_text?: string;
  /* Os e-mails de destino NÃO chegam aqui, de propósito: o endereço do portal é
     aberto e servi-los entregaria o e-mail do dono a qualquer robô coletor. */
}
export interface SiteInfo {
  /**
   * Site em manutenção (Meu site › Endereço do site, caixas Ativo/Publicado).
   * Só `true` conta: servidor antigo, sem o campo, é site no ar. Em manutenção o
   * servidor manda só nome, marca, contato e título; as listas dão 404.
   */
  maintenance?: boolean;
  /**
   * Prévia antes de publicar: o servidor aceitou o token do `?previa=`
   * (`X-Site-Preview`) e mandou o site inteiro. Só `true` conta.
   */
  preview?: boolean;
  /** Domínio próprio ATIVO do site, ou null. */
  domain?: string | null;
  /** Caixinha "Aparecer no Google". Ausente (servidor velho) = desligada. */
  google?: { indexable?: boolean | null } | null;
  name?: string;
  branding?: Branding;
  /** Banner da home: vídeo tem prioridade; sem os dois, a capa do primeiro imóvel. */
  hero?: { video_url?: string | null; image_url?: string | null };
  sections?: { stats?: boolean; lead_capture?: boolean };
  contact?: { whatsapp?: string | null; phone?: string | null; email?: string | null; address?: string | null };
  social_links?: Record<string, string> | null;
  seo?: { title?: string | null; description?: string | null };
  /** Página *Simule seu financiamento* (Site Builder). Ausente = desligada. */
  financiamento?: PortalFinancing | null;
  /** Página *Anuncie seu imóvel* (Site Builder). Ausente = desligada. */
  anuncie?: PortalListing | null;
  tracking?: { gtm_id?: string | null; ga4?: string | null; facebook_pixel?: string | null } | null;
  custom_code?: { head?: string | null; body?: string | null } | null;
  translate?: { enabled?: boolean; languages?: string[] } | null;
  /** Lista ANTIGA das páginas no menu (ativas e no menu). O site no ar lê como lista: não mudar. */
  menu?: { title: string; slug: string }[] | null;
  /** Menu configurável (settings.menu, C3). Ler sempre por `resolverMenu`/`itensDoMenu`. Não vem em manutenção. */
  menu_config?: unknown;
  /** Configuração da página inicial (settings.home). Ler sempre por `resolverHome`. */
  home?: unknown;
  /** Página do imóvel (settings.property_page, sem os e-mails). Ler sempre por `resolverFicha`. */
  property_page?: unknown;
  /** Lista de imóveis (settings.listing). Ler sempre por `resolverLista`. */
  listing?: unknown;
  /** Aparência (settings.appearance, C3). Ler sempre por `resolverAparencia`. Vem também em manutenção. */
  appearance?: unknown;
}
/* Artigo do blog público (item da listagem). */
export interface PortalArticleSummary {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  cover_image_url?: string | null;
  published_at?: string | null;
  reading_time_minutes?: number | null;
  views_count?: number | null;
  category_id?: number | null;
}
/* Artigo completo (detalhe) — inclui o corpo em HTML já renderizado. */
export type PortalArticleFull = PortalArticleSummary & { body_html?: string | null };

export const API = import.meta.env.VITE_API_URL as string;

export const PROPERTY_TYPE_LABEL = ROTULO_TIPO;

export function onlyDigits(s?: string | null) { return (s || '').replace(/\D/g, ''); }

/* ── SVG icons (inline, sem dependência) ─────────────────────────────────── */
export const I = {
  bed: 'M2 17v-5a2 2 0 0 1 2-2h11a3 3 0 0 1 3 3v4M2 21v-4M22 21v-6M2 12V7m4 3V8a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v2',
  bath: 'M4 12V5a2 2 0 0 1 2-2h1a2 2 0 0 1 2 2M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-3ZM6 21l-1 1M18 21l1 1',
  car: 'M5 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM17 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM5 15h12M3 15l1.5-5A2 2 0 0 1 6.4 8.6h9.2a2 2 0 0 1 1.9 1.4L19 15',
  ruler: 'M3 3h4v4M3 3l7 7M21 21h-4v-4M21 21l-7-7M3 21v-4M3 21h4M21 3h-4M21 3v4',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3',
  pin: 'M12 21s7-6.4 7-11a7 7 0 1 0-14 0c0 4.6 7 11 7 11ZM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  wa: 'M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.3A10 10 0 1 0 12 2Zm5.5 14.2c-.2.6-1.2 1.2-1.7 1.2-.9.1-1 .4-3.6-.9-2.6-1.4-4.1-4.1-4.2-4.3-.1-.2-1-1.3-1-2.5s.6-1.8.9-2c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6c-.2.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2 1.3 2.3 1.5.2.1.4.1.5-.1l.7-.8c.2-.2.4-.2.6-.1l1.9.9c.3.1.4.2.5.3.1.2.1.7-.1 1.3Z',
  menu: 'M3 6h18M3 12h18M3 18h18', close: 'M6 6l12 12M18 6L6 18',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.4 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z',
  mail: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm18 2-10 7L2 6',
  bank: 'M3 21h18M4 10h16M5 10V7l7-4 7 4v3M6 10v8M10 10v8M14 10v8M18 10v8',
  sign: 'M4 3v18M4 5h13l-2.5 3L17 11H4',
  chat: 'M7.9 20A9 9 0 1 0 4 16.1L2 22ZM8 12h.01M12 12h.01M16 12h.01',
  link: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7',
  page: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8ZM14 2v6h6M16 13H8M16 17H8M10 9H8',
  /* Redes (faixa de cima "só ícones"). */
  instagram: 'M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5ZM16 11.4A4 4 0 1 1 12.6 8a4 4 0 0 1 3.4 3.4ZM17.5 6.5h.01',
  facebook: 'M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3Z',
  youtube: 'M2.5 17a24.1 24.1 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.6 49.6 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.1 24.1 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.6 49.6 0 0 1-16.2 0A2 2 0 0 1 2.5 17ZM10 15l5-3-5-3Z',
  linkedin: 'M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6ZM2 9h4v12H2ZM4 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  tiktok: 'M9 12a4 4 0 1 0 4 4V2a5 5 0 0 0 5 5',
};
export function Ic({ d, s = 18, cls = '' }: { d: string; s?: number; cls?: string }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className={cls}><path d={d} /></svg>;
}

/**
 * Site em manutenção? Só `maintenance === true` (servidor antigo, sem o campo,
 * está no ar). Na prévia o dono vê o site como se estivesse publicado.
 */
export function estaEmManutencao(site: SiteInfo | null | undefined): boolean {
  return site?.maintenance === true && !ehPrevia(site);
}

/**
 * `robots` do site no navegador. `index,follow` só com "Aparecer no Google"
 * ligado, o site no ar e fora da prévia; o resto, `noindex`. É a mesma regra
 * que o servidor usa no `<head>` montado pelo middleware: o site nunca troca o
 * `noindex` dele por `index` depois de carregar.
 */
export function robotsDoSite(site: SiteInfo | null | undefined): 'index,follow' | 'noindex' {
  if (!site || ehPrevia(site) || site.maintenance === true) return 'noindex';
  return site.google?.indexable === true ? 'index,follow' : 'noindex';
}

/** Põe o `robots` do site no `<head>` (cria a tag se não houver). */
export function aplicarRobots(site: SiteInfo | null | undefined, doc: Document = document): void {
  const meta = doc.head.querySelector<HTMLMetaElement>('meta[name="robots"]') || (() => {
    const m = doc.createElement('meta'); m.name = 'robots'; doc.head.appendChild(m); return m;
  })();
  meta.content = robotsDoSite(site);
}

/**
 * Cores, fonte e variáveis CSS do site (logo, cores, fonte e aparência do Meu
 * site). `--ink`/`--paper` seguem o fundo (claro = os de sempre); `--site-card`
 * é a caixa e `--solid` a faixa ou botão escuro com texto branco. `--accent-ink`
 * e `--brand-ink` são o texto (branco ou escuro) que dá contraste NA cor.
 * `--brand-text` é o texto escrito na cor da marca: no claro, a própria
 * `--brand`; no escuro, a marca clareada até 4,5:1 sobre a caixa escura (que é
 * mais clara que o fundo, então vale pros dois).
 *
 * `fundo` vai no `data-fundo` da raiz da página: só sai no fundo escuro (no
 * claro o atributo nem existe) e é ele que liga o bloco "Meu site · fundo
 * escuro" do globals.css, que troca as caixas brancas e os cinzas fixos.
 */
export function tokensDoSite(site: SiteInfo) {
  const aparencia = resolverAparencia(site.appearance);
  const brand = site.branding?.primary_color || '#0E7C5A';
  const accent = site.branding?.accent_color || brand;
  const { font, fontStack, fontHref } = fonteDoSite(site.branding?.font_family);
  const cores = CORES_DO_FUNDO[aparencia.background];
  const cssVars = {
    ['--brand' as string]: brand,
    ['--accent' as string]: accent,
    ['--ink' as string]: cores.ink,
    ['--paper' as string]: cores.paper,
    ['--site-card' as string]: cores.card,
    ['--solid' as string]: cores.solid,
    ['--accent-ink' as string]: textoSobre(accent),
    ['--brand-ink' as string]: textoSobre(brand),
    ['--brand-text' as string]: aparencia.background === 'dark' ? clarearAte(brand, cores.card) : brand,
    ['--display' as string]: fontStack,
    fontFamily: fontStack,
  } as CSSProperties;
  const fundo = aparencia.background === 'dark' ? 'escuro' as const : undefined;
  return { brand, accent, font, fontStack, fontHref, cssVars, fundo, aparencia };
}

/** Link do botão verde do WhatsApp (o número vem gravado só com dígitos e o 55). */
export function linkDoWhatsApp(wa?: string | null): string | null {
  return wa ? `https://wa.me/${onlyDigits(wa)}` : null;
}

/* ── Hook de dados do portal (site + imóveis + tokens derivados) ──────────── */
export function usePortalData(tenant?: string) {
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [site, setSite] = useState<SiteInfo>({});
  const [items, setItems] = useState<PortalProperty[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!tenant) return;
      try {
        // O catálogo vem INTEIRO (todas as páginas), nunca uma página só: o
        // portal filtra no navegador e monta cidade/bairro do que carregou.
        // Ver portalProperties.ts — foi uma página de 60 que fez um cliente
        // com 390 imóveis publicados ver 60 no site.
        //
        // Em manutenção a lista dá 404 (vira lista vazia) e o site vem reduzido:
        // a página de manutenção não depende da lista, então nem uma falha dela
        // derruba a página. Fora da manutenção, falha da lista segue sendo erro.
        const [siteRes, propsJson] = await Promise.all([
          fetch(`${API}/api/public/v1/site`, { headers: cabecalhosDoSite(tenant) }),
          fetchAllPortalProperties(API, tenant).catch(() => null),
        ]);
        if (!active) return;
        const siteJson = siteRes.ok ? ((await siteRes.json()).data as SiteInfo) : {};
        if (propsJson === null && !estaEmManutencao(siteJson)) throw new Error('catálogo indisponível');
        setSite(siteJson || {});
        setItems(propsJson || []);
        document.title = tituloDaAba(siteJson?.seo?.title, siteJson?.name);
        aplicarRobots(siteJson);
        setState('ok');
      } catch {
        if (active) setState('error');
      }
    })();
    return () => { active = false; };
  }, [tenant]);

  const { brand, accent, font, fontStack, fontHref, cssVars, fundo } = useMemo(() => tokensDoSite(site), [site]);
  const wa = site.contact?.whatsapp;
  const manutencao = estaEmManutencao(site);

  // Uma opção por cidade/bairro, mesmo com grafias diferentes no cadastro.
  const cities = useMemo(() => opcoesSemRepetir(items.map(i => i.address?.city)), [items]);
  const hoods = useMemo(() => opcoesSemRepetir(items.map(i => i.address?.neighborhood)), [items]);
  const types = useMemo(() => [...new Set(items.map(i => i.property_type).filter(Boolean))], [items]);
  // Página inicial (Personalizar) e as abas que existem de verdade: aba ligada
  // sem imóvel some da capa, do topo e do rodapé.
  const home = useMemo(() => resolverHome(site.home), [site]);
  const abas = useMemo(() => abasVisiveis(home, items), [home, items]);

  return { state, site, items, brand, accent, font, fontStack, fontHref, wa, cities, hoods, types, home, abas, cssVars, fundo, manutencao };
}

/* ── Blog: fetch de artigos (mesmo padrão público, header X-Tenant) ───────── */
export async function fetchArticles(
  tenant: string, page = 1, perPage = 12,
): Promise<{ data: PortalArticleSummary[]; total: number }> {
  const res = await fetch(
    `${API}/api/public/v1/site/articles?page=${page}&per_page=${perPage}`,
    { headers: cabecalhosDoSite(tenant) },
  );
  if (!res.ok) return { data: [], total: 0 };
  const json = await res.json();
  return { data: (json.data as PortalArticleSummary[]) || [], total: json.meta?.total ?? 0 };
}

export async function fetchArticle(tenant: string, slug: string): Promise<PortalArticleFull | null> {
  const res = await fetch(
    `${API}/api/public/v1/site/articles/${encodeURIComponent(slug)}`,
    { headers: cabecalhosDoSite(tenant) },
  );
  if (!res.ok) return null;
  const json = await res.json();
  return (json.data as PortalArticleFull) || null;
}

/**
 * Checagem leve p/ decidir se o link "Blog" aparece no menu: só há blog se
 * existe ao menos um artigo publicado. Uma requisição por montagem do header.
 */
export function usePublishedArticlesExist(tenant?: string): boolean {
  const [exists, setExists] = useState(false);
  useEffect(() => {
    let active = true;
    if (!tenant) return;
    fetchArticles(tenant, 1, 1)
      .then(r => { if (active) setExists(r.total > 0); })
      .catch(() => { /* silencioso: na dúvida, não mostra o link */ });
    return () => { active = false; };
  }, [tenant]);
  return exists;
}

/* ── Card de imóvel ──────────────────────────────────────────────────────── */
interface PropsDoCartao { tenant: string; p: PortalProperty; wa?: string | null; tab?: PortalTab }

/** O que o cartão e a linha mostram: os dois formatos dizem a mesma coisa. */
function dadosDoCartao({ p, wa, tab }: PropsDoCartao, ctx: CtxDoSite) {
  // Empreendimento mostra a fase (e a entrega) no lugar de "Destaque" e, se for
  // exclusivo, os dois selos. Na revenda Exclusivo vence Destaque.
  const dev = p.listing_kind === 'development';
  const selos = [
    dev ? { texto: seloDaFase(p.stage ?? 'ready', p.delivery_forecast), tipo: 'fase' as const } : null,
    p.exclusive ? { texto: 'Exclusivo', tipo: 'destaque' as const } : null,
    !dev && !p.exclusive && p.featured ? { texto: 'Destaque', tipo: 'destaque' as const } : null,
  ].filter((x): x is SeloDoCartao => !!x);
  return {
    s: p.icon_summary ?? {},
    selos,
    typeLabel: rotuloTipo(p.property_type),
    local: [p.address?.neighborhood, p.address?.city].filter(Boolean).join(', '),
    waLink: wa ? `https://wa.me/${onlyDigits(wa)}?text=${encodeURIComponent(`Olá! Tenho interesse no imóvel ${p.code} (${p.title}).`)}` : null,
    href: imovelHref(ctx, p.code, tab),
  };
}

/**
 * Selo na foto do cartão. `destaque` (Destaque, Exclusivo) vai na cor de
 * destaque da Aparência; `fase` (a do empreendimento) segue na cor principal.
 */
interface SeloDoCartao { texto: string; tipo: 'fase' | 'destaque' }

/** Estilo do selo na cor de destaque, com o texto branco ou escuro pelo contraste. */
export const ESTILO_SELO_DESTAQUE: CSSProperties = { background: 'var(--accent)', color: 'var(--accent-ink)' };

function SelosNaFoto({ selos }: { selos: SeloDoCartao[] }) {
  if (selos.length === 0) return null;
  return (
    <div className="pointer-events-none absolute left-3 right-3 top-3 flex flex-wrap gap-1.5">
      {selos.map(selo => selo.tipo === 'destaque' ? (
        <span key={selo.texto} className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide" style={ESTILO_SELO_DESTAQUE}>
          {selo.texto}
        </span>
      ) : (
        <span key={selo.texto} className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white" style={{ background: 'var(--brand)' }}>
          {selo.texto}
        </span>
      ))}
    </div>
  );
}

function IconesDoImovel({ s }: { s: NonNullable<PortalProperty['icon_summary']> }) {
  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-neutral-600">
      {!!s.bedrooms && <span className="inline-flex items-center gap-1.5"><Ic d={I.bed} s={15} /> {s.bedrooms}</span>}
      {!!s.suites && <span className="inline-flex items-center gap-1.5"><Ic d={I.bath} s={15} /> {s.suites} suíte{s.suites > 1 ? 's' : ''}</span>}
      {!!s.parking && <span className="inline-flex items-center gap-1.5"><Ic d={I.car} s={15} /> {s.parking}</span>}
      {!!s.useful_area_m2 && <span className="inline-flex items-center gap-1.5"><Ic d={I.ruler} s={15} /> {s.useful_area_m2} m²</span>}
    </div>
  );
}

function BotoesDoCartao({ href, waLink, titulo }: { href: string; waLink: string | null; titulo: string }) {
  return (
    <>
      <Link to={href} aria-label={`Ver detalhes de ${titulo}`} className="flex-1 rounded-full px-3 py-2 text-center text-[13px] font-semibold text-white transition-opacity hover:opacity-90" style={{ background: 'var(--solid)' }}>
        Ver detalhes
      </Link>
      {waLink && (
        <a href={waLink} target="_blank" rel="noreferrer" aria-label="Falar no WhatsApp" title="Falar no WhatsApp" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white transition-transform hover:scale-105">
          <Ic d={I.wa} s={18} />
        </a>
      )}
    </>
  );
}

export function PropertyCard(props: PropsDoCartao) {
  const { p } = props;
  const ctx = useCtxDoSite(props.tenant);
  const { s, selos, typeLabel, local, waLink, href } = dadosDoCartao(props, ctx);

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-[20px] bg-white ring-1 ring-black/[0.06] shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_-16px_rgba(0,0,0,0.25)]">
      {/* A foto é um atalho de mouse pro mesmo endereço de "Ver detalhes": fora do Tab e
          do leitor de tela, que já têm o título e o botão. Selos e preço ficam por cima
          da foto, FORA do link escondido, pra continuarem sendo lidos; o clique neles
          passa pro link (pointer-events-none). */}
      <div className="relative">
        <Link to={href} tabIndex={-1} aria-hidden className="relative block aspect-[4/3] overflow-hidden bg-neutral-100">
          {p.cover_url ? (
            <img src={p.cover_url} alt={p.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.06]" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-neutral-300">
              <Ic d={I.pin} s={40} />
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
        </Link>
        <SelosNaFoto selos={selos} />
        {p.display_price && (
          <span className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-white/95 px-3.5 py-1.5 text-[15px] font-bold text-[var(--ink)] shadow-sm backdrop-blur">
            {p.display_price}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--brand)]">{typeLabel}</span>
        <Link to={href} className="mt-1">
          <h3 className="font-[var(--display)] text-[17px] leading-snug text-[var(--ink)] line-clamp-2 transition-colors group-hover:text-[var(--brand)]">{p.title}</h3>
        </Link>
        {local && (
          <p className="mt-1 flex items-center gap-1 text-[13px] text-neutral-500">
            <Ic d={I.pin} s={13} /> {local}
          </p>
        )}

        <IconesDoImovel s={s} />

        <div className="mt-4 flex items-center gap-2 border-t border-black/[0.06] pt-3">
          <BotoesDoCartao href={href} waLink={waLink} titulo={p.title} />
        </div>
      </div>
    </article>
  );
}

/**
 * Linha larga da lista (Meu site › Lista de imóveis › cartões em linhas). Mesmo
 * conteúdo do cartão: foto com os selos à esquerda (~280 px), dados no meio e
 * preço com os botões ao lado. No celular empilha (foto em cima); no tablet o
 * preço desce pra baixo dos dados. Cores sempre do site (--brand, --ink).
 */
export function PropertyRow(props: PropsDoCartao) {
  const { p } = props;
  const ctx = useCtxDoSite(props.tenant);
  const { s, selos, typeLabel, local, waLink, href } = dadosDoCartao(props, ctx);

  return (
    <article className="group grid overflow-hidden rounded-[20px] bg-white ring-1 ring-black/[0.06] shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-shadow duration-300 hover:shadow-[0_20px_40px_-16px_rgba(0,0,0,0.25)] sm:grid-cols-[240px_minmax(0,1fr)] lg:grid-cols-[280px_minmax(0,1fr)_220px]">
      {/* Foto como no cartão: link só de mouse, selos por cima e fora dele. */}
      <div className="relative aspect-[4/3] overflow-hidden bg-neutral-100 sm:row-span-2 sm:aspect-auto sm:min-h-[200px] lg:row-span-1">
        <Link to={href} tabIndex={-1} aria-hidden className="absolute inset-0 block">
          {p.cover_url ? (
            <img src={p.cover_url} alt={p.title} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.06]" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-neutral-300">
              <Ic d={I.pin} s={40} />
            </div>
          )}
        </Link>
        <SelosNaFoto selos={selos} />
      </div>

      <div className="flex min-w-0 flex-col p-4 sm:p-5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--brand)]">{typeLabel}</span>
        <Link to={href} className="mt-1">
          <h3 className="font-[var(--display)] text-[18px] leading-snug text-[var(--ink)] line-clamp-2 transition-colors group-hover:text-[var(--brand)]">{p.title}</h3>
        </Link>
        {local && (
          <p className="mt-1 flex items-center gap-1 text-[13px] text-neutral-500">
            <Ic d={I.pin} s={13} /> {local}
          </p>
        )}
        <IconesDoImovel s={s} />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-black/[0.06] bg-[var(--paper)] px-4 py-3 sm:col-start-2 sm:px-5 lg:col-start-3 lg:row-start-1 lg:flex-col lg:flex-nowrap lg:items-stretch lg:justify-center lg:border-l lg:border-t-0">
        {p.display_price && (
          <span className="text-[19px] font-bold leading-tight text-[var(--ink)] lg:text-[20px]">{p.display_price}</span>
        )}
        <div className="flex flex-1 items-center gap-2 sm:ml-auto sm:max-w-[280px] lg:ml-0 lg:max-w-none lg:flex-none">
          <BotoesDoCartao href={href} waLink={waLink} titulo={p.title} />
        </div>
      </div>
    </article>
  );
}

/**
 * "Ordenar por" da busca: `<select>` nativo, como os filtros do site público.
 * Mora aqui (e não na página de busca) porque este arquivo é a exceção da lista
 * nativa no conferir-padrao: o portal público é outro público, com outro visual.
 */
export function OrdenarPor({ valor, onChange }: { valor: Ordem; onChange: (v: Ordem) => void }) {
  return (
    <label className="flex items-center gap-2 text-[13px] text-neutral-500">
      <span className="shrink-0">Ordenar por</span>
      <span className="relative">
        <select value={valor} onChange={e => { if (ehOrdem(e.target.value)) onChange(e.target.value); }}
          className="appearance-none rounded-full border border-black/[0.08] bg-white py-2 pl-3.5 pr-8 text-[13px] font-semibold text-[var(--ink)] outline-none focus:border-[var(--brand)] focus-visible:ring-2 focus-visible:ring-[var(--brand)]/40">
          {ORDENS.map(o => <option key={o} value={o}>{ROTULO_ORDEM[o]}</option>)}
        </select>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
        </span>
      </span>
    </label>
  );
}

/* ── Select e Stat ───────────────────────────────────────────────────────── */
export function Select({ value, onChange, label, options }: { value: string; onChange: (v: string) => void; label: string; options: [string, string][] }) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full appearance-none rounded-xl border border-black/[0.08] bg-white px-3.5 py-3 text-[14px] text-[var(--ink)] outline-none focus:border-[var(--brand)]">
        <option value="">{label}</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
      </span>
    </div>
  );
}
export function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div>
      <div className="font-[var(--display)] text-3xl font-semibold text-[var(--brand)] sm:text-4xl">{n}</div>
      <div className="mt-1 text-[13px] text-neutral-500">{label}</div>
    </div>
  );
}

/* ── Header compartilhado (menu do topo funcional) ───────────────────────── */
/* Os links do topo (e do rodapé, depois que o cliente mexe no menu) saem de
   `itensDoMenu` (menuConfig.ts): ordem, nome e liga/desliga da tela Menus, e
   some sozinho o item sem destino (aba sem imóvel, seção ou página desligada,
   blog sem artigo). */

/** As redes cadastradas no Site Builder, na ordem em que saem na barra fina. */
const SOCIAL_ORDER = ['instagram', 'facebook', 'youtube', 'linkedin', 'tiktok'] as const;
const SOCIAL_LABEL: Record<string, string> = {
  instagram: 'Instagram', facebook: 'Facebook', youtube: 'YouTube',
  linkedin: 'LinkedIn', tiktok: 'TikTok',
};
export function socialEntries(site: SiteInfo): { key: string; label: string; url: string }[] {
  const links = site.social_links || {};
  const known = SOCIAL_ORDER.filter(k => (links[k] || '').trim());
  const rest = Object.keys(links).filter(k => !SOCIAL_ORDER.includes(k as typeof SOCIAL_ORDER[number]) && (links[k] || '').trim());
  return [...known, ...rest].map(k => ({
    key: k,
    label: SOCIAL_LABEL[k] || k.charAt(0).toUpperCase() + k.slice(1),
    url: links[k].trim(),
  }));
}

/** Ícone de cada rede na faixa de cima "só ícones"; rede sem ícone próprio usa o de link. */
const ICONE_DA_REDE: Record<string, string> = {
  instagram: I.instagram, facebook: I.facebook, youtube: I.youtube, linkedin: I.linkedin, tiktok: I.tiktok,
};

/**
 * Barra fina acima do cabeçalho: telefone, e-mail e redes. Eles já eram
 * cadastrados no Site Builder e não apareciam em LUGAR NENHUM do site. Ela só
 * se desenha quando há o que mostrar — faixa vazia é pior que faixa nenhuma.
 *
 * Modos (Meu site › Aparência › Faixa de cima, `appearance.top_bar`):
 * - `two_phones` (fábrica): telefone, e-mail e redes pelo nome, a de sempre;
 * - `one_phone`: só um contato, o telefone (sem telefone, o e-mail), e as redes;
 * - `icons`: telefone, e-mail e redes só pelo ícone (o nome fica na dica e no leitor de tela);
 * - `hidden`: sem a faixa.
 *
 * ⚠️ Ela é do TOPO DA PÁGINA e rola para fora com o conteúdo: quem a desenhar
 * dentro do bloco que gruda no topo devolve o defeito de 17/09 — telefone e
 * e-mail numa faixa escura presa na tela durante a rolagem inteira.
 */
function PortalTopBar({ site, ap }: { site: SiteInfo; ap: Aparencia }) {
  const modo = ap.top_bar;
  const phone = site.contact?.phone?.trim();
  const emailCadastrado = site.contact?.email?.trim();
  const email = modo === 'one_phone' && phone ? undefined : emailCadastrado;
  const socials = socialEntries(site);
  if (modo === 'hidden' || (!phone && !email && socials.length === 0)) return null;
  const soIcones = modo === 'icons';
  const dica = (rotulo: string) => (soIcones ? { 'aria-label': rotulo, title: rotulo } : {});

  return (
    <div className="hidden border-b border-white/10 bg-[var(--ink)] text-white/75 sm:block">
      <div className="mx-auto flex h-9 max-w-6xl items-center justify-between gap-6 px-4 text-[12.5px] sm:px-6">
        <div className="flex items-center gap-5">
          {phone && (
            <a href={`tel:${onlyDigits(phone)}`} className="inline-flex items-center gap-1.5 transition-colors hover:text-white" {...dica(`Ligar para ${phone}`)}>
              <Ic d={I.phone} s={13} />{soIcones ? null : <> {phone}</>}
            </a>
          )}
          {email && (
            <a href={`mailto:${email}`} className="inline-flex items-center gap-1.5 transition-colors hover:text-white" {...dica(`E-mail: ${email}`)}>
              <Ic d={I.mail} s={13} />{soIcones ? null : <> {email}</>}
            </a>
          )}
        </div>
        {socials.length > 0 && (
          <div className="flex items-center gap-4">
            {socials.map(sn => (
              <a key={sn.key} href={sn.url} target="_blank" rel="noreferrer" className="transition-colors hover:text-white" {...dica(sn.label)}>
                {soIcones ? <Ic d={ICONE_DA_REDE[sn.key] ?? I.link} s={14} /> : sn.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Abas (Comprar/Alugar/Lançamentos) que a página mostra; sem `abas`, as três. */
const ABAS_DO_RODAPE: AbaId[] = ['sale', 'rent', 'launch'];
const abaVisivel = (abas?: AbaId[]) => (aba: AbaId) => !abas || abas.includes(aba);

/**
 * Um link do menu, no topo ou no rodapé: página do site pelo roteador, seção
 * da home por âncora simples e endereço de fora em outra aba.
 */
function LinkDoMenuEl({ l, cls, onClick }: { l: LinkDoMenu; cls?: string; onClick?: () => void }) {
  if (l.externo) return <a href={l.href} target="_blank" rel="noopener noreferrer" onClick={onClick} className={cls}>{l.rotulo}</a>;
  if (l.ancora) return <a href={l.href} onClick={onClick} className={cls}>{l.rotulo}</a>;
  return <Link to={l.href} onClick={onClick} className={cls}>{l.rotulo}</Link>;
}

interface PropsDaMoldura { site: SiteInfo; tenant: string; onHome?: boolean; abas?: AbaId[] }

/** Logo (a normal ou a clara, já escolhida) ou o nome quando não há logo. */
function MarcaDoSite({ site, logo, logoCls, nomeCls }: { site: SiteInfo; logo: string | null; logoCls: string; nomeCls: string }) {
  return logo
    ? <img src={logo} alt={site.name || 'Portal'} className={logoCls} />
    : <span className={nomeCls}>{site.name || 'Imóveis'}</span>;
}

/** Botão verde do WhatsApp do topo e do rodapé. */
function BotaoWhatsApp({ href, rotuloSempre = false }: { href: string; rotuloSempre?: boolean }) {
  return (
    <a
      href={href} target="_blank" rel="noreferrer"
      aria-label="Falar no WhatsApp"
      className="inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-semibold text-white sm:px-4"
      style={{ background: '#25D366' }}
    >
      <Ic d={I.wa} s={16} /> <span className={rotuloSempre ? '' : 'hidden sm:inline'}>WhatsApp</span>
    </a>
  );
}

/**
 * Roupa do topo pelo estilo da Aparência (`appearance.header_style`):
 * - `transparent` (fábrica): sobre a capa da home (`flutuando`) é o degradê
 *   escuro com texto branco; fora dela, ou depois de rolar, o fundo do site
 *   com vidro fosco. Igual ao de antes do C3, classe por classe;
 * - `brand`: na cor principal, com o texto branco ou escuro pelo contraste;
 * - `white`: branco, mesmo no fundo escuro (cores fixas, fora do bloco do
 *   fundo escuro do globals.css).
 */
function roupaDoTopo(ap: Aparencia, flutuando: boolean): { header: string; link: string; nome: string; botao: string; superficie: Superficie } {
  if (ap.header_style === 'brand') {
    return {
      header: 'border-transparent bg-[var(--brand)]',
      link: 'text-[14px] font-medium text-[var(--brand-ink)]/85 transition-colors hover:text-[var(--brand-ink)]',
      nome: 'text-[var(--brand-ink)]', botao: 'text-[var(--brand-ink)]', superficie: 'marca',
    };
  }
  if (ap.header_style === 'white') {
    return {
      // Classes literais (o Tailwind só gera o que lê no código): #17140F = TINTA_ESCURA.
      header: 'border-[#17140F]/[0.08] bg-[#FFFFFF]',
      link: 'text-[14px] font-medium text-[#17140F]/70 transition-colors hover:text-[var(--brand)]',
      nome: 'text-[#17140F]', botao: 'text-[#17140F]', superficie: 'branco',
    };
  }
  return flutuando
    ? {
      header: 'border-white/15 bg-gradient-to-b from-black/40 to-transparent',
      link: 'text-[14px] font-medium text-white/85 transition-colors hover:text-white',
      nome: 'text-white', botao: 'text-white', superficie: 'foto',
    }
    : {
      header: 'border-black/[0.06] bg-[var(--paper)]/90 backdrop-blur-md',
      link: 'text-[14px] font-medium text-neutral-600 transition-colors hover:text-[var(--brand)]',
      nome: '', botao: 'text-[var(--ink)]', superficie: 'fundo',
    };
}

const juntar = (...cls: string[]) => cls.filter(Boolean).join(' ');

/**
 * Topo do site em manutenção (só a ficha do imóvel usa: as outras páginas viram
 * a página Em manutenção). Só o logo, que leva pra raiz (a página de
 * manutenção), e o WhatsApp: sem abas, menu de páginas, blog nem busca.
 * Segue o estilo do topo das páginas internas (a ficha nunca tem capa): o
 * transparente é o fundo do site, a cor principal e o branco são eles mesmos,
 * com a logo clara onde o fundo é escuro.
 */
function TopoEmManutencao({ site, tenant }: PropsDaMoldura) {
  const ctx = useCtxDoSite(tenant);
  const waHref = linkDoWhatsApp(site.contact?.whatsapp);
  const ap = resolverAparencia(site.appearance);
  const roupa = roupaDoTopo(ap, false);
  const logo = logoNaSuperficie(site.branding?.logo_url, ap, roupa.superficie, tokensDoSite(site).brand);
  return (
    <div className="sticky top-0 z-40">
      <FaixaDePrevia site={site} />
      <header className={`border-b ${roupa.header}`}>
        <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between gap-4 px-4 sm:h-[84px] sm:px-6">
          <Link to={caminhoDoSite(ctx, '/')} className="flex items-center gap-2.5">
            <MarcaDoSite site={site} logo={logo.url} logoCls="h-12 w-auto max-w-[200px] object-contain sm:h-14 sm:max-w-[260px]"
              nomeCls={juntar('font-[var(--display)] text-xl font-semibold tracking-tight', roupa.nome)} />
          </Link>
          {waHref && <BotaoWhatsApp href={waHref} />}
        </div>
      </header>
    </div>
  );
}

/** Rodapé do site em manutenção: o logo (leva pra raiz) e o WhatsApp. */
function RodapeEmManutencao({ site, tenant }: PropsDaMoldura) {
  const ctx = useCtxDoSite(tenant);
  const waHref = linkDoWhatsApp(site.contact?.whatsapp);
  const logo = logoNaSuperficie(site.branding?.logo_url, resolverAparencia(site.appearance), 'fundo');
  return (
    <footer className="border-t border-black/[0.06] bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-10 sm:px-6">
        <Link to={caminhoDoSite(ctx, '/')}>
          <MarcaDoSite site={site} logo={logo.url} logoCls="h-9 w-auto max-w-[150px] object-contain"
            nomeCls="font-[var(--display)] text-lg font-semibold" />
        </Link>
        {waHref && <BotaoWhatsApp href={waHref} rotuloSempre />}
      </div>
    </footer>
  );
}

/**
 * Faixa da prévia (site aberto pelo link "Ver prévia" do painel). Mora DENTRO
 * do bloco que gruda no topo: fica sempre à vista sem cobrir o topo do site
 * nem a barra de contato da ficha, que é fixa embaixo no celular.
 */
export function FaixaDePrevia({ site }: { site: SiteInfo }) {
  if (!ehPrevia(site)) return null;
  return (
    <div role="status" className="bg-amber-400 px-4 py-1.5 text-center text-[13px] font-semibold text-neutral-900">
      Prévia: o site ainda não está publicado.
    </div>
  );
}

/** Topo do site. Em manutenção, o topo enxuto (só logo e WhatsApp). */
export function PortalHeader(props: PropsDaMoldura) {
  return estaEmManutencao(props.site) ? <TopoEmManutencao {...props} /> : <TopoCompleto {...props} />;
}

/** Rodapé do site. Em manutenção, o rodapé enxuto (só logo e WhatsApp). */
export function PortalFooter(props: PropsDaMoldura) {
  return estaEmManutencao(props.site) ? <RodapeEmManutencao {...props} /> : <RodapeCompleto {...props} />;
}

/**
 * `onHome`: na home o cabeçalho é TRANSPARENTE sobre a foto de capa e vira
 * sólido na rolagem; nas demais páginas ele é sólido desde o topo. Os links de
 * seção (Sobre/Contato) rolam a própria home via âncora e, fora dela, navegam
 * de volta apontando a seção. Nos estilos "na cor principal" e "branco" ele é
 * sólido sempre, inclusive sobre a capa.
 */
function TopoCompleto({ site, tenant, onHome = false, abas }: PropsDaMoldura) {
  const [menuOpen, setMenuOpen] = useState(false);
  // Só na home: antes de rolar, o cabeçalho flutua sobre a capa.
  const [scrolled, setScrolled] = useState(!onHome);
  const wa = site.contact?.whatsapp;
  const waHref = wa ? `https://wa.me/${onlyDigits(wa)}` : null;
  const hasBlog = usePublishedArticlesExist(tenant);
  const ctx = useCtxDoSite(tenant);
  const ap = resolverAparencia(site.appearance);

  useEffect(() => {
    if (!onHome) { setScrolled(true); return; }
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [onHome]);

  // O menu (tela Menus): sem menu_config ou com o de fábrica, os links de
  // antes do C3, na mesma ordem (abas, Sobre, Contato, Financiamento, Anuncie,
  // páginas, Blog). Sobre/Contato rolam a home por âncora e, fora dela, voltam
  // pra home apontando a seção.
  const nav = itensDoMenu(site, abas, hasBlog, { ctx, onHome });

  // Menu aberto sobre a capa é sempre sólido — texto branco sobre foto some.
  // Só o topo transparente flutua; na cor principal e no branco ele é sólido.
  const floating = ap.header_style === 'transparent' && onHome && !scrolled && !menuOpen;
  const roupa = roupaDoTopo(ap, floating);
  const logo = logoNaSuperficie(site.branding?.logo_url, ap, roupa.superficie, tokensDoSite(site).brand);
  // Sobre a capa, sem logo clara, a normal vira branca (o de sempre).
  const filtroDaLogo = floating && !logo.clara ? 'brightness-0 invert' : '';

  const desktopCls = roupa.link;
  const mobileCls = 'block py-2.5 text-[15px] font-medium text-neutral-700';

  return (
    <>
      {/* A barra de contato fica no TOPO DA PÁGINA e rola para fora, nunca
          gruda. Dentro do bloco que gruda, telefone e e-mail ocupavam uma faixa
          escura presa na tela o tempo todo — e na home ela SURGIA na primeira
          rolagem (antes disso o cabeçalho é transparente e ela nem existe), que
          é quando ninguém pediu por ela. Na home o topo é a capa, então lá ela
          não entra: os mesmos contatos continuam no rodapé. */}
      {!onHome && <PortalTopBar site={site} ap={ap} />}

      {/* Na home o cabeçalho NUNCA entra no fluxo — ele flutua sobre a capa e
          continua flutuando ao rolar, só trocando de roupa. Trocando de fora do
          fluxo para dentro dele na primeira rolagem, a página inteira saltava
          para baixo a altura do cabeçalho. */}
      <div className={onHome ? 'fixed inset-x-0 top-0 z-40' : 'sticky top-0 z-40'}>
        <FaixaDePrevia site={site} />
        <header className={`border-b transition-colors duration-300 ${roupa.header}`}>
          {/* Logo maior a pedido do dono (2026-09-16): 56px de altura no
              desktop, 48px no celular. A barra cresce junto (84px / 72px) para
              o logo não encostar nas bordas, e o hero da home compensa esse
              ganho no padding do topo — o cabeçalho FLUTUA na home, então o
              título não desce sozinho. Logo horizontal bate primeiro no max-w,
              por isso a largura sobe na mesma proporção (190 → 260). */}
          <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between gap-4 px-4 sm:h-[84px] sm:px-6">
            <Link to={caminhoDoSite(ctx, '/')} className="flex items-center gap-2.5">
              {logo.url ? (
                <img
                  src={logo.url}
                  alt={site.name || 'Portal'}
                  className={`h-12 w-auto max-w-[200px] object-contain sm:h-14 sm:max-w-[260px] ${filtroDaLogo}`}
                />
              ) : (
                <span className={`font-[var(--display)] text-xl font-semibold tracking-tight ${roupa.nome}`}>
                  {site.name || 'Imóveis'}
                </span>
              )}
            </Link>

            <nav className="hidden items-center gap-6 lg:flex">
              {nav.map(l => <LinkDoMenuEl key={l.chave} l={l} cls={desktopCls} />)}
            </nav>

            <div className="flex items-center gap-2">
              {site.translate?.enabled && <PortalTranslate languages={site.translate.languages ?? []} />}
              {waHref && (
                <a
                  href={waHref} target="_blank" rel="noreferrer"
                  aria-label="Falar no WhatsApp"
                  className="inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-semibold text-white sm:px-4"
                  style={{ background: '#25D366' }}
                >
                  <Ic d={I.wa} s={16} /> <span className="hidden sm:inline">WhatsApp</span>
                </a>
              )}
              <button
                type="button" aria-label="Menu" aria-expanded={menuOpen}
                onClick={() => setMenuOpen(o => !o)}
                className={`inline-flex h-10 w-10 items-center justify-center rounded-full lg:hidden ${roupa.botao}`}
              >
                <Ic d={menuOpen ? I.close : I.menu} s={22} />
              </button>
            </div>
          </div>

          {menuOpen && (
            <nav className="border-t border-black/[0.06] bg-[var(--paper)] px-4 py-3 lg:hidden">
              {nav.map(l => <LinkDoMenuEl key={l.chave} l={l} cls={mobileCls} onClick={() => setMenuOpen(false)} />)}
              {(site.contact?.phone || site.contact?.email) && (
                <div className="mt-2 border-t border-black/[0.06] pt-2 text-[13px] text-neutral-500">
                  {site.contact?.phone && (
                    <a href={`tel:${onlyDigits(site.contact.phone)}`} className="block py-1.5">{site.contact.phone}</a>
                  )}
                  {site.contact?.email && (
                    <a href={`mailto:${site.contact.email}`} className="block py-1.5">{site.contact.email}</a>
                  )}
                </div>
              )}
            </nav>
          )}
        </header>
      </div>
    </>
  );
}

/* ── Footer compartilhado ────────────────────────────────────────────────── */
function FooterCol({ children, title }: { children: ReactNode; title: string }) {
  return (
    <div>
      <h4 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-neutral-500">{title}</h4>
      <ul className="space-y-2">{children}</ul>
    </div>
  );
}
const footerLinkCls = 'text-[13px] text-neutral-600 hover:text-[var(--brand)]';

function LinkDoRodapeEl({ l }: { l: LinkDoMenu }) {
  return <LinkDoMenuEl l={l} cls={footerLinkCls} />;
}

/**
 * Links do rodapé ANTES do C3: Imóveis com as abas e Institucional com uma
 * lista própria (Sobre nós, Blog, Contato, Anuncie, Financiamento), sem as
 * páginas criadas. Vale enquanto o menu é o de fábrica (`menuPersonalizado`).
 */
function linksDoRodapeDeAntes(site: SiteInfo, abas: AbaId[] | undefined, hasBlog: boolean, ctx: CtxDoSite, onHome: boolean) {
  const showStats = site.sections?.stats !== false;
  const showLeadCapture = site.sections?.lead_capture !== false;
  const sectionHref = (id: string) => (onHome ? `#${id}` : caminhoDoSite(ctx, `/#${id}`));
  const link = (chave: string, rotulo: string, href: string, ancora = false): LinkDoMenu => ({ chave, rotulo, href, ancora, externo: false });
  const imoveis = ABAS_DO_RODAPE.filter(abaVisivel(abas))
    .map(aba => link(aba, NOME_DE_FABRICA[aba], caminhoDoSite(ctx, `/imoveis?tab=${aba}`)));
  /* "Anuncie" rolava para o formulário de QUEM COMPRA: o proprietário que
     queria VENDER caía no formulário contrário. Agora ele só existe quando a
     página de verdade está ligada, e aponta para ela. */
  const institucional = [
    showStats && link('sobre', 'Sobre nós', sectionHref('sobre'), true),
    hasBlog && link('blog', 'Blog', caminhoDoSite(ctx, '/blog')),
    showLeadCapture && link('contato', 'Contato', sectionHref('contato'), true),
    site.anuncie?.enabled && link('anuncie', 'Anuncie seu imóvel', caminhoDoSite(ctx, '/anuncie')),
    site.financiamento?.enabled && link('financiamento', 'Financiamento', caminhoDoSite(ctx, '/financiamento')),
  ].filter((l): l is LinkDoMenu => !!l);
  return { imoveis, institucional, todos: [...imoveis, ...institucional] };
}

/**
 * Links do rodapé que repetem o menu (depois que o cliente mexe na tela
 * Menus): as abas do menu em Imóveis e o resto em Institucional (Sobre,
 * Contato, Financiamento, Anuncie, páginas, Blog e os externos), cada coluna
 * na ordem do menu. No compacto, o menu inteiro na ordem dele.
 */
function linksDoRodapeDoMenu(menu: LinkDoMenu[]) {
  return {
    imoveis: menu.filter(l => ehAba(l.chave)),
    institucional: menu.filter(l => !ehAba(l.chave)),
    todos: menu,
  };
}

/**
 * "feito com LM Flow": fica sempre, discreto, com o link pro site do LM Flow.
 * O cliente não tira (não há opção na Aparência).
 */
function CreditoDoRodape({ nome }: { nome?: string }) {
  return (
    <>
      © {nome || 'Portal'} — feito com{' '}
      <a href="https://lmflow.com.br" target="_blank" rel="noopener" className="transition-colors hover:text-neutral-600">LM Flow</a>.
    </>
  );
}

/**
 * Rodapé nos dois layouts da Aparência (`appearance.footer_layout`):
 * - `columns` (fábrica): logo e frase, Imóveis, Institucional e Contato;
 * - `compact`: uma faixa só, com logo, os mesmos links e o WhatsApp, e
 *   embaixo a frase junto do crédito.
 * A frase é o `footer_text` (sem ele, "Seu portal de imóveis com atendimento
 * de verdade."). No fundo escuro a logo é a clara, quando existe.
 */
function RodapeCompleto({ site, tenant, onHome = false, abas }: PropsDaMoldura) {
  const wa = site.contact?.whatsapp;
  const waHref = wa ? `https://wa.me/${onlyDigits(wa)}` : null;
  const hasBlog = usePublishedArticlesExist(tenant);
  const ctx = useCtxDoSite(tenant);
  const ap = resolverAparencia(site.appearance);
  const logo = logoNaSuperficie(site.branding?.logo_url, ap, 'fundo');
  const frase = ap.footer_text ?? TEXTO_RODAPE_FABRICA;
  // O rodapé repete o menu depois que o cliente mexe nele; com o menu de
  // fábrica (ou servidor velho) fica o rodapé de antes do C3.
  const personalizado = menuPersonalizado(site);
  const { imoveis, institucional, todos } = personalizado
    ? linksDoRodapeDoMenu(itensDoMenu(site, abas, hasBlog, { ctx, onHome }))
    : linksDoRodapeDeAntes(site, abas, hasBlog, ctx, onHome);

  if (ap.footer_layout === 'compact') {
    return (
      <footer className="border-t border-black/[0.06] bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-4 px-4 py-6 sm:px-6">
          <Link to={caminhoDoSite(ctx, '/')} className="shrink-0">
            <MarcaDoSite site={site} logo={logo.url} logoCls="h-8 w-auto max-w-[140px] object-contain"
              nomeCls="font-[var(--display)] text-lg font-semibold" />
          </Link>
          <nav aria-label="Links do rodapé" className="flex flex-1 flex-wrap items-center gap-x-5 gap-y-2">
            {todos.map(l => <LinkDoRodapeEl key={l.chave} l={l} />)}
          </nav>
          {waHref && <a href={waHref} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-semibold text-white" style={{ background: '#25D366' }}><Ic d={I.wa} s={15} /> WhatsApp</a>}
        </div>
        <div className="border-t border-black/[0.06]">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-4 text-[12px] text-neutral-400 sm:px-6">
            <p className="whitespace-pre-line text-neutral-500">{frase}</p>
            <p><CreditoDoRodape nome={site.name} /></p>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="border-t border-black/[0.06] bg-white">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-4 py-12 sm:grid-cols-4 sm:px-6">
        <div className="col-span-2 sm:col-span-1">
          {logo.url
            ? <img src={logo.url} alt={site.name || ''} className="h-9 w-auto max-w-[150px] object-contain" />
            : <span className="font-[var(--display)] text-lg font-semibold">{site.name || 'Imóveis'}</span>}
          <p className={`mt-3 max-w-xs text-[13px] leading-relaxed text-neutral-500${ap.footer_text ? ' whitespace-pre-line' : ''}`}>{frase}</p>
        </div>
        {imoveis.length > 0 && (
          <FooterCol title="Imóveis">
            {imoveis.map(l => <li key={l.chave}><LinkDoRodapeEl l={l} /></li>)}
          </FooterCol>
        )}
        {(institucional.length > 0 || !personalizado) && (
          <FooterCol title="Institucional">
            {institucional.map(l => <li key={l.chave}><LinkDoRodapeEl l={l} /></li>)}
          </FooterCol>
        )}
        <div>
          <h4 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-neutral-500">Contato</h4>
          {waHref && <a href={waHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-semibold text-white" style={{ background: '#25D366' }}><Ic d={I.wa} s={15} /> WhatsApp</a>}
          <div className="mt-3 space-y-1.5 text-[13px] text-neutral-600">
            {site.contact?.phone && <div><a href={`tel:${onlyDigits(site.contact.phone)}`} className="hover:text-[var(--brand)]">{site.contact.phone}</a></div>}
            {site.contact?.email && <div><a href={`mailto:${site.contact.email}`} className="break-all hover:text-[var(--brand)]">{site.contact.email}</a></div>}
            {site.contact?.address && <div className="whitespace-pre-line text-neutral-500">{site.contact.address}</div>}
          </div>
          {socialEntries(site).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[13px]">
              {socialEntries(site).map(sn => (
                <a key={sn.key} href={sn.url} target="_blank" rel="noreferrer" className={footerLinkCls}>{sn.label}</a>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="border-t border-black/[0.06] py-5 text-center text-[12px] text-neutral-400">
        <CreditoDoRodape nome={site.name} />
      </div>
    </footer>
  );
}
