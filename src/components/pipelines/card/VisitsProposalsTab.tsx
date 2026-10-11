// Aba "Visitas e propostas" do card do lead (spec 2026-10-02, entrega 3).
// Visitas com nota e feedback; propostas com valor e status; "Registrar
// proposta" abre a mesma janela da tela de Propostas, já com o lead e o imóvel
// de interesse preenchidos. Registrar NÃO move o card de etapa (decisão do dono).
// Visita: Nova visita no topo e os botões da peça única AcoesDaVisita (desde 10/10).
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck, FileText, Loader2, Plus, Star } from 'lucide-react';
import { Button } from '@/components/ui/ds';
import { ScheduleVisitDialog } from '@/components/visits/ScheduleVisitDialog';
import { AcoesDaVisita } from '@/features/visits/AcoesDaVisita';
import ProposalFormDialog from '@/components/proposals/ProposalFormDialog';
import { visitsService, VISIT_STATUS_COLORS, VISIT_STATUS_LABELS, type Visit } from '@/services/visits/visitsService';
import {
  proposalsService,
  PROPOSAL_STATUS_COLORS,
  PROPOSAL_STATUS_LABELS,
  PROPOSAL_TYPE_LABELS,
  type Proposal,
} from '@/services/proposals/proposalsService';
import { isForbiddenError } from '@/services/core/forbidden';
import { useFeature } from '@/contexts/TenantFeaturesContext';
import { useCan } from '@/hooks/useCan';
import { dinheiro } from '@/lib/formato';
import { contatoDoCard, leadParaVisita, visitaSemFeedback, visitasEmOrdem } from '@/features/cardDoLead/cardDoLead';
import type { PipelineItem } from '@/types/analytics';

interface VisitsProposalsTabProps {
  item: PipelineItem;
  nomeExibido: string;
  // Sobe quando outra parte da tela cria visita (Ações rápidas do modal): a aba recarrega.
  versao?: string | number;
}

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

export default function VisitsProposalsTab({ item, nomeExibido, versao = 0 }: VisitsProposalsTabProps) {
  const contato = contatoDoCard(item);
  const contactId = contato?.id != null ? String(contato.id) : null;
  const pode = useCan();
  const podeCriarProposta = useFeature('proposals_create') && pode('proposals', 'create');
  const podeCriarVisita = pode('visits', 'create');

  const [visitas, setVisitas] = useState<Visit[] | null>(null);
  const [propostas, setPropostas] = useState<Proposal[] | null>(null);
  const [propostasRecusadas, setPropostasRecusadas] = useState(false);
  const [registrando, setRegistrando] = useState(false);
  const [agendando, setAgendando] = useState(false);
  const carga = useRef(0);

  const carregarPropostas = useCallback(async () => {
    if (!contactId) return;
    try {
      const res = await proposalsService.list({ contact_id: contactId });
      setPropostas(res.data);
    } catch (e) {
      setPropostas([]);
      // Sem permissão de ver propostas: a seção some, as visitas ficam.
      if (isForbiddenError(e)) setPropostasRecusadas(true);
    }
  }, [contactId]);

  // Só a última carga vale: respostas antigas que chegam atrasadas são descartadas.
  const carregarVisitas = useCallback(async () => {
    if (!contactId) return;
    const minha = ++carga.current;
    try {
      const res = await visitsService.list({ contact_id: contactId, per_page: 50 });
      if (carga.current === minha) setVisitas(visitasEmOrdem(res.data ?? []));
    } catch {
      if (carga.current === minha) setVisitas(prev => prev ?? []);
    }
  }, [contactId]);

  useEffect(() => {
    void carregarVisitas();
    void carregarPropostas();
    return () => { carga.current++; };
  }, [carregarVisitas, carregarPropostas, versao]);

  if (!contactId) {
    return <p className="text-sm text-muted-foreground">Este card não tem contato.</p>;
  }

  const imovelSugerido = item.primary_property
    ? { id: item.primary_property.id, title: item.primary_property.title, code: item.primary_property.code }
    : null;

  // A janela de visita pede título e código preenchidos; o de proposta aceita vazio.
  const imovelParaVisita = imovelSugerido
    ? { id: imovelSugerido.id, title: imovelSugerido.title ?? '', code: imovelSugerido.code ?? '' }
    : null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Visitas */}
      <section className="rounded-xl border border-border p-4 space-y-3 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-muted-foreground" />
            Visitas
          </h4>
          {podeCriarVisita && (
            <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setAgendando(true)}>
              <Plus className="h-3.5 w-3.5" />
              Nova visita
            </Button>
          )}
        </div>
        {visitas === null ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : visitas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma visita com este lead ainda.</p>
        ) : (
          <ul className="space-y-3">
            {visitas.map(v => (
              <li key={v.id} className="rounded-lg border border-border/60 p-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium">{dataHora(v.scheduled_at)}</span>
                  <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded font-medium ${VISIT_STATUS_COLORS[v.status] ?? ''}`}>
                    {VISIT_STATUS_LABELS[v.status] ?? v.status}
                  </span>
                </div>
                {v.property && (
                  <p className="text-sm text-muted-foreground truncate" title={v.property.title}>
                    {[v.property.code, v.property.title].filter(Boolean).join(' · ')}
                  </p>
                )}
                {v.realtor?.name && <p className="text-xs text-muted-foreground">Corretor: {v.realtor.name}</p>}
                {v.rating != null && (
                  <p className="text-sm flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> Nota {v.rating}
                  </p>
                )}
                {v.feedback_notes?.trim() && <p className="text-sm whitespace-pre-wrap break-words">{v.feedback_notes}</p>}
                {visitaSemFeedback(v) && (
                  <p className="text-xs font-medium text-amber-600 dark:text-amber-400">Sem feedback</p>
                )}
                <AcoesDaVisita visita={v} onAtualizada={() => void carregarVisitas()} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Propostas */}
      {!propostasRecusadas && (
        <section className="rounded-xl border border-border p-4 space-y-3 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Propostas
            </h4>
            <Link
              to={`/proposals?contact_id=${encodeURIComponent(contactId)}&nome=${encodeURIComponent(nomeExibido)}`}
              className="text-xs text-primary hover:underline"
            >
              Abrir em Propostas
            </Link>
          </div>
          {propostas === null ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : propostas.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma proposta deste lead. Quando ele fizer uma oferta, registre aqui.
            </p>
          ) : (
            <ul className="space-y-3">
              {propostas.map(p => (
                <li key={p.id} className="rounded-lg border border-border/60 p-3 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                      {p.display_offered_value || dinheiro(p.offered_value)}
                    </span>
                    <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded font-medium ${PROPOSAL_STATUS_COLORS[p.status] ?? ''}`}>
                      {PROPOSAL_STATUS_LABELS[p.status] ?? p.status}
                    </span>
                  </div>
                  {p.property && (
                    <p className="text-sm text-muted-foreground truncate" title={p.property.title}>
                      {[p.property.code, p.property.title].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {PROPOSAL_TYPE_LABELS[p.proposal_type] ?? p.proposal_type}
                    {p.counter_value ? ` · contraproposta ${dinheiro(p.counter_value)}` : ''}
                    {p.created_at ? ` · ${dataHora(p.created_at)}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {podeCriarProposta && (
            <Button type="button" variant="outline" className="w-full gap-1.5" onClick={() => setRegistrando(true)}>
              <Plus className="h-4 w-4" />
              Registrar proposta
            </Button>
          )}
        </section>
      )}

      <ScheduleVisitDialog
        open={agendando}
        onOpenChange={setAgendando}
        leadInicial={leadParaVisita(item, nomeExibido)}
        imovelInicial={imovelParaVisita}
        onCreated={() => void carregarVisitas()}
      />

      <ProposalFormDialog
        open={registrando}
        onOpenChange={setRegistrando}
        leadInicial={leadParaVisita(item, nomeExibido)}
        imovelInicial={imovelSugerido}
        pipelineItemId={item.id || null}
        onSaved={() => { void carregarPropostas(); }}
      />
    </div>
  );
}
