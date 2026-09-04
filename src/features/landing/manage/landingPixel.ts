/**
 * Rastreio (Pixel Meta) de uma landing de anúncio: o que está gravado e como a
 * janela *Destino do lead* lê isso.
 *
 * O formato ANTIGO tinha quatro caixinhas de liga/desliga e os nomes dos eventos
 * eram fixos no código da página. Agora o gestor escolhe o nome de cada momento —
 * e a landing que ninguém reabriu precisa continuar disparando exatamente o que
 * dispara hoje. É isso que `readPixelSettings` garante, com a MESMA regra que o
 * servidor usa para servir a página pública (ver Capi::LandingPixel no lm-flow):
 * trocar o nome de um evento em produção zera o aprendizado da campanha que roda
 * em cima dele.
 */

export type PixelMode = 'off' | 'crm' | 'custom';

/** Os nomes que a página disparava antes de o gestor poder escolher. Os dois de
 *  qualificação não são eventos padrão da Meta — eram eventos personalizados. */
export const LEGACY_EVENT_NAMES = {
  submit: 'Lead',
  qualified: 'LeadQualificado',
  disqualified: 'LeadDesqualificado',
} as const;

export interface PixelForm {
  mode: PixelMode;
  /** Só vale no modo `custom`; no modo `crm` o pixel vem de Automações → Pixel e CAPI. */
  pixelId: string;
  pageView: boolean;
  /** Nome do evento, ou '' para "não dispara nada neste momento". */
  submitEvent: string;
  qualifiedEvent: string;
  disqualifiedEvent: string;
}

interface StoredEvents {
  page_view?: boolean;
  // formato novo
  submit_event?: string | null;
  qualified_event?: string | null;
  disqualified_event?: string | null;
  // formato antigo (booleanos)
  lead?: boolean;
  qualified?: boolean;
  disqualified?: boolean;
}

export interface StoredPixel {
  mode?: string;
  pixel_id?: string | null;
  events?: StoredEvents;
}

const MODES: PixelMode[] = ['off', 'crm', 'custom'];

/** Lê o que está gravado na landing. Formato antigo é traduzido para os mesmos
 *  nomes que a página disparava — inclusive o desqualificado, que nascia
 *  DESMARCADO. Sem pixel nenhum é `off`: "campo vazio" sempre significou "não
 *  rastreia" aqui, e virar isso em "usa o pixel do CRM" ligaria rastreio em
 *  landing que ninguém configurou. */
export function readPixelSettings(stored: StoredPixel | null | undefined): PixelForm {
  const raw = stored ?? {};
  const ev = raw.events ?? {};
  const declared = (raw.mode ?? '') as PixelMode;
  const mode: PixelMode = MODES.includes(declared)
    ? declared
    : (raw.pixel_id ?? '').trim()
      ? 'custom'
      : 'off';

  const pick = (
    novo: keyof StoredEvents,
    antigo: keyof StoredEvents,
    nome: string,
    ligadoPorPadrao: boolean,
  ): string => {
    if (novo in ev) return (ev[novo] as string | null | undefined)?.trim() ?? '';
    const antes = ev[antigo] as boolean | undefined;
    return (antes ?? ligadoPorPadrao) ? nome : '';
  };

  return {
    mode,
    pixelId: (raw.pixel_id ?? '').trim(),
    pageView: ev.page_view !== false,
    submitEvent: pick('submit_event', 'lead', LEGACY_EVENT_NAMES.submit, true),
    qualifiedEvent: pick('qualified_event', 'qualified', LEGACY_EVENT_NAMES.qualified, true),
    disqualifiedEvent: pick('disqualified_event', 'disqualified', LEGACY_EVENT_NAMES.disqualified, false),
  };
}

/** O que vai para o servidor. Grava sempre no formato novo, explícito: a partir
 *  daqui não há mais nome de evento escondido no código da página. */
export function writePixelSettings(form: PixelForm): StoredPixel {
  return {
    mode: form.mode,
    pixel_id: form.mode === 'custom' ? form.pixelId.trim() || null : null,
    events: {
      page_view: form.pageView,
      submit_event: form.submitEvent || null,
      qualified_event: form.qualifiedEvent || null,
      disqualified_event: form.disqualifiedEvent || null,
    },
  };
}

/** O pixel que vai ser usado de verdade — é ele que o botão *Testar conexão*
 *  precisa perguntar à Meta, e não o que está digitado no campo escondido. */
export function effectivePixelId(form: PixelForm, crmPixelId: string | null): string {
  if (form.mode === 'off') return '';
  if (form.mode === 'custom') return form.pixelId.trim();
  return (crmPixelId ?? '').trim();
}
