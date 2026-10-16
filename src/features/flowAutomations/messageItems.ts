import type { FlowNodeConfig } from '@/types/flowAutomations';
import type { SequenceDraftItem, SequenceItemKind } from '@/components/messaging/MessageSequenceEditor';
import { BOOK_SOURCE } from './book';

// Redesenho do construtor, PR 8 (16/10/2026): o bloco Mensagem (`send_whatsapp`)
// guarda uma sequência em `config.items`. Este arquivo é o espelho do
// `FlowAutomations::MessageItems` do servidor (PR 7): o leitor único do bloco.
// O bloco antigo, sem `items`, é lido como sequência de UM item, montado dos
// campos soltos na mesma ordem do servidor: book > mídia > contato > texto.
// Com `items` não vazio, o servidor ignora os campos soltos.

/** Um item como fica gravado (o mesmo formato do servidor). */
export interface StoredMessageItem {
  id: string;
  kind: SequenceItemKind;
  text_content?: string;
  media_url?: string;
  media_filename?: string;
  media_caption?: string;
  delay_seconds?: number;
  config?: {
    contact_name?: string;
    contact_phone?: string;
    random_interval?: boolean;
    min_seconds?: number;
    max_seconds?: number;
    [key: string]: unknown;
  };
}

/** Id do item montado do formato antigo. Fixo: o desenho de novo não troca a chave. */
export const LEGACY_ITEM_ID = 'legado';

const MEDIA_KINDS: SequenceItemKind[] = ['image', 'video', 'audio', 'document', 'sticker'];
const isMediaKind = (kind: SequenceItemKind) => MEDIA_KINDS.includes(kind);

const str = (value: unknown): string => (typeof value === 'string' ? value : '');
const filled = (value: unknown): boolean => str(value).trim() !== '';

function legacyItem(config: FlowNodeConfig): StoredMessageItem {
  const text = str(config.text);
  if (config.media_source === BOOK_SOURCE) {
    return { id: LEGACY_ITEM_ID, kind: 'property_book', media_caption: text };
  }
  if (filled(config.media_url)) {
    const mediaKind = str(config.media_kind).trim() as SequenceItemKind;
    return {
      id: LEGACY_ITEM_ID,
      kind: isMediaKind(mediaKind) ? mediaKind : 'document',
      media_url: str(config.media_url),
      media_filename: str(config.media_filename),
      media_caption: text,
    };
  }
  if (filled(config.contact_phone)) {
    return {
      id: LEGACY_ITEM_ID,
      kind: 'contact',
      config: { contact_name: str(config.contact_name), contact_phone: str(config.contact_phone) },
    };
  }
  return { id: LEGACY_ITEM_ID, kind: 'text', text_content: text };
}

/**
 * O bloco já guarda a sequência (`items` não vazio). Sem isso é o formato
 * antigo, que os leitores de antes (e o `usesBook`) continuam lendo.
 */
export function hasStoredItems(config: FlowNodeConfig): boolean {
  return Array.isArray(config.items) && config.items.length > 0;
}

/** Os itens do bloco: `items`, ou um item montado do formato antigo. */
export function itemsOf(config: FlowNodeConfig): StoredMessageItem[] {
  if (hasStoredItems(config)) return config.items as StoredMessageItem[];
  return [legacyItem(config)];
}

/**
 * Quanto a espera de dentro do bloco segura, em segundos. Com sorteio, o maior
 * tempo possível (a prévia e o "Usar funil" contam o pior caso).
 */
export function delayItemSeconds(item: StoredMessageItem): number {
  const seconds = item.config?.random_interval ? item.config.max_seconds : item.delay_seconds;
  return Math.max(0, Math.round(Number(seconds) || 0));
}

/** Os itens que mandam algo (sem as esperas). */
export function messageItemsOf(config: FlowNodeConfig): StoredMessageItem[] {
  return itemsOf(config).filter(item => item.kind !== 'delay');
}

function itemHasContent(item: StoredMessageItem): boolean {
  if (item.kind === 'delay') return false;
  if (item.kind === 'property_book') return true;
  if (item.kind === 'contact') return filled(item.config?.contact_phone);
  if (item.kind === 'text') return filled(item.text_content);
  // Mídia: com arquivo, vale; sem arquivo, a legenda sai como texto (igual ao servidor).
  return filled(item.media_url) || filled(item.media_caption);
}

/** Algum item manda alguma coisa. */
export function hasMessageContent(config: FlowNodeConfig): boolean {
  return itemsOf(config).some(itemHasContent);
}

/** Algum item tem arquivo. */
export function hasMessageMedia(config: FlowNodeConfig): boolean {
  return itemsOf(config).some(item => filled(item.media_url));
}

/** Itens no formato do editor. `uiKey` = `id` (o modo guiado do servidor casa por id). */
export function draftsOf(config: FlowNodeConfig): SequenceDraftItem[] {
  return itemsOf(config).map((item, index) => ({
    // Item sem id não deveria existir; a chave de reserva é fixa pra não remontar o cartão a cada desenho.
    uiKey: item.id || `item-${index}`,
    kind: item.kind,
    text_content: item.kind === 'text' ? item.text_content ?? '' : item.text_content ?? null,
    media_url: item.media_url || null,
    media_filename: item.media_filename || null,
    media_caption: item.media_caption ?? null,
    delay_seconds: item.delay_seconds ?? (item.kind === 'delay' ? 30 : 0),
    config: { ...(item.config ?? {}) },
    pendingFile: null,
  }));
}

function storedOf(draft: SequenceDraftItem): StoredMessageItem {
  const base = { id: draft.uiKey, kind: draft.kind };
  switch (draft.kind) {
    case 'text':
      return { ...base, text_content: draft.text_content ?? '' };
    case 'property_book':
      return { ...base, media_caption: draft.media_caption ?? '' };
    case 'contact':
      return {
        ...base,
        config: { contact_name: str(draft.config.contact_name), contact_phone: str(draft.config.contact_phone) },
      };
    case 'delay':
      return { ...base, delay_seconds: draft.delay_seconds, config: { ...draft.config } };
    default:
      return {
        ...base,
        media_url: draft.media_url ?? '',
        media_filename: draft.media_filename ?? '',
        media_caption: draft.media_caption ?? '',
      };
  }
}

/**
 * Grava a sequência em `items`. Os campos soltos de conteúdo ficam com texto
 * vazio, e não apagados: no modo guiado o servidor junta o que chega com o que
 * está gravado. `media_source`, "por qual número sai" e o progresso não mudam.
 */
export function withItems(config: FlowNodeConfig, drafts: SequenceDraftItem[]): FlowNodeConfig {
  return {
    ...config,
    text: '',
    media_url: '',
    media_kind: '',
    media_filename: '',
    contact_name: '',
    contact_phone: '',
    items: drafts.map(storedOf),
  };
}
