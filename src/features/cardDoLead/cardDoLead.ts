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

// ── Card aberto pela pessoa (Contatos) ───────────────────────────────────────
// Spec 2026-10-02-fase-4-card-do-contato. Contato = cliente; cada card no funil
// = um atendimento dele (o modelo do Kenlo). De Contatos o card abre com os
// atendimentos em abinhas no topo; sem atendimento, abre "sem funil".

type ContatoParaCard = {
  id: string;
  name?: string | null;
  default_assignee?: { id: string; name: string; avatar_url?: string | null } | null;
  additional_attributes?: { lead_origin?: Record<string, unknown> } | Record<string, unknown> | null;
  created_at?: string | number;
  updated_at?: string | number;
};

/**
 * O card de quem não está em funil nenhum: o MESMO formato do card do funil, sem
 * id de card. `semFunil()` é o que o card consulta pra esconder etapa,
 * Ganho/Perdido, Conversão Meta e "Remover do funil".
 */
export function itemSemFunil(contato: ContatoParaCard, conversaId?: string | null): PipelineItem {
  const dono = contato.default_assignee;
  return {
    id: '',
    item_id: String(contato.id),
    type: 'contact',
    pipeline_id: '',
    stage_id: '',
    is_lead: true,
    created_at: contato.created_at ?? '',
    updated_at: contato.updated_at ?? '',
    contact: contato as unknown as PipelineItem['contact'],
    assignee: dono ? { id: String(dono.id), name: dono.name, avatar_url: dono.avatar_url ?? undefined } : undefined,
    lead_origin: ((contato.additional_attributes as { lead_origin?: Record<string, unknown> } | null)?.lead_origin ??
      null) as PipelineItem['lead_origin'],
    roleta: null,
    // Mesmo campo que o servidor manda no lead de formulário: a aba Conversa e
    // o botão Conversa já sabem achar a conversa por ele.
    ...(conversaId ? { whatsapp_conversation_id: conversaId } : {}),
  } as PipelineItem;
}

export function semFunil(item: PipelineItem | null | undefined): boolean {
  return !item?.id;
}

export interface Atendimento {
  item: PipelineItem;
  pipeline: { id: string; name: string };
  stages: Array<{ id: string; name: string; color: string; position: number }>;
}

const quando = (v: unknown) => {
  const n = typeof v === 'number' ? v : Date.parse(String(v ?? ''));
  return Number.isFinite(n) ? (n < 1e12 ? n * 1000 : n) : 0;
};

/**
 * Os atendimentos do contato, a partir de GET /pipelines/by_contact: um por
 * card no funil, do mais recente pro mais antigo (é o que abre primeiro).
 */
export function atendimentosDoContato(
  pipelines: Array<{ id: string; name: string; stages?: Array<{ id: string; name: string; color: string; position: number; items?: PipelineItem[] }> }>,
): Atendimento[] {
  const lista: Atendimento[] = [];
  for (const pipeline of pipelines ?? []) {
    const stages = [...(pipeline.stages ?? [])].sort((a, b) => a.position - b.position);
    for (const stage of stages) {
      for (const item of stage.items ?? []) {
        lista.push({
          item: { ...item, stage_id: item.stage_id || String(stage.id), pipeline_id: item.pipeline_id || pipeline.id },
          pipeline: { id: pipeline.id, name: pipeline.name },
          stages: stages.map(({ id, name, color, position }) => ({ id, name, color, position })),
        });
      }
    }
  }
  return lista.sort(
    (a, b) => quando(b.item.updated_at ?? b.item.entered_at) - quando(a.item.updated_at ?? a.item.entered_at),
  );
}
