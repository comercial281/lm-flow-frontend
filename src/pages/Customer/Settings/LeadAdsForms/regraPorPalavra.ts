// Qual cadastro "por palavra" pega um formulário do Facebook que não tem cadastro
// próprio. Espelho do roteador do servidor (`MetaLeads::LeadRouter`
// `match_config_by_keyword` + `normalize_form_name`): só cadastros ATIVOS da
// mesma página (ou sem página), e a palavra casa quando TODAS as palavras dela
// estão no nome do formulário; com mais de um, vence o que tem mais palavras.
// O cadastro exato (`form_id`) vence sempre — por isso esta conta só serve pra
// formulário que não tem cadastro próprio.
//
// Mudou a regra lá, muda aqui: a tela diz "cai na Roleta X" com base nisto.

export interface CadastroComPalavra {
  form_name: string;
  match_keyword: string | null;
  meta_page_id: string | null;
  is_active: boolean;
}

/** Mesma normalização do servidor: minúsculo, sem data e sem colchete/parêntese. */
export function normalizarNome(nome: string | null | undefined): string {
  let s = (nome ?? '').toLowerCase();
  s = s.replace(/[[(][^\])]*\d[^\])]*[\])]/g, ' ');
  s = s.replace(/^\s*\d{1,4}([/.-]\d{1,4}){1,2}\b\s*/, ' ');
  s = s.replace(/[\s\-–—/.]+\d{1,4}([\s\-–—/.]+\d{1,4})+\s*$/, ' ');
  s = s.replace(/[[\]()]/g, ' ');
  return s.replace(/\s+/g, ' ').trim();
}

const palavras = (nome: string | null | undefined) => new Set(normalizarNome(nome).split(' ').filter(Boolean));

/** O cadastro por palavra que pega o formulário, ou null. */
export function regraQuePega<T extends CadastroComPalavra>(
  nomeDoFormulario: string,
  paginaDoFormulario: string | null | undefined,
  cadastros: T[],
): T | null {
  const doFormulario = palavras(nomeDoFormulario);
  if (doFormulario.size === 0) return null;
  let melhor: T | null = null;
  let tamanho = 0;
  for (const c of cadastros) {
    if (!c.is_active) continue;
    if (c.meta_page_id && paginaDoFormulario && c.meta_page_id !== paginaDoFormulario) continue;
    const daRegra = palavras(c.match_keyword?.trim() || c.form_name);
    if (daRegra.size === 0) continue;
    if (![...daRegra].every(p => doFormulario.has(p))) continue;
    if (daRegra.size > tamanho) {
      melhor = c;
      tamanho = daRegra.size;
    }
  }
  return melhor;
}
