/**
 * "Parece com a ficha X" (Tarefa 7, 04/11/2026): o nome de um formulário novo só SUGERE a ficha de onde copiar.
 * Nenhuma regra de roteamento mora aqui (a regra do nome sai do servidor); é só uma dica de tela.
 *
 * Não usa `normalizarNome` (regraPorPalavra): aquele apaga o colchete que tem número, e aqui `[CASTELO 2.0]`
 * tem que virar `castelo`. A data (`[03/11]`) some porque o pedaço sem letra nenhuma é descartado.
 */
import type { LeadAdsFormConfig } from '@/services/leadAds/leadAdsFormsService';

/** Etiquetas de uso, não de empreendimento: sozinhas não dizem de qual ficha se trata. */
const GENERICAS = new Set(['int', 'cond', 'copy', 'novo']);
/** Preposição e "vila" aparecem em nomes de empreendimento que não têm nada a ver um com o outro. */
const SEM_VALOR = new Set(['de', 'da', 'do', 'das', 'dos', 'vila']);

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** As palavras úteis do nome: sem acento, sem data/número solto, sem as genéricas, sem palavra de 1-2 letras. */
function palavrasUteis(nome: string | null | undefined): Set<string> {
  return new Set(
    semAcento(nome ?? '')
      .split(/[^\p{L}\p{N}]+/u)
      .filter((p) => p.length > 2 && /\p{L}/u.test(p) && !GENERICAS.has(p) && !SEM_VALOR.has(p)),
  );
}

const quando = (c: LeadAdsFormConfig) => Date.parse(c.updated_at ?? c.created_at) || 0;

/** A ficha do cliente que mais se parece com o nome, ou null. Ligada vence desligada; depois mais palavras; depois a mais recente. */
export function fichaParecida(nome: string, fichas: readonly LeadAdsFormConfig[]): LeadAdsFormConfig | null {
  const doNome = palavrasUteis(nome);
  if (doNome.size === 0) return null;
  let melhor: { ficha: LeadAdsFormConfig; comuns: number } | null = null;
  const vence = (a: { ficha: LeadAdsFormConfig; comuns: number }, b: { ficha: LeadAdsFormConfig; comuns: number }) => {
    if (a.ficha.is_active !== b.ficha.is_active) return a.ficha.is_active;
    if (a.comuns !== b.comuns) return a.comuns > b.comuns;
    return quando(a.ficha) > quando(b.ficha);
  };
  for (const ficha of fichas) {
    const comuns = [...palavrasUteis(ficha.form_name)].filter((p) => doNome.has(p)).length;
    if (comuns === 0) continue;
    const cand = { ficha, comuns };
    if (!melhor || vence(cand, melhor)) melhor = cand;
  }
  return melhor?.ficha ?? null;
}
