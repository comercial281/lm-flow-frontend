// Ordenação da lista de imóveis do site público. Mora no navegador, em cima do
// catálogo inteiro que o site já carrega: o servidor não ordena.
import type { PortalProperty, PortalTab } from './filtros';
import type { Ordem } from './listaConfig';

/** Número que serve pra ordenar; 0, negativo ou ausente = "não tem" (vai pro fim). */
const positivo = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);

const quando = (p: PortalProperty): number | null => {
  const t = p.created_at ? Date.parse(p.created_at) : NaN;
  return Number.isFinite(t) ? t : null;
};

/** Valor da ordem pedida, ou null quando o imóvel não tem (sem preço, sem área). */
function chave(p: PortalProperty, ordem: Ordem, aba: PortalTab): number | null {
  if (ordem === 'area_desc') return positivo(p.icon_summary?.useful_area_m2);
  if (ordem === 'price_asc' || ordem === 'price_desc') return positivo(aba === 'rent' ? p.rent_price_from : p.sale_price_from);
  return quando(p);
}

const codigo = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });

/**
 * Nova lista ordenada (a original não muda). Imóvel sem o valor da ordem vai
 * pro fim. Empate: o mais recente primeiro, depois o código. Sem data dos dois
 * lados (servidor velho), fica a ordem em que vieram, que já é dos mais recentes.
 */
export function ordenarImoveis(items: PortalProperty[], ordem: Ordem, aba: PortalTab): PortalProperty[] {
  const sobe = ordem === 'price_asc';
  return items
    .map((p, i) => ({ p, i, k: chave(p, ordem, aba), d: quando(p) }))
    .sort((a, b) => {
      if (a.k == null || b.k == null) {
        if (a.k != null) return -1;
        if (b.k != null) return 1;
      } else if (a.k !== b.k) {
        return sobe ? a.k - b.k : b.k - a.k;
      }
      if (a.d != null && b.d != null && a.d !== b.d) return b.d - a.d;
      if (a.d != null && b.d == null) return -1;
      if (a.d == null && b.d != null) return 1;
      // "Mais recentes" sem data nenhuma: mantém a ordem do servidor.
      if (ordem === 'recent' && a.d == null) return a.i - b.i;
      return codigo.compare(a.p.code, b.p.code);
    })
    .map(x => x.p);
}
