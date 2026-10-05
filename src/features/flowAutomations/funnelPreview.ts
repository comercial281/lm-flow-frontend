// A PRÉVIA DO FUNIL na conversa (Automações · sprint 4, "Disparar funil"):
// cada mensagem e cada espera, na ordem em que vão sair, lidas dos blocos do
// fluxo a partir do primeiro. Bloco que não é mensagem nem espera aparece pelo
// nome ("Aplicar etiqueta"), pra quem dispara saber o que mais acontece.

import type { FlowAutomation, FlowAutomationNode } from '@/types/flowAutomations';
import type { FlowTemplatePreviewStep } from './templates';
import { waitTotalSeconds } from './waitTime';
import { BOOK_SOURCE, usesBook } from './book';
import { blockLabel } from './palette';

const LEAD_ACTION_MEDIA: Record<string, string> = {
  send_image: 'image', send_video: 'video', send_document: 'document', send_audio: 'audio', send_sticker: 'sticker',
};

function stepOf(node: FlowAutomationNode): FlowTemplatePreviewStep {
  const cfg = node.config ?? {};
  switch (node.kind) {
    case 'send_whatsapp': {
      const media = String(cfg.media_kind ?? '').trim();
      const contact = String(cfg.contact_name ?? '').trim() || String(cfg.contact_phone ?? '').trim();
      if (!media && contact) return { kind: 'contact', text: `Contato: ${contact}` };
      return {
        kind: 'send_whatsapp',
        ...(String(cfg.text ?? '').trim() ? { text: String(cfg.text) } : {}),
        ...(media ? { media_kind: media } : {}),
        ...(usesBook(cfg) ? { media_source: BOOK_SOURCE } : {}),
      };
    }
    case 'wait':
      return { kind: 'wait', seconds: cfg.mode === 'date' ? 0 : waitTotalSeconds(cfg) };
    case 'lead_action': {
      const action = String(cfg.action_type ?? '');
      const params = (cfg.params ?? {}) as Record<string, unknown>;
      if (action.startsWith('send_')) {
        const text = String(params.message ?? params.caption ?? params.text ?? '').trim();
        const media = LEAD_ACTION_MEDIA[action];
        return { kind: 'send_whatsapp', ...(text ? { text } : {}), ...(media ? { media_kind: media } : {}) };
      }
      return { kind: 'other', label: node.label || blockLabel(node) };
    }
    default:
      return { kind: 'other', label: node.label || blockLabel(node) };
  }
}

/** Os blocos do funil em ordem, a partir do primeiro (o caminho principal). */
export function funnelPreview(flow: Pick<FlowAutomation, 'initial_node_id' | 'nodes'>): FlowTemplatePreviewStep[] {
  const nodes = flow.nodes ?? [];
  const byId = new Map(nodes.map(n => [n.id, n]));
  const out: FlowTemplatePreviewStep[] = [];
  const seen = new Set<string>();
  let current = flow.initial_node_id;
  while (current && byId.has(current) && !seen.has(current)) {
    seen.add(current);
    const node = byId.get(current)!;
    out.push(stepOf(node));
    // Bloco de duas saídas: segue pelo "Sim"/"Respondeu" (o caminho que a prévia conta).
    current = node.next_node_id ?? node.next_yes_node_id ?? null;
  }
  return out;
}
