// Aba Origem do card do lead: de onde ele veio (anúncio, formulário, landing,
// portal, manual) e a origem escrita à mão, que é o único campo corrigível.
// Saiu de dentro do EditItemModal sem mudar o que aparece.
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/ds';
import { ManualOriginInput } from '@/components/shared/ManualOriginInput';
import { MANUAL_ORIGIN_KEY } from '@/constants/manualLeadOrigin';
import { normalizeFormAnswers, landingVerdict } from '@/components/pipelines/formAnswers';
import { SOURCE_META } from '@/features/leadOrigin/origem';
import type { PipelineItem } from '@/types/analytics';

interface CardOriginTabProps {
  item: PipelineItem;
  manualOrigin: string;
  onManualOriginChange: (v: string) => void;
  savedManualOrigin: string;
  savingManualOrigin: boolean;
  onSaveManualOrigin: () => void;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function CardOriginTab({
  item,
  manualOrigin,
  onManualOriginChange,
  savedManualOrigin,
  savingManualOrigin,
  onSaveManualOrigin,
}: CardOriginTabProps) {
  const ar = (item as any).lead_origin
    ?? ((item.contact as any)?.additional_attributes?.ad_referral)
    ?? ((item.conversation as any)?.additional_attributes?.ad_referral)
    ?? {};
  const LABELS: Record<string, string> = {
    source: 'Origem', campaign_name: 'Campanha', adset_name: 'Conjunto', ad_name: 'Anúncio',
    campaign_id: 'ID da campanha', adset_id: 'ID do conjunto', ad_id: 'ID do anúncio',
    form_id: 'ID do formulário', page_id: 'ID da página', page_name: 'Página', leadgen_id: 'ID do lead (Meta)',
    lead_name: 'Nome', lead_email: 'E-mail', lead_phone: 'Telefone',
    lead_hour: 'Hora do lead', lead_weekday: 'Dia da semana',
    captured_at: 'Capturado em', fb_created_at: 'Criado no Facebook', lead_created_time: 'Data do lead',
    // Click-to-WhatsApp (anúncio FB/Instagram → zap)
    title: 'Anúncio', body: 'Descrição do anúncio', source_app: 'Plataforma',
    source_url: 'Link do anúncio', source_id: 'ID do anúncio', source_type: 'Tipo',
    ctwa_clid: 'ID do clique', thumbnail_url: 'Imagem do anúncio',
    // Landing Page
    landing_name: 'Landing', landing_slug: 'Nome na URL', landing_url: 'Link da landing',
    // Origem universal (manual / orgânico / tracking interno)
    inbox_name: 'Número de WhatsApp', added_by_name: 'Adicionado por',
    // Bolsão: de qual planilha o lead saiu. Vive separado do texto de
    // origem informada porque aquele é editável — reescrever "veio por
    // indicação" apagava a rastreabilidade da lista.
    bolsao_lista: 'Lista do Bolsão',
    // Portal e formulário do site: o nome de qual portal/site trouxe o lead.
    portal: 'Portal', site: 'Site',
  };
  // manual_origin sai da lista genérica: tem campo editável próprio no topo.
  // bolsao_batch_id/bolsao_lead_id são identificadores internos: quem
  // lê o card quer o NOME da lista, que sai em bolsao_lista.
  const HIDDEN = new Set(['thumbnail_url', 'source', 'entered_via', 'added_by_id', 'channel_type',
    'bolsao_batch_id', 'bolsao_lead_id', 'reclassificado', MANUAL_ORIGIN_KEY]);
  const source = (ar as any).source as string | undefined;
  const meta = source ? SOURCE_META[source] : undefined;
  const entries = Object.entries(ar).filter(([k, v]) => k !== 'extra_fields' && !HIDDEN.has(k) && v != null && v !== '');
  // Respostas do formulário Meta: o backend grava o hash completo de
  // respostas em custom_attributes.form_answers (antes só nome/email/telefone
  // eram aproveitados). Le tambem additional_attributes por compat com leads
  // gravados na versao anterior. Fallback pro extra_fields legado.
  const formAnswers = (item.contact as any)?.custom_attributes?.form_answers
    ?? (item.contact as any)?.additional_attributes?.form_answers
    ?? (item.conversation as any)?.custom_attributes?.form_answers
    ?? (item.conversation as any)?.additional_attributes?.form_answers;
  // A landing manda as perguntas dentro de UMA chave, como lista, com os
  // cookies do anúncio soltos ao lado — cru, isso virava "[object Object]"
  // por pergunta. A normalização entende os dois formatos e vale também
  // para o lead que já foi capturado. Ver formAnswers.ts.
  const extraRows = normalizeFormAnswers((ar as Record<string, unknown>).extra_fields);
  const answerRows = extraRows.length > 0 ? extraRows : normalizeFormAnswers(formAnswers);
  // Resultado da régua da landing, gravado no card na captura.
  const verdict = landingVerdict(item.custom_fields);
  const hasTrackedData = entries.length > 0 || answerRows.length > 0 || !!meta || !!verdict;
  return (
    <div className="space-y-4">
      {(meta || verdict) && (
        <div className="flex flex-wrap items-center gap-2">
          {meta && (
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${meta.cls}`}>
              <span>{meta.label}</span>
            </div>
          )}
          {/* Resultado da régua do formulário: sem ele, as respostas
              não dizem se o lead passou no corte configurado. */}
          {verdict && (
            <div
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                verdict.approved
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
              }`}
            >
              <span>{verdict.label}{verdict.score != null ? ` · nota ${verdict.score}` : ''}</span>
            </div>
          )}
        </div>
      )}

      {/* Origem por escrito — o rastreamento automático só sabe de
          anúncio/campanha; "veio por indicação" quem informa é o time. */}
      <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-3">
        <ManualOriginInput
          id={`manual-origin-${item.id}`}
          value={manualOrigin}
          onChange={onManualOriginChange}
          disabled={savingManualOrigin}
        />
        <div className="flex items-center justify-end gap-2">
          {manualOrigin.trim() !== savedManualOrigin && (
            <span className="text-xs text-muted-foreground">Alteração não salva</span>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7"
            disabled={savingManualOrigin || manualOrigin.trim() === savedManualOrigin}
            onClick={onSaveManualOrigin}
          >
            {savingManualOrigin && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            Salvar origem
          </Button>
        </div>
      </div>

      {!hasTrackedData && (
        <div className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border rounded-lg">
          Sem dados de rastreamento automático para este lead.
        </div>
      )}

      <div className="grid gap-2">
        {entries.map(([k, v]) => (
          <div key={k} className="flex items-start justify-between gap-3 text-sm border-b border-border/50 pb-1.5">
            <span className="text-muted-foreground shrink-0">{LABELS[k] ?? k.replace(/_/g, ' ')}</span>
            <span className="text-right font-medium break-all">{String(v)}</span>
          </div>
        ))}
      </div>
      {answerRows.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground mb-1.5">Respostas do formulário</h4>
          <div className="grid gap-2">
            {answerRows.map((row, i) => (
              <div key={`${row.label}-${i}`} className="flex items-start justify-between gap-3 text-sm border-b border-border/50 pb-1.5">
                <span className="text-muted-foreground shrink-0 capitalize">{row.label}</span>
                <span className="text-right font-medium break-all">{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
