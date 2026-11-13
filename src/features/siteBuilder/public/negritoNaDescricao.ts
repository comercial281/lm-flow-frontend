/* ────────────────────────────────────────────────────────────────────────────
   Negrito na descrição do imóvel (Clássico e Moderno). A descrição vem do
   cadastro ou da importação (Kenlo) com **trecho** escrito à mão, e o site
   mostrava os asteriscos crus (bug da Moeda Forte). Só o negrito: nada de
   markdown completo e nada de HTML — os trechos voltam como texto e quem
   desenha é o React, que escapa tudo.
──────────────────────────────────────────────────────────────────────────── */

export interface TrechoDaDescricao { texto: string; negrito: boolean }

/** Par de `**` com conteúdo que não é só espaço (o `[^]` deixa o par atravessar a quebra de linha). */
const PAR = /\*\*([^]*?)\*\*/g;

export function trechosComNegrito(texto: string): TrechoDaDescricao[] {
  const trechos: TrechoDaDescricao[] = [];
  let resto = '';
  let fim = 0;
  for (const m of texto.matchAll(PAR)) {
    const dentro = m[1];
    if (!dentro.trim()) continue; // `****` e `** **` ficam como estão
    resto += texto.slice(fim, m.index);
    if (resto) trechos.push({ texto: resto, negrito: false });
    resto = '';
    trechos.push({ texto: dentro, negrito: true });
    fim = m.index! + m[0].length;
  }
  resto += texto.slice(fim);
  if (resto) trechos.push({ texto: resto, negrito: false });
  return trechos;
}

/** Parágrafos da descrição: linha em branco separa; a quebra simples fica dentro do parágrafo. */
export function paragrafosDaDescricao(texto: string): string[] {
  return texto.split(/\n[ \t]*\n\s*/).map(p => p.trim()).filter(Boolean);
}
