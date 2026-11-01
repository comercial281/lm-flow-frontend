/**
 * Regras e Objeções da casa (Tarefa 75, 01/11/2026): os tetos e as duas conferências que a tela
 * faz ANTES de gravar. ESPELHO de `SalesAgent` (servidor: MAX_HOUSE_*, HOUSE_RULE_IDENTITY_RE,
 * HOUSE_RULES_IDENTITY_MESSAGE): quem decide de verdade é o servidor, a tela só poupa a ida e volta.
 */

export const TETO_DE_REGRAS = 30;
export const TETO_DA_REGRA = 200;
export const TETO_DE_OBJECOES = 10;
export const TETO_DA_OBJECAO = 200;
export const TETO_DA_RESPOSTA = 600;

/** A frase do servidor (C30), igual nos dois lados. */
export const MENSAGEM_DE_APRESENTACAO = 'Regras da casa não aceita apresentação: quem a IA é fica na ficha, em Números e usuários.';
export const AVISO_DE_PRODUTO = 'Condição e imóvel moram no cadastro ou na campanha.';

// "sou" no começo da linha ou da oração, "meu nome é", "me chamo", "se apresente", "fale como" + nome próprio.
// "Não diga que sou robô" e "se o lead disser 'sou investidor'" passam. O `é` não é letra de palavra pro `\b`:
// o fim de palavra é conferido à mão.
const FIM = '(?![\\p{L}\\p{N}_])';
const APRESENTACAO = new RegExp(
  `(?:^|[.!?;:]\\s+)[^\\p{L}\\p{N}_]*(?:eu\\s+)?sou${FIM}|\\bmeu nome (?:é|e)${FIM}|\\bme chamo${FIM}|\\bse apresente${FIM}|\\bfale em primeira pessoa como${FIM}`,
  'iu',
);
const FALE_COMO_NOME = /\b[Ff]ale como (?:o|a) [A-ZÁÉÍÓÚ]/;

/** Por que a linha não pode ser gravada (nulo = pode). */
export function motivoDeRecusa(linha: string): string | null {
  const t = linha.trim();
  if (t.length > TETO_DA_REGRA) return `Cada regra tem no máximo ${TETO_DA_REGRA} caracteres.`;
  if (APRESENTACAO.test(t) || FALE_COMO_NOME.test(t)) return MENSAGEM_DE_APRESENTACAO;
  return null;
}

// Código de imóvel do cadastro: letras e números juntos (AB01, AP0566).
const CODIGO_DE_IMOVEL = /(?:^|[^\p{L}\p{N}])\p{L}{1,4}-?\d{2,6}(?![\p{L}\p{N}])/u;

/** Aviso que não trava: valor em reais ou código de imóvel na regra. */
export function avisoDeProduto(linha: string): string | null {
  return linha.includes('R$') || CODIGO_DE_IMOVEL.test(linha) ? AVISO_DE_PRODUTO : null;
}
