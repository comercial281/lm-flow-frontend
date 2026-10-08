// Aba "Visitas e propostas" do card do lead (spec 2026-10-02, entrega 3).
// Visitas com nota e feedback; propostas com valor e status; "Registrar
// proposta" abre a mesma janela da tela de Propostas, já com o lead e o imóvel
// de interesse preenchidos. Registrar NÃO move o card de etapa (decisão do dono).
// Visita ativa (Agendada/Confirmada/Em andamento) tem "Cancelar visita", com
// motivo opcional, igual à Agenda (desde 07/10).
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { CalendarCheck, FileText, Loader2, Plus, Star, XCircle } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label as UILabel,
  Textarea,
} from '@/components/ui/ds';
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
}

const ATIVAS = new Set(['scheduled', 'confirmed', 'in_progress']);

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

export default function VisitsProposalsTab({ item, nomeExibido }: VisitsProposalsTabProps) {
  const contato = contatoDoCard(item);
  const contactId = contato?.id != null ? String(contato.id) : null;
  const pode = useCan();
  const podeCriarProposta = useFeature('proposals_create') && pode('proposals', 'create');
  const podeCancelarVisita = pode('visits', 'cancel');

  const [visitas, setVisitas] = useState<Visit[] | null>(null);
  const [propostas, setPropostas] = useState<Proposal[] | null>(null);
  const [propostasRecusadas, setPropostasRecusadas] = useState(false);
  const [registrando, setRegistrando] = useState(false);
  const [cancelando, setCancelando] = useState<Visit | null>(null);
  const [motivo, setMotivo] = useState('');
  const [salvandoCancelamento, setSalvandoCancelamento] = useState(false);

  const abrirCancelamento = (v: Visit) => {
    setMotivo('');
    setCancelando(v);
  };

  const cancelarVisita = async () => {
    if (!cancelando) return;
    setSalvandoCancelamento(true);
    try {
      const atualizada = await visitsService.cancel(cancelando.id, motivo.trim() || undefined);
      setVisitas(prev => prev?.map(v => (v.id === atualizada.id ? atualizada : v)) ?? prev);
      toast.success('Visita cancelada');
      setCancelando(null);
    } catch {
      toast.error('Não deu para cancelar a visita');
    } finally {
      setSalvandoCancelamento(false);
    }
  };

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

  useEffect(() => {
    if (!contactId) return;
    let vivo = true;
    visitsService.list({ contact_id: contactId, per_page: 50 })
      .then(res => { if (vivo) setVisitas(visitasEmOrdem(res.data ?? [])); })
      .catch(() => { if (vivo) setVisitas([]); });
    void carregarPropostas();
    return () => { vivo = false; };
  }, [contactId, carregarPropostas]);

  if (!contactId) {
    return <p className="text-sm text-muted-foreground">Este card não tem contato.</p>;
  }

  const imovelSugerido = item.primary_property
    ? { id: item.primary_property.id, title: item.primary_property.title, code: item.primary_property.code }
    : null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Visitas */}
      <section className="rounded-xl border border-border p-4 space-y-3 min-w-0">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <CalendarCheck className="h-4 w-4 text-muted-foreground" />
          Visitas
        </h4>
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
                {podeCancelarVisita && ATIVAS.has(v.status) && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800"
                    onClick={() => abrirCancelamento(v)}
                  >
                    <XCircle className="h-3.5 w-3.5 mr-1" />
                    Cancelar visita
                  </Button>
                )}
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

      <Dialog open={!!cancelando} onOpenChange={aberto => { if (!aberto) setCancelando(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar visita</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {cancelando && (
              <p className="text-sm text-muted-foreground">
                {dataHora(cancelando.scheduled_at)}
                {cancelando.property ? ` · ${[cancelando.property.code, cancelando.property.title].filter(Boolean).join(' · ')}` : ''}
              </p>
            )}
            <div>
              <UILabel>Motivo do cancelamento</UILabel>
              <Textarea
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                rows={3}
                placeholder="Opcional"
                className="mt-1 resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelando(null)}>Voltar</Button>
            <Button variant="destructive" onClick={() => void cancelarVisita()} disabled={salvandoCancelamento}>
              {salvandoCancelamento ? 'Salvando...' : 'Cancelar visita'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
