// Destaque num título do site: o cliente marca UM trecho entre asteriscos
// (`O imóvel certo pra sua *próxima fase.*`). Só o primeiro par com conteúdo vale.
export type PartesDoTitulo = { antes: string; marcado: string; depois: string };

export function partesDoTitulo(texto: string): PartesDoTitulo | null {
  const m = /\*([^*]+)\*/.exec(texto);
  if (!m) return null;
  return { antes: texto.slice(0, m.index), marcado: m[1], depois: texto.slice(m.index + m[0].length) };
}

// Clássico (e modo "nenhum"): o par some, o texto fica.
export function semAsteriscos(texto: string): string {
  const p = partesDoTitulo(texto);
  return p ? p.antes + p.marcado + p.depois : texto;
}
