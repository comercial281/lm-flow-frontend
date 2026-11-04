/**
 * As contas do CLIENTE no bloco "Aparecer no Google": a pessoa cola o que o
 * Google, o Bing e o Clarity mostram (às vezes só o código, às vezes a tag ou o
 * script inteiro). Espelho de `Sites::GoogleConfig` no servidor, que é quem
 * grava: aqui só serve para a tela avisar na hora quando não reconheceu.
 */
import type { SiteGoogle } from '@/services/siteBuilder/siteBuilderService';

const TOKEN = /^[A-Za-z0-9_-]{10,100}$/;

function verificacao(valor: string, metaName: string): string | null {
  let t = valor.trim();
  if (t.includes('<')) {
    if (!t.includes(metaName)) return null;
    t = (/content\s*=\s*["']([^"']+)["']/i.exec(t)?.[1] ?? '').trim();
  }
  return TOKEN.test(t) ? t : null;
}

export const lerContas = {
  searchConsole: (v: string) => verificacao(v, 'google-site-verification'),
  bing: (v: string) => verificacao(v, 'msvalidate.01'),
  clarity(v: string): string | null {
    const t = v.trim();
    const id = (/clarity\.ms\/tag\/([a-z0-9]+)/i.exec(t)?.[1] ?? /["']script["']\s*,\s*["']([a-z0-9]+)["']/i.exec(t)?.[1] ?? t).toLowerCase();
    return /^[a-z0-9]{6,20}$/.test(id) ? id : null;
  },
  perfil(v: string): string | null {
    const t = v.trim();
    return /^https?:\/\/\S+$/i.test(t) ? t : null;
  },
  creci(v: string): string | null {
    const t = v.trim().replace(/^creci[\s:-]*/i, '');
    return /^[A-Za-z0-9][A-Za-z0-9 ./-]{1,39}$/.test(t) ? t : null;
  },
};

/** O bloco inteiro, com o que o servidor mandou (servidor velho manda menos). */
export function resolverGoogle(g: Partial<SiteGoogle> | null | undefined): SiteGoogle {
  const s = (v: unknown) => (typeof v === 'string' ? v : '');
  return {
    indexable: g?.indexable === true,
    search_console: s(g?.search_console),
    bing: s(g?.bing),
    clarity: s(g?.clarity),
    business_profile_url: s(g?.business_profile_url),
    creci: s(g?.creci),
  };
}

/** Campo preenchido que não deu para ler: a tela mostra o erro embaixo dele. */
export function naoReconhecido(valor: string | null | undefined, ler: (v: string) => string | null): boolean {
  const t = (valor ?? '').trim();
  return !!t && ler(t) === null;
}
