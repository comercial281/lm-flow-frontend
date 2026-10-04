// Título da aba do navegador nas páginas do site (home, busca, páginas…).
// Regra única: o site público usa para o document.title e a prévia da aba do
// Meu site › Aparência usa para mostrar o mesmo texto. A ficha do imóvel tem
// título próprio ("<imóvel> · <nome do site>").
export function tituloDaAba(seoTitle: string | null | undefined, nome: string | null | undefined): string {
  return seoTitle || `${nome || 'Imóveis'} — Encontre seu imóvel`;
}
