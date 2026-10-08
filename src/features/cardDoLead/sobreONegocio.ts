// "Sobre o negócio" do card (E4): preço estimado e data de fechamento esperada.
// O preço é em reais inteiros, como o preço do imóvel (o campo guarda dígitos).

/** "450000.0" → "450000". Vazio, zero ou inválido → "". */
export function digitosDoPreco(valor: string | number | null | undefined): string {
  if (valor == null || valor === '') return '';
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 ? String(Math.round(n)) : '';
}

/** O que vai para o servidor: número em reais, ou null para limpar. */
export function precoParaEnviar(texto: string): number | null {
  const d = soInteiros(texto);
  return d ? Number(d) : null;
}

/** Descarta os centavos colados ("1.234,56", "250000.0") antes de tirar o que não é dígito. */
function soInteiros(texto: string): string {
  return texto.replace(/[.,]\d{1,2}\s*$/, '').replace(/\D/g, '');
}

export const MAX_DIGITOS_DO_PRECO = 12;

/** Negativo ou grande demais: não grava, mantém o valor antigo. */
export function precoInvalido(texto: string): boolean {
  return /^\s*(R\$\s*)?-/.test(texto) || soInteiros(texto).length > MAX_DIGITOS_DO_PRECO;
}

/** Ano fora de 1900–2100 é digitação pela metade, não data de fechamento. */
export function dataValida(iso: string): boolean {
  const ano = Number(iso.slice(0, 4));
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && ano >= 1900 && ano <= 2100;
}
