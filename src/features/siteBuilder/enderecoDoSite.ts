// src/features/siteBuilder/enderecoDoSite.ts
// Onde o site do cliente abre, para o painel do Meu site ("Ver site", "Ver
// prévia" e a frase de "Aparecer no Google").
//
// - Com domínio próprio ATIVO (`site.domain`, já verificado na Vercel): o
//   domínio, com os caminhos limpos (`https://imobiliaria.com.br`).
// - Sem domínio: o endereço lmflow de sempre (`<endereço do painel>/portal/<cliente>`).
//
// O Google lê o site pelo domínio próprio, ou pelo subdomínio do cliente
// (`<cliente>.lmflow.com.br`) quando não há domínio. `app.lmflow.com.br` nunca
// entra: o `robots.txt` dele fecha tudo (ver middleware/headDoSite.ts).

export interface SiteComEndereco {
  slug?: string | null;
  domain?: string | null;
}

export interface EnderecoDoSite {
  /** Endereço completo, para abrir. */
  url: string;
  /** Sem `https://`, para mostrar na barra. */
  visivel: string;
  /** O site abre no domínio próprio ativo. */
  noDominio: boolean;
}

function limparDominio(d: string | null | undefined): string | null {
  const h = (d ?? '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/\.$/, '');
  return h || null;
}

export function enderecoDoSite(
  site: SiteComEndereco,
  opts: { origin: string; tenant: string | null },
): EnderecoDoSite {
  const dominio = limparDominio(site.domain);
  if (dominio) return { url: `https://${dominio}`, visivel: dominio, noDominio: true };
  const url = `${opts.origin.replace(/\/+$/, '')}/portal/${opts.tenant ?? site.slug ?? ''}`;
  return { url, visivel: url.replace(/^https?:\/\//, ''), noDominio: false };
}

/** `<endereço do site>?previa=<token>`, com o token codificado. */
export function urlDaPrevia(urlDoSite: string, token: string): string {
  const u = new URL(urlDoSite);
  u.searchParams.set('previa', token);
  return u.toString();
}

/** Onde o Google lê o site: o domínio ativo ou `<cliente>.lmflow.com.br`. */
export function enderecoNoGoogle(site: SiteComEndereco, tenant: string | null): string {
  return limparDominio(site.domain) ?? `${tenant ?? site.slug ?? ''}.lmflow.com.br`;
}
