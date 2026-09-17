/**
 * Carregamento da landing de anúncio PÚBLICA — a fonte única de "como a
 * página busca o próprio conteúdo", lida pela página da landing e pela página
 * de resultado (obrigado / desqualificado).
 *
 * POR QUE ISTO EXISTE
 * A landing é o caminho por onde a verba de anúncio entra, e ela era lenta por
 * uma fila de espera: o HTML baixava o código, o código montava a página, e só
 * então a página perguntava ao servidor o que mostrar. Fotos vinham depois
 * disso. Cada elo esperava o anterior.
 *
 * O `lp.html` (a entrada enxuta de /lp/*) começa a buscar o conteúdo AINDA NO
 * HTML, antes de o código chegar, e deixa a promessa em `window.__lmLanding`.
 * Quem consome é este arquivo: se a busca antecipada é da MESMA landing, a
 * página usa a resposta que já está a caminho; senão, busca do zero. Assim a
 * página nunca depende da busca antecipada existir — a rota antiga do CRM
 * (sem o HTML enxuto) continua funcionando igual.
 *
 * A busca antecipada é consumida UMA vez: o corpo de uma resposta só pode ser
 * lido uma vez, e reaproveitar uma resposta que falhou repetiria a falha.
 */

export interface LandingPixel {
  pixel_id?: string | null;
  events?: {
    page_view?: boolean;
    submit?: string | null;
    qualified?: string | null;
    disqualified?: string | null;
  };
}

export interface PublicLandingPhotoDTO {
  file_url: string;
  thumbnail_url?: string | null;
  /** Capa redimensionada para tela (servidor novo). Ausente = usa `file_url`. */
  hero_url?: string | null;
  caption?: string | null;
  alt_text?: string | null;
  is_cover?: boolean;
}

export interface PublicLandingDTO {
  title: string;
  theme?: Record<string, unknown> | null;
  content_blocks: unknown[];
  pixel?: LandingPixel | null;
  property?: {
    code: string;
    title: string;
    description?: string;
    stage?: string;
    sale_price?: number | null;
    bedrooms?: number | null;
    bathrooms?: number | null;
    suites?: number | null;
    parking_spaces?: number | null;
    useful_area_m2?: number | null;
    total_area_m2?: number | null;
    address_neighborhood?: string;
    address_city?: string;
    address_state?: string;
    latitude?: number | null;
    longitude?: number | null;
    responsible_name?: string;
    photos?: PublicLandingPhotoDTO[];
  } | null;
}

/** O que o script inline do lp.html deixa na janela. */
export interface EarlyLanding {
  tenant: string;
  slug: string;
  promise: Promise<Response>;
}

declare global {
  interface Window {
    __lmLanding?: EarlyLanding;
  }
}

export interface LandingRoute {
  tenant: string;
  slug: string;
  /** `obrigado` | `desqualificado` — só nas páginas de resultado. */
  result?: string;
}

/** Lê /lp/:tenant/:slug(/:result) do caminho. Fora desse formato, null. */
export function parseLandingPath(pathname: string): LandingRoute | null {
  const m = pathname.match(/^\/lp\/([^/]+)\/([^/]+)(?:\/([^/]+))?\/?$/);
  if (!m) return null;
  const decode = (s: string) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  };
  const route: LandingRoute = { tenant: decode(m[1]), slug: decode(m[2]) };
  if (m[3]) route.result = decode(m[3]);
  return route;
}

export function landingEndpoint(base: string, slug: string): string {
  return `${base.replace(/\/+$/, '')}/api/public/v1/landing/${encodeURIComponent(slug)}`;
}

/** Pega (e apaga) a busca antecipada, só quando ela é DESTA landing. */
export function takeEarlyLanding(tenant: string, slug: string, w: Pick<Window, '__lmLanding'> | undefined = globalThis.window): EarlyLanding | null {
  const early = w?.__lmLanding;
  if (!early) return null;
  if (w) delete w.__lmLanding;
  if (early.tenant !== tenant || early.slug !== slug) return null;
  return early;
}

export interface LoadLandingOptions {
  tenant: string;
  slug: string;
  base: string;
  fetchImpl?: typeof fetch;
  /** `undefined` = procura na janela; `null` = não usar busca antecipada. */
  early?: EarlyLanding | null;
}

/** Devolve o conteúdo da landing, ou null quando ela não está disponível
 *  (rascunho, apagada, servidor fora) — a página mostra o mesmo aviso nos
 *  três casos. */
export async function loadLanding(opts: LoadLandingOptions): Promise<PublicLandingDTO | null> {
  const { tenant, slug, base } = opts;
  const early = opts.early === undefined ? takeEarlyLanding(tenant, slug) : opts.early;
  try {
    let res: Response;
    if (early) {
      try {
        res = await early.promise;
      } catch {
        // A busca antecipada caiu (rede oscilou entre o HTML e o código):
        // tenta de novo pelo caminho normal antes de dar a página por indisponível.
        res = await (opts.fetchImpl ?? fetch)(landingEndpoint(base, slug), { headers: { 'X-Tenant': tenant } });
      }
    } else {
      res = await (opts.fetchImpl ?? fetch)(landingEndpoint(base, slug), { headers: { 'X-Tenant': tenant } });
    }
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: PublicLandingDTO };
    return json?.data ?? null;
  } catch {
    return null;
  }
}
