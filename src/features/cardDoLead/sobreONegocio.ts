// "Sobre o negócio" do card (E4): preço estimado e data de fechamento esperada.
// O preço é em reais inteiros, como o preço do imóvel (o campo guarda dígitos).

/** "450000.0" → "450000". Vazio, zero ou inválido → "". */
export function digitosDoPreco(valor: string | number | null | undefined): string {
  if (valor == null || valor === '') return '';
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 ? String(Math.round(n)) : '';
}

/** O que vai para o servidor: número em reais, ou null para limpar. */
export function precoParaEnviar(digitos: string): number | null {
  const d = digitos.replace(/\D/g, '');
  return d ? Number(d) : null;
}
