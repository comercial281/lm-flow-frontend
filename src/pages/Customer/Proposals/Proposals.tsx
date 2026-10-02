import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { formatDateBR } from '@/utils/dateUtils';
import { toast } from 'sonner';
import {
  Search, Plus, FileText, Building2, User, TrendingUp,
  Send, CheckCircle, XCircle, RefreshCw, ChevronDown, X,
} from 'lucide-react';
import {
  Button,
  Input,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Label,
  Textarea,
} from '@/components/ui/ds';
import {
  proposalsService,
  Proposal,
  PROPOSAL_STATUS_LABELS,
  PROPOSAL_STATUS_COLORS,
  PROPOSAL_TYPE_LABELS,
} from '@/services/proposals/proposalsService';
import ProposalFormDialog from '@/components/proposals/ProposalFormDialog';
import { useFeature } from '@/contexts/TenantFeaturesContext';
import NoAccessState from '@/components/permissions/NoAccessState';
import { isForbiddenError } from '@/services/core/forbidden';
import { dinheiro } from '@/lib/formato';
import { lerFiltroPropostas, type FiltroDoLink } from '@/features/dashboard/links';
import { ChipDaDashboard } from '@/features/dashboard/ChipDaDashboard';
import IconActionButton from '@/components/base/IconActionButton';

function formatCurrency(value?: number | null): string {
  return dinheiro(value);
}

function formatDate(iso?: string | null): string {
  if (!iso) return '-';
  return formatDateBR(iso);
}

const STATUS_TABS = [
  { key: '', label: 'Todas' },
  { key: 'draft', label: 'Rascunhos' },
  { key: 'sent', label: 'Enviadas' },
  { key: 'counter_offered', label: 'Contra-propostas' },
  { key: 'accepted', label: 'Aceitas' },
  { key: 'rejected', label: 'Rejeitadas' },
];

interface RejectModalState { open: boolean; proposalId: string; reason: string }
interface CounterModalState { open: boolean; proposalId: string; value: string }

export default function Proposals() {
  const canCreate = useFeature('proposals_create');
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editProposal, setEditProposal] = useState<Proposal | null>(null);
  const [rejectModal, setRejectModal] = useState<RejectModalState>({ open: false, proposalId: '', reason: '' });
  const [counterModal, setCounterModal] = useState<CounterModalState>({ open: false, proposalId: '', value: '' });
  const [recusado, setRecusado] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();
  // Filtro de período que veio de um clique na Dashboard (?desde=&ate=). Lido uma vez ao abrir.
  const [periodoLink, setPeriodoLink] = useState<FiltroDoLink | null>(() => lerFiltroPropostas(searchParams));
  // Filtro de um lead que veio do card dele ("Abrir em Propostas": ?contact_id=&nome=).
  const [leadDoLink, setLeadDoLink] = useState<{ id: string; nome: string } | null>(() => {
    const id = searchParams.get('contact_id');
    return id ? { id, nome: searchParams.get('nome') || 'este lead' } : null;
  });

  const load = useCallback(async () => {
    setLoading(true);
    setRecusado(false);
    try {
      const params: Record<string, string> = { ...(periodoLink?.params ?? {}) };
      if (leadDoLink) params.contact_id = leadDoLink.id;
      if (statusFilter) params.status = statusFilter;
      const res = await proposalsService.list(params);
      setProposals(res.data);
    } catch (e) {
      setProposals([]);
      if (isForbiddenError(e)) setRecusado(true);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, periodoLink, leadDoLink]);

  useEffect(() => { load(); }, [load]);

  const filtered = proposals.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.property?.title?.toLowerCase().includes(q) ||
      p.property?.code?.toLowerCase().includes(q) ||
      p.contact?.name?.toLowerCase().includes(q) ||
      p.display_offered_value?.toLowerCase().includes(q)
    );
  });

  const openCreate = () => {
    setEditProposal(null);
    setCreateOpen(true);
  };

  const openEdit = (proposal: Proposal) => {
    setEditProposal(proposal);
    setCreateOpen(true);
  };

  const handleSend = async (id: string) => {
    try {
      await proposalsService.send(id);
      toast.success('Proposta enviada — WhatsApp disparado pro lead');
      load();
    } catch {
      toast.error('Erro ao enviar proposta');
    }
  };

  const handleAccept = async (id: string) => {
    try {
      await proposalsService.accept(id);
      toast.success('Proposta aceita');
      load();
    } catch {
      toast.error('Erro ao aceitar');
    }
  };

  const handleWithdraw = async (id: string) => {
    try {
      await proposalsService.withdraw(id);
      toast.success('Proposta marcada como desistência');
      load();
    } catch {
      toast.error('Erro ao registrar desistência');
    }
  };

  const handleReject = async () => {
    if (!rejectModal.reason) return;
    try {
      await proposalsService.reject(rejectModal.proposalId, rejectModal.reason);
      toast.success('Proposta rejeitada');
      setRejectModal({ open: false, proposalId: '', reason: '' });
      load();
    } catch {
      toast.error('Erro ao rejeitar');
    }
  };

  const handleCounter = async () => {
    if (!counterModal.value) return;
    try {
      await proposalsService.counter(counterModal.proposalId, parseFloat(counterModal.value));
      toast.success('Contra-proposta enviada');
      setCounterModal({ open: false, proposalId: '', value: '' });
      load();
    } catch {
      toast.error('Erro ao enviar contra-proposta');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await proposalsService.delete(id);
      toast.success('Proposta excluída');
      load();
    } catch {
      toast.error('Erro ao excluir');
    }
  };

  const stats = {
    total: proposals.length,
    sent: proposals.filter(p => p.status === 'sent' || p.status === 'counter_offered').length,
    accepted: proposals.filter(p => p.status === 'accepted').length,
    totalValue: proposals.filter(p => p.status === 'accepted').reduce((s, p) => s + (p.offered_value ?? 0), 0),
  };

  if (recusado) return <NoAccessState />;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="border-b bg-card px-6 py-4">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-start gap-3">
            <div
              className="w-1 h-9 rounded-full shrink-0"
              style={{ background: 'linear-gradient(to bottom, #7c3aed, #9333ea)' }}
            />
            <div>
              <h1 className="text-2xl font-bold text-foreground leading-tight">Propostas</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Propostas comerciais de compra e locação</p>
            </div>
          </div>
          {canCreate && (
            <Button onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Proposta
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {[
            { label: 'Total', value: stats.total, icon: FileText, color: 'text-blue-600' },
            { label: 'Em aberto', value: stats.sent, icon: Send, color: 'text-orange-600' },
            { label: 'Aceitas', value: stats.accepted, icon: CheckCircle, color: 'text-emerald-600' },
            { label: 'Volume fechado', value: formatCurrency(stats.totalValue), icon: TrendingUp, color: 'text-violet-600' },
          ].map(s => (
            <div key={s.label} className="bg-muted/50 rounded-lg p-3 flex items-center gap-3">
              <s.icon className={`h-5 w-5 ${s.color}`} />
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-lg font-semibold">{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por imóvel, lead, valor..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            {STATUS_TABS.map(tab => (
              <Button
                key={tab.key}
                variant={statusFilter === tab.key ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(tab.key)}
                className="text-xs h-8"
              >
                {tab.label}
              </Button>
            ))}
          </div>
          {leadDoLink && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 py-0.5 pl-2.5 pr-0.5 text-xs font-medium text-primary">
              Só de {leadDoLink.nome}
              <IconActionButton
                label="Ver as propostas de todos"
                variant="ghost"
                onClick={() => { setLeadDoLink(null); setSearchParams({}, { replace: true }); }}
                className="size-6 rounded-full text-primary hover:bg-primary/15 hover:text-primary"
                icon={<X className="h-3.5 w-3.5" aria-hidden />}
              />
            </span>
          )}
          {periodoLink && (
            <ChipDaDashboard
              rotulo={periodoLink.rotulo}
              onTirar={() => { setPeriodoLink(null); setSearchParams({}, { replace: true }); }}
            />
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground">
            <RefreshCw className="h-5 w-5 animate-spin mr-2" />
            Carregando...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
            <FileText className="h-10 w-10 opacity-30" />
            <p className="font-medium">Nenhuma proposta encontrada</p>
            <Button variant="outline" size="sm" onClick={openCreate}>Criar primeira proposta</Button>
          </div>
        ) : (
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="font-medium px-4 py-3">Cliente</th>
                    <th className="font-medium px-4 py-3">Imóvel</th>
                    <th className="font-medium px-4 py-3">Valor</th>
                    <th className="font-medium px-4 py-3">Enviada</th>
                    <th className="font-medium px-4 py-3">Validade</th>
                    <th className="font-medium px-4 py-3">Status</th>
                    <th className="font-medium px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(proposal => (
                    <ProposalRow
                      key={proposal.id}
                      proposal={proposal}
                      onEdit={() => openEdit(proposal)}
                      onDelete={() => handleDelete(proposal.id)}
                      onSend={() => handleSend(proposal.id)}
                      onAccept={() => handleAccept(proposal.id)}
                      onReject={() => setRejectModal({ open: true, proposalId: proposal.id, reason: '' })}
                      onWithdraw={() => handleWithdraw(proposal.id)}
                      onCounter={() => setCounterModal({ open: true, proposalId: proposal.id, value: '' })}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <ProposalFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        proposta={editProposal}
        onSaved={load}
      />

      {/* Reject Modal */}
      <Dialog open={rejectModal.open} onOpenChange={(o: boolean) => setRejectModal(s => ({ ...s, open: o }))}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Rejeitar Proposta</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Label>Motivo da rejeição *</Label>
            <Textarea
              placeholder="Informe o motivo..."
              value={rejectModal.reason}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setRejectModal(s => ({ ...s, reason: e.target.value }))}
              rows={3}
              className="mt-1"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectModal({ open: false, proposalId: '', reason: '' })}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={!rejectModal.reason}>
              Rejeitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Counter Modal */}
      <Dialog open={counterModal.open} onOpenChange={(o: boolean) => setCounterModal(s => ({ ...s, open: o }))}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>Enviar Contra-proposta</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Label>Valor da contra-proposta (R$) *</Label>
            <Input
              type="number"
              placeholder="0,00"
              value={counterModal.value}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCounterModal(s => ({ ...s, value: e.target.value }))}
              className="mt-1"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCounterModal({ open: false, proposalId: '', value: '' })}>
              Cancelar
            </Button>
            <Button onClick={handleCounter} disabled={!counterModal.value}>
              Enviar Contra-proposta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface ProposalCardProps {
  proposal: Proposal;
  onEdit: () => void;
  onDelete: () => void;
  onSend: () => void;
  onAccept: () => void;
  onReject: () => void;
  onWithdraw: () => void;
  onCounter: () => void;
}

function ProposalRow({ proposal, onEdit, onDelete, onSend, onAccept, onReject, onWithdraw, onCounter }: ProposalCardProps) {
  const canSendFeature = useFeature('proposals_send');
  const statusColor = PROPOSAL_STATUS_COLORS[proposal.status] ?? '';
  const statusLabel = PROPOSAL_STATUS_LABELS[proposal.status] ?? proposal.status;
  const typeLabel = PROPOSAL_TYPE_LABELS[proposal.proposal_type] ?? proposal.proposal_type;
  const isExpired = proposal.expires_at && new Date(proposal.expires_at) < new Date();
  const canEdit = proposal.status === 'draft';
  const canSend = proposal.status === 'draft';
  const canAcceptOrReject = proposal.status === 'sent' || proposal.status === 'counter_offered';
  const canWithdraw = !['accepted', 'rejected', 'withdrawn', 'expired'].includes(proposal.status);
  const canCounter = proposal.status === 'sent';

  return (
    <tr className="border-t border-border/60 hover:bg-muted/20 transition-colors align-top">
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5 font-medium min-w-0">
          <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="truncate max-w-[160px]">{proposal.contact?.name ?? '-'}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5 min-w-0 max-w-[220px]">
          <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="truncate" title={proposal.property?.title ?? undefined}>
            {proposal.property?.title ?? proposal.property_id.slice(0, 8)}
          </span>
        </div>
        {proposal.property?.code && (
          <div className="text-[11px] text-muted-foreground mt-0.5 pl-5">{proposal.property.code}</div>
        )}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="font-semibold">{proposal.display_offered_value}</div>
        {proposal.counter_value && (
          <div className="text-[11px] text-orange-500">Contra: {formatCurrency(proposal.counter_value)}</div>
        )}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
        {proposal.sent_at ? formatDate(proposal.sent_at) : '—'}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
        {proposal.expires_at && proposal.status === 'sent' ? formatDate(proposal.expires_at) : '—'}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge className={`text-xs font-medium w-fit ${statusColor}`}>{statusLabel}</Badge>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{typeLabel}</Badge>
          </div>
          {isExpired && proposal.status === 'sent' && (
            <Badge className="text-[10px] w-fit bg-orange-100 text-orange-700">Expirada</Badge>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1.5">
          {canSend && canSendFeature && (
            <Button size="sm" variant="outline" className="gap-1 h-8 text-xs" onClick={onSend}>
              <Send className="h-3 w-3" />
              Enviar
            </Button>
          )}
          {canAcceptOrReject && (
            <>
              <Button size="sm" className="gap-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={onAccept}>
                <CheckCircle className="h-3 w-3" />
                Aceitar
              </Button>
              {canCounter && (
                <Button size="sm" variant="outline" className="gap-1 h-8 text-xs" onClick={onCounter}>
                  <RefreshCw className="h-3 w-3" />
                  Contra
                </Button>
              )}
              <Button size="sm" variant="outline" className="gap-1 h-8 text-xs text-destructive hover:text-destructive" onClick={onReject}>
                <XCircle className="h-3 w-3" />
                Rejeitar
              </Button>
            </>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 px-2" aria-label="Mais ações" title="Mais ações">
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canEdit && <DropdownMenuItem onClick={onEdit}>Editar rascunho</DropdownMenuItem>}
              {canWithdraw && <DropdownMenuItem onClick={onWithdraw}>Marcar desistência</DropdownMenuItem>}
              {proposal.status === 'draft' && (
                <DropdownMenuItem onClick={onDelete} className="text-destructive">
                  Excluir
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </td>
    </tr>
  );
}
