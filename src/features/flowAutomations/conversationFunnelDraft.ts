// FUNIL DE CONVERSA → SEQUÊNCIA DOS MODAIS (05/10/2026).
//
// Desde a sprint 4 os funis de mensagem são fluxos do construtor (`kind:
// 'conversation'`). O disparo em massa do Funil de vendas e o Agendar envio
// continuam montando a sequência no editor de sempre (MessageSequenceEditor):
// "Usar funil" lê os blocos do funil, a partir do primeiro, e devolve os itens
// no formato do editor (SequenceDraftItem).
//
//   - "Mandar WhatsApp" com arquivo → item de foto/vídeo/documento/áudio/
//     figurinha (o texto vira legenda na foto, no vídeo e no documento; no
//     áudio e na figurinha o servidor não manda texto, então aqui também não);
//   - com contato (sem arquivo) → item de contato;
//   - só texto → item de texto;
//   - "Ação de lead" de mensagem (send_whatsapp_message, send_image…) → idem;
//   - "Esperar" → item "Aguardar" ANTES da mensagem seguinte (esperas seguidas
//     somam; espera no fim do funil não tem o que esperar e cai fora).
//
// O editor espera no máximo 10 minutos por item (e o servidor do disparo corta
// em 600 s): espera maior entra como 10 minutos, e a tela avisa.
// Bloco que não é mensagem nem espera (etiqueta, mover etapa, aviso…) não tem
// como entrar na sequência: fica de fora, e a tela avisa quantos.

import type { SequenceDraftItem } from '@/components/messaging/MessageSequenceEditor';
import type { FunnelItemKind } from '@/types/messageFunnels';
import type { FlowAutomation, FlowAutomationNode } from '@/types/flowAutomations';
import { waitTotalSeconds } from './waitTime';

/** Teto da espera de um item no editor e no servidor do disparo/agendamento. */
export const MAX_DRAFT_DELAY_SECONDS = 600;

const MEDIA_KINDS: FunnelItemKind[] = ['image', 'video', 'document', 'audio', 'sticker'];
const CAPTION_KINDS: FunnelItemKind[] = ['image', 'video', 'document'];

const LEAD_ACTION_MEDIA: Record<string, FunnelItemKind> = {
  send_image: 'image',
  send_video: 'video',
  send_document: 'document',
  send_audio: 'audio',
  send_sticker: 'sticker',
};

export interface ConversationFunnelDraft {
  items: SequenceDraftItem[];
  /** Blocos que não viram item (não são mensagem nem espera, ou tipo que esta tela não manda). */
  skipped: number;
  /** Esperas maiores que 10 minutos, que entraram como 10 minutos. */
  clampedWaits: number;
}

export interface DraftOptions {
  /** Tipos que a tela não sabe mandar (ex.: o disparo em massa não manda contato nem figurinha). */
  skipKinds?: FunnelItemKind[];
}

const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));

function draft(kind: FunnelItemKind, patch: Partial<SequenceDraftItem> = {}): SequenceDraftItem {
  return {
    uiKey: crypto.randomUUID(),
    kind,
    text_content: null,
    media_url: null,
    media_filename: null,
    media_caption: null,
    delay_seconds: 0,
    config: {},
    pendingFile: null,
    ...patch,
  };
}

/** A mensagem de um bloco, no formato do editor. Null = bloco sem mensagem pra mandar. */
function messageOf(node: FlowAutomationNode): SequenceDraftItem | null | 'other' {
  const cfg = (node.config ?? {}) as Record<string, unknown>;
  if (node.kind === 'send_whatsapp') {
    const text = str(cfg.text).trim();
    const mediaUrl = str(cfg.media_url).trim();
    const mediaKind = str(cfg.media_kind).trim() as FunnelItemKind;
    if (mediaUrl) {
      const kind: FunnelItemKind = MEDIA_KINDS.includes(mediaKind) ? mediaKind : 'document';
      return draft(kind, {
        media_url: mediaUrl,
        media_filename: str(cfg.media_filename).trim() || null,
        media_caption: CAPTION_KINDS.includes(kind) && text ? text : null,
      });
    }
    const phone = str(cfg.contact_phone).trim();
    if (phone) {
      return draft('contact', { config: { contact_name: str(cfg.contact_name).trim(), contact_phone: phone } });
    }
    return text ? draft('text', { text_content: text }) : null;
  }
  if (node.kind === 'lead_action') {
    const action = str(cfg.action_type);
    const params = (cfg.params && typeof cfg.params === 'object' ? cfg.params : {}) as Record<string, unknown>;
    if (action === 'send_whatsapp_message') {
      const text = str(params.message).trim();
      return text ? draft('text', { text_content: text }) : null;
    }
    const kind = LEAD_ACTION_MEDIA[action];
    if (kind) {
      const mediaUrl = str(params.media_url).trim();
      if (!mediaUrl) return null;
      const caption = str(params.caption ?? params.message).trim();
      return draft(kind, {
        media_url: mediaUrl,
        media_filename: str(params.file_name).trim() || null,
        media_caption: CAPTION_KINDS.includes(kind) && caption ? caption : null,
      });
    }
  }
  return 'other';
}

/**
 * Os blocos do funil, em ordem a partir do primeiro (o caminho principal: em
 * bloco de duas saídas, o "Sim"), viram os itens do editor.
 */
export function draftFromConversationFunnel(
  flow: Pick<FlowAutomation, 'initial_node_id' | 'nodes'>,
  options: DraftOptions = {},
): ConversationFunnelDraft {
  const skipKinds = new Set(options.skipKinds ?? []);
  const byId = new Map((flow.nodes ?? []).map(n => [n.id, n]));
  const items: SequenceDraftItem[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  let clampedWaits = 0;
  let pendingWait = 0;

  let current = flow.initial_node_id;
  while (current && byId.has(current) && !seen.has(current)) {
    seen.add(current);
    const node = byId.get(current)!;
    current = node.next_node_id ?? node.next_yes_node_id ?? null;

    if (node.kind === 'wait') {
      const cfg = (node.config ?? {}) as Record<string, unknown>;
      if (cfg.mode === 'date') skipped += 1; // "até a data" não cabe na sequência
      else pendingWait += waitTotalSeconds(cfg as { minutes?: unknown; seconds?: unknown });
      continue;
    }

    const message = messageOf(node);
    if (message === 'other' || (message && skipKinds.has(message.kind))) {
      skipped += 1;
      continue;
    }
    if (!message) continue; // mensagem vazia: nada sai, nem no funil

    if (pendingWait > 0 && items.length > 0) {
      if (pendingWait > MAX_DRAFT_DELAY_SECONDS) clampedWaits += 1;
      items.push(draft('delay', { delay_seconds: Math.min(pendingWait, MAX_DRAFT_DELAY_SECONDS) }));
    }
    pendingWait = 0;
    items.push(message);
  }

  return { items, skipped, clampedWaits };
}

/** O aviso depois de carregar (null = carregou tudo como estava). */
export function draftNotice(result: Pick<ConversationFunnelDraft, 'skipped' | 'clampedWaits'>): string | null {
  const parts: string[] = [];
  if (result.skipped > 0) {
    parts.push(
      result.skipped === 1
        ? '1 bloco do funil não é mensagem que dê pra mandar aqui e ficou de fora'
        : `${result.skipped} blocos do funil não são mensagens que dê pra mandar aqui e ficaram de fora`,
    );
  }
  if (result.clampedWaits > 0) {
    parts.push(
      result.clampedWaits === 1
        ? 'uma espera maior que 10 minutos entrou como 10 minutos'
        : `${result.clampedWaits} esperas maiores que 10 minutos entraram como 10 minutos`,
    );
  }
  if (!parts.length) return null;
  const text = parts.join('; ');
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}

export interface PickableFunnels {
  mine: FlowAutomation[];
  team: FlowAutomation[];
}

/**
 * Os funis que dá pra usar fora da conversa (disparo em massa, agendamento,
 * ação das Automações): ligados, com o guia terminado e não arquivados — a
 * mesma régua do "Disparar funil" na conversa. "Meus funis" × "Da equipe".
 */
export function pickableFunnels(list: FlowAutomation[] | null | undefined): PickableFunnels {
  const ready = (list ?? []).filter(f => !f.archived_at && f.is_enabled && f.guide_done !== false);
  const byName = (a: FlowAutomation, b: FlowAutomation) => a.name.localeCompare(b.name, 'pt-BR');
  return {
    mine: ready.filter(f => !f.team).sort(byName),
    team: ready.filter(f => f.team).sort(byName),
  };
}

/**
 * Quantas mensagens o funil manda: o `message_count` da lista (que não traz os
 * blocos) ou a conta dos blocos, quando vieram. Null = não dá pra saber.
 */
export function funnelMessageCount(flow: Pick<FlowAutomation, 'message_count' | 'initial_node_id' | 'nodes'>): number | null {
  if (typeof flow.message_count === 'number') return flow.message_count;
  if (!flow.nodes) return null;
  return draftFromConversationFunnel(flow).items.filter(it => it.kind !== 'delay').length;
}
