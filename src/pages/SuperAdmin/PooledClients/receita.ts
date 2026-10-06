// Valor em reais digitado na tela (receita do cliente, preço do plano).
// '' → null (sem valor); '1500', '1500,5', '1.500,00', '1500.00' → número;
// qualquer outra coisa → undefined (inválido: a tela trava o salvar e diz o porquê).
// O servidor recusa separador de milhar, então a tela normaliza e manda número.
const MILHAR = /^\d{1,3}(\.\d{3})+(,\d{1,2})?$/;
const SIMPLES = /^\d+([.,]\d{1,2})?$/;

export function lerReais(texto: string): number | null | undefined {
  const t = texto.trim();
  if (t === '') return null;
  if (MILHAR.test(t)) return Number(t.replace(/\./g, '').replace(',', '.'));
  if (SIMPLES.test(t)) return Number(t.replace(',', '.'));
  return undefined;
}
