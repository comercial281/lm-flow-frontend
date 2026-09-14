import { extractError } from '@/utils/apiHelpers';
import type { Portal, PortalAdType, PortalPublication } from '@/services/portals/portalsService';

/**
 * Plano de anúncios do portal: regra pura, sem tela.
 *
 * O servidor é a fonte da cota e do veredito (ele recusa com 422 quando a cota
 * estoura sem confirmação). A tela precisa da MESMA conta antes de enviar, para
 * pintar o contador de vermelho e perguntar "tem certeza?" ANTES da requisição —
 * e o texto da pergunta tem que ser o mesmo que o servidor devolve, senão o
 * diálogo aberto pela tela e o aberto pelo 422 diriam coisas diferentes para o
 * mesmo estouro.
 */

export interface Estouro {
  key: string;
  label: string;
  limit: number;
  count: number;
  excess: number;
}

/** Servidor novo manda `ad_types`; o antigo não, e a tela cai no modo legado. */
export function temTiposDeAnuncio(portal: Pick<Portal, 'ad_types'> | null | undefined): boolean {
  return Array.isArray(portal?.ad_types) && portal.ad_types.length > 0;
}

/** O tipo base é o PRIMEIRO da lista servida (é a ordem do servidor que manda). */
export function tipoBase(adTypes: PortalAdType[]): PortalAdType | null {
  return adTypes[0] ?? null;
}

/**
 * Quantos imóveis estão em cada tipo. Tipo que o portal não conhece cai no
 * base — é o que o servidor faz com `ad_type` nulo, e é o que garante que um
 * imóvel gravado num tipo que sumiu do catálogo continue contado.
 */
export function contarPorTipo(
  adTypes: PortalAdType[],
  publications: Map<string, string>,
): Record<string, number> {
  const counts: Record<string, number> = {};
  adTypes.forEach(t => { counts[t.key] = 0; });
  const base = tipoBase(adTypes);
  publications.forEach(adType => {
    const key = Object.prototype.hasOwnProperty.call(counts, adType) ? adType : base?.key;
    if (key !== undefined) counts[key] += 1;
  });
  return counts;
}

/** Tipos cuja contagem passa da cota. Cota nula (ilimitado) nunca estoura. */
export function estouros(adTypes: PortalAdType[], counts: Record<string, number>): Estouro[] {
  const lista: Estouro[] = [];
  adTypes.forEach(t => {
    if (t.limit === null || t.limit === undefined) return;
    const count = counts[t.key] ?? 0;
    if (count > t.limit) {
      lista.push({ key: t.key, label: t.label, limit: t.limit, count, excess: count - t.limit });
    }
  });
  return lista;
}

/**
 * O mesmo texto que o servidor devolve no 422 `AD_PLAN_EXCEEDED`:
 * "<label>: <count> de <limit> — o portal rebaixa <excess> imóvel(is) para o
 * tipo abaixo", uma cláusula por tipo, separadas por "; ".
 */
export function mensagemDeEstouro(lista: Estouro[]): string {
  return lista
    .map(e => {
      const quantos = e.excess === 1 ? '1 imóvel' : `${e.excess} imóveis`;
      return `${e.label}: ${e.count} de ${e.limit} — o portal rebaixa ${quantos} para o tipo abaixo`;
    })
    .join('; ');
}

/** Chaves sentinela do modo legado (servidor sem `ad_types`): base e destaque. */
export const LEGADO_BASE = 'standard';
export const LEGADO_DESTAQUE = 'featured';

/**
 * Servidor antigo: a tela só tinha "vai pro portal" e "em destaque". Quem
 * estava em destaque vira o SEGUNDO tipo (o tier logo acima do base, que é o
 * que o backfill do servidor também faz); o resto vira o base. Sem tipos
 * conhecidos, o destaque vira a chave `featured` — o servidor antigo nem lê
 * isto (a tela manda o formato legado), mas a Map precisa de um valor.
 */
export function legadoParaPublicacoes(
  propertyIds: string[],
  featuredIds: string[],
  adTypes: PortalAdType[],
): PortalPublication[] {
  const base = adTypes[0]?.key ?? LEGADO_BASE;
  const destaque = adTypes[1]?.key ?? (adTypes.length === 0 ? LEGADO_DESTAQUE : base);
  const emDestaque = new Set(featuredIds);
  return propertyIds.map(id => ({
    property_id: id,
    ad_type: emDestaque.has(id) ? destaque : base,
  }));
}

/**
 * Lê os estouros de um 422 `AD_PLAN_EXCEEDED`. Aceita o erro cru do axios
 * (`extractError` lê os dois formatos da API) e devolve lista vazia para
 * qualquer outro erro — é isso que separa "cota estourada, pergunte" de
 * "deu erro, avise".
 */
export function estourosDoErro(err: unknown): Estouro[] {
  if (!err || typeof err !== 'object') return [];
  const info = extractError(err);
  if (info.code !== 'AD_PLAN_EXCEEDED') return [];
  const overflows = (info.details as { overflows?: unknown } | undefined)?.overflows;
  if (!Array.isArray(overflows)) return [];
  return overflows
    .filter((o): o is Record<string, unknown> => !!o && typeof o === 'object')
    .map(o => ({
      key: String(o.key ?? ''),
      label: String(o.label ?? o.key ?? ''),
      limit: Number(o.limit ?? 0),
      count: Number(o.count ?? 0),
      excess: Number(o.excess ?? Math.max(0, Number(o.count ?? 0) - Number(o.limit ?? 0))),
    }));
}

/**
 * O campo *Valor mensal do investimento (R$)*: aceita "3.593,45", "3593,45" e
 * "3593.45", e guarda sempre como texto decimal com ponto ("3593.45") — é o
 * que o servidor espera. Vazio é "sem valor" (nulo); o que não é número é
 * recusado, para a tela avisar em vez de gravar lixo.
 */
export function investimentoNormalizado(raw: string): { valido: boolean; valor: string | null } {
  const texto = (raw ?? '').trim();
  if (texto === '') return { valido: true, valor: null };
  const semMoeda = texto.replace(/^R\$\s*/i, '').replace(/\s+/g, '');
  let comPonto: string;
  if (semMoeda.includes(',')) {
    comPonto = semMoeda.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(semMoeda)) {
    // "1.200" / "1.200.000": sem vírgula, o ponto é de milhar.
    comPonto = semMoeda.replace(/\./g, '');
  } else {
    comPonto = semMoeda;
  }
  if (!/^\d+(\.\d{1,2})?$/.test(comPonto)) return { valido: false, valor: null };
  return { valido: true, valor: comPonto };
}

/** O inverso, para a tela: "3593.45" → "3593,45". */
export function investimentoParaTela(valor: string | null | undefined): string {
  if (valor === null || valor === undefined || valor === '') return '';
  return String(valor).replace('.', ',');
}

/**
 * O campo de cota da tela: vazio, "0" e negativo significam ILIMITADO (nulo),
 * que é o que o servidor grava para "sem cota". Vírgula decimal e espaços são
 * tolerados; o que não é número também vira ilimitado, nunca NaN.
 */
export function limiteNormalizado(raw: string): number | null {
  const texto = (raw ?? '').trim().replace(',', '.');
  if (texto === '') return null;
  const n = Number(texto);
  if (!Number.isFinite(n)) return null;
  const inteiro = Math.floor(n);
  return inteiro > 0 ? inteiro : null;
}
