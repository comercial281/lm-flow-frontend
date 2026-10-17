import type { FlowNodeConfig } from '@/types/flowAutomations';

// Book pelo site (05/10/2026): no bloco Mensagem, o arquivo pode ser o book
// (PDF) do empreendimento de interesse do lead. O servidor acha o book sozinho.
// Desde o PR 8 (16/10/2026) o book é um item da sequência (`property_book`).
// `usesBook` lê só o formato antigo (sem `items`), em que `media_source`
// valendo faz `media_url` e `media_kind` serem ignorados. Bloco com `items`
// se lê pelo `messageItems.ts`: o `media_source` antigo pode ter sobrado lá.

export const BOOK_SOURCE = 'property_book';
export const BOOK_HELP = 'Pega sozinho o book (PDF) do empreendimento do lead. Acima de 16 MB vai como link.';
export const BOOK_SUMMARY = 'Manda o book do imóvel de interesse';

export const usesBook = (config: FlowNodeConfig): boolean => config.media_source === BOOK_SOURCE;
