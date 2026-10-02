// Regras do card do lead em tela única (spec 2026-10-02-fase-4-card-do-lead).
// Funções puras: os componentes do card só desenham o que sai daqui.

import { SOURCE_META } from '@/features/leadOrigin/origem';
import { normalizeFormAnswers, extraAttributeRows, type FormAnswerRow } from '@/components/pipelines/formAnswers';
import type { PipelineItem } from '@/types/analytics';
import type { LeadPickerItem, Visit } from '@/services/visits/visitsService';

type ContatoDoCard = {
  id?: string | number;
  name?: string | null;
  phone_number?: string | null;
  email?: string | null;
  custom_attributes?: Record<string, unknown> | null;
  additional_attributes?: Record<string, unknown> | null;
  identity_correctable?: boolean;
};

/** Quantas respostas do formulário aparecem antes do "ver todas". */
export const RESPOSTAS_VISIVEIS = 4;

/** O contato do card: direto (lead de formulário) ou pela conversa. */
export function contatoDoCard(item: PipelineItem | null | undefined): ContatoDoCard | null {
  if (!item) return null;
  const direto = item.contact as ContatoDoCard | undefined;
  const daConversa = (item.conversation as { contact?: ContatoDoCard } | undefined)?.contact;
  return direto ?? daConversa ?? null;
}

/**
 * A conversa de WhatsApp do lead: a do card, ou a que o servidor achou para o
 * lead de formulário (`whatsapp_conversation_id`).
 */
export function conversaDoCard(item: PipelineItem | null | undefined): string | null {
  if (!item) return null;
  const solto = item as unknown as { conversation_id?: string | number; whatsapp_conversation_id?: string | number };
  const id = item.conversation?.id ?? solto.conversation_id ?? solto.whatsapp_conversation_id;
  return id != null && id !== '' ? String(id) : null;
}

/**
 * Lápis de telefone/e-mail: quem decide é o servidor (`identity_correctable` no
 * contato serializado — só gestor, só em lead cadastrado à mão). Sem o campo,
 * travado: é o lado seguro.
 */
export function podeCorrigirContato(contato: ContatoDoCard | null | undefined): boolean {
  return contato?.identity_correctable === true;
}

/**
 * Respostas do formulário do lead, sem repetir a pergunta que o servidor
 * espelha solta no contato (ver formAnswers.ts).
 */
export function respostasDoLead(contato: ContatoDoCard | null | undefined): FormAnswerRow[] {
  const ca = (contato?.custom_attributes ?? {}) as Record<string, unknown>;
  const respostas = normalizeFormAnswers(ca.form_answers);
  return [...respostas, ...extraAttributeRows(ca, respostas)];
}

// Ordem de preferência do detalhe que acompanha a origem numa linha só.
const DETALHE_DA_ORIGEM = ['campaign_name', 'landing_name', 'portal', 'site', 'bolsao_lista', 'manual_origin', 'inbox_name'];

/**
 * Origem numa linha, para a coluna fixa: "📋 Formulário Meta Ads · Vista Mar".
 * O detalhe completo continua na aba Origem. Sem origem conhecida → null.
 */
export function origemCurta(origem: Record<string, unknown> | null | undefined): string | null {
  if (!origem) return null;
  const source = typeof origem.source === 'string' ? origem.source : '';
  const rotulo = SOURCE_META[source]?.label ?? null;
  const detalhe = DETALHE_DA_ORIGEM
    .map(k => origem[k])
    .find((v): v is string => typeof v === 'string' && v.trim() !== '');
  if (!rotulo && !detalhe) return null;
  if (source === 'unknown' && !detalhe) return null;
  return [rotulo, detalhe?.trim()].filter(Boolean).join(' · ');
}

/** Cor do selo da origem (a mesma régua da aba Origem). Sem origem conhecida, neutro. */
export function classeDaOrigem(origem: Record<string, unknown> | null | undefined): string {
  const source = typeof origem?.source === 'string' ? origem.source : '';
  return SOURCE_META[source]?.cls ?? 'bg-muted text-muted-foreground';
}

/** O lead do card no formato que o modal de visita da Agenda entende. */
export function leadParaVisita(item: PipelineItem, nomeExibido: string): LeadPickerItem | null {
  const contato = contatoDoCard(item);
  if (!contato?.id) return null;
  return {
    id: String(contato.id),
    name: nomeExibido,
    phone_number: contato.phone_number ?? null,
    email: contato.email ?? null,
    in_pipeline: true,
    pipeline_id: item.pipeline_id ?? null,
    owner: item.assignee ? { id: String(item.assignee.id), name: item.assignee.name } : null,
  };
}

// Visita que já aconteceu (ou devia ter acontecido) pede o retorno do corretor.
const STATUS_SEM_FEEDBACK_ESPERADO = new Set(['cancelled', 'rescheduled']);

/**
 * "Sem feedback": a hora da visita já passou, ela não foi cancelada nem
 * remarcada, e ninguém registrou nota nem comentário. É o que a aba Visitas e
 * propostas destaca para o corretor completar.
 */
export function visitaSemFeedback(visita: Pick<Visit, 'status' | 'scheduled_at' | 'rating' | 'feedback_notes'>, agora: Date = new Date()): boolean {
  if (STATUS_SEM_FEEDBACK_ESPERADO.has(visita.status)) return false;
  const quando = new Date(visita.scheduled_at);
  if (Number.isNaN(quando.getTime()) || quando > agora) return false;
  return visita.rating == null && !visita.feedback_notes?.trim();
}

/** Visitas da mais recente para a mais antiga. */
export function visitasEmOrdem<T extends { scheduled_at: string }>(visitas: T[]): T[] {
  return [...visitas].sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());
}
