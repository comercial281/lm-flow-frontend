import type { FlowNodeConfig } from '@/types/flowAutomations';

// Book pelo site (05/10/2026): no "Enviar WhatsApp", o arquivo pode ser o book
// (PDF) do empreendimento de interesse do lead. O servidor acha o book sozinho;
// com `media_source` valendo, `media_url` e `media_kind` são ignorados.

export const BOOK_SOURCE = 'property_book';
export const BOOK_LABEL = 'Book do imóvel de interesse';
export const BOOK_HELP = 'Pega sozinho o book (PDF) do empreendimento do lead. Acima de 16 MB vai como link.';
export const BOOK_SUMMARY = 'Manda o book do imóvel de interesse';

export const usesBook = (config: FlowNodeConfig): boolean => config.media_source === BOOK_SOURCE;

/**
 * Liga ou desliga o book. Ligar zera o arquivo (chave com texto vazio, e não
 * apagada: no modo guiado o servidor junta o que chega com o que está gravado).
 */
export function withBook(config: FlowNodeConfig, on: boolean): FlowNodeConfig {
  if (on) return { ...config, media_source: BOOK_SOURCE, media_url: '', media_kind: '', media_filename: '' };
  return { ...config, media_source: '' };
}
