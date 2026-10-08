// "Sobre o negócio" do card (E4): preço estimado e data de fechamento esperada.
// O preço é em reais inteiros, como o preço do imóvel (o campo guarda dígitos).
import type { PipelineItem } from '@/types/analytics';

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

/** Colunas novas do CSV do funil (spec do funil §5.3), no fim das que já existem. */
export const COLUNAS_DO_NEGOCIO_NO_CSV = ['preco_estimado', 'fechamento_esperado'] as const;

/**
 * Preço cru (a planilha soma) e data dd/mm/aaaa; vazio quando não há.
 * Preço zero ou inválido sai vazio (mesma régua de `digitosDoPreco`).
 * A data "AAAA-MM-DD" é trocada de lugar como texto: passar por `Date` deslocaria um dia pelo fuso.
 */
export function camposDoNegocioNoCsv(
  item: Pick<PipelineItem, 'estimated_value' | 'expected_close_on'>,
): { preco_estimado: string; fechamento_esperado: string } {
  const iso = item.expected_close_on ?? '';
  return {
    preco_estimado: digitosDoPreco(item.estimated_value) ? String(item.estimated_value) : '',
    fechamento_esperado: dataValida(iso) ? iso.split('-').reverse().join('/') : '',
  };
}
