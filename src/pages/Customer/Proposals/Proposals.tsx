import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Search, Plus, FileText, Building2, User, TrendingUp,
  Send, CheckCircle, XCircle, AlertCircle, RefreshCw, ChevronDown,
  DollarSign, Calendar, Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  proposalsService,
  Proposal,
  ProposalFormData,
  PROPOSAL_STATUS_LABELS,
  PROPOSAL_STATUS_COLORS,
  PROPOSAL_TYPE_LABELS,
} from '@/services/proposals/proposalsService';

function formatCurrency(value?: number | null): string {
  if (value == null) return '-';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(iso?: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('pt-BR');
}

interface ProposalFormState {
  property_id: string;
  contact_id: string;
  proposal_type: 'purchase' | 'rent';
  offered_value: string;
  down_payment: string;
  installments: string;
  payment_method: string;
  conditions: string;
}

const EMPTY_FORM: ProposalFormState = {
  property_id: '',
  contact_id: '',
  proposal_type: 'purchase',
  offered_value: '',
  down_payment: '',
  installments: '',
  payment_method: '',
  conditions: '',
};

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
  const { t } = useTranslation();

  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editProposal, setEditProposal] = useState<Proposal | null>(null);
  const [form, setForm] = useState<ProposalFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [rejectModal, setRejectModal] = useState<RejectModalState>({ open: false, proposalId: '', reason: '' });
  const [counterModal, setCounterModal] = useState<CounterModalState>({ open: false, proposalId: '', value: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      const res = await proposalsService.list(params);
      setProposals(res.data);
    } catch {
      setProposals([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

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
    setForm(EMPTY_FORM);
    setEditProposal(null);
    setCreateOpen(true);
  };

  const openEdit = (proposal: Proposal) => {
    setForm({
      property_id: proposal.property_id,
      contact_id: proposal.contact_id,
      proposal_type: proposal.proposal_type,
      offered_value: proposal.offered_value?.toString() ?? '',
      down_payment: proposal.down_payment?.toString() ?? '',
      installments: proposal.installments?.toString() ?? '',
      payment_method: proposal.payment_method ?? '',
      conditions: proposal.conditions ?? '',
    });
    setEditProposal(proposal);
    setCreateOpen(true);
  };

  const handleSave = async () => {
    if (!form.property_id || !form.contact_id || !form.offered_value) return;
    setSaving(true);
    try {
      const data: ProposalFormData = {
        property_id: form.property_id,
        contact_id: form.contact_id,
        proposal_type: form.proposal_type,
        offered_value: parseFloat(form.offered_value),
        ...(form.down_payment && { down_payment: parseFloat(form.down_payment) }),
        ...(form.installments && { installments: parseInt(form.installments) }),
        ...(form.payment_method && { payment_method: form.payment_method }),
        ...(form.conditions && { conditions: form.conditions }),
      };
      if (editProposal) {
        await proposalsService.update(editProposal.id, data);
      } else {
        await proposalsService.create(data);
      }
      setCreateOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async (id: string) => {
    await proposalsService.send(id);
    load();
  };

  const handleAccept = async (id: string) => {
    await proposalsService.accept(id);
    load();
  };

  const handleWithdraw = async (id: string) => {
    await proposalsService.withdraw(id);
    load();
  };

  const handleReject = async () => {
    if (!rejectModal.reason) return;
    await proposalsService.reject(rejectModal.proposalId, rejectModal.reason);
    setRejectModal({ open: false, proposalId: '', reason: '' });
    load();
  };

  const handleCounter = async () => {
    if (!counterModal.value) return;
    await proposalsService.counter(counterModal.proposalId, parseFloat(counterModal.value));
    setCounterModal({ open: false, proposalId: '', value: '' });
    load();
  };

  const handleDelete = async (id: string) => {
    await proposalsService.delete(id);
    load();
  };

  const stats = {
    total: proposals.length,
    sent: proposals.filter(p => p.status === 'sent' || p.status === 'counter_offered').length,
    accepted: proposals.filter(p => p.status === 'accepted').length,
    totalValue: proposals.filter(p => p.status === 'accepted').reduce((s, p) => s + (p.offered_value ?? 0), 0),
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="border-b bg-card px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Propostas</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Gerencie propostas comerciais de compra e locação</p>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Proposta
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          {[
            { label: 'Total', value: stats.total, icon: FileText, color: 'text-blue-600' },
            { label: 'Em aberto', value: stats.sent, icon: Send, color: 'text-amber-600' },
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
          <div className="space-y-3">
            {filtered.map(proposal => (
              <ProposalCard
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
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editProposal ? 'Editar Proposta' : 'Nova Proposta'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>ID do Imóvel *</Label>
                <Input
                  placeholder="UUID do imóvel"
                  value={form.property_id}
                  onChange={e => setForm(f => ({ ...f, property_id: e.target.value }))}
                />
              </div>
              <div>
                <Label>ID do Lead *</Label>
                <Input
                  placeholder="UUID do contato"
                  value={form.contact_id}
                  onChange={e => setForm(f => ({ ...f, contact_id: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo *</Label>
                <Select
                  value={form.proposal_type}
                  onValueChange={(v: 'purchase' | 'rent') => setForm(f => ({ ...f, proposal_type: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="purchase">Compra</SelectItem>
                    <SelectItem value="rent">Locação</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Valor Ofertado (R$) *</Label>
                <Input
                  type="number"
                  placeholder="0,00"
                  value={form.offered_value}
                  onChange={e => setForm(f => ({ ...f, offered_value: e.target.value }))}
                />
              </div>
            </div>

            {form.proposal_type === 'purchase' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Entrada (R$)</Label>
                  <Input
                    type="number"
                    placeholder="0,00"
                    value={form.down_payment}
                    onChange={e => setForm(f => ({ ...f, down_payment: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Parcelas</Label>
                  <Input
                    type="number"
                    placeholder="360"
                    value={form.installments}
                    onChange={e => setForm(f => ({ ...f, installments: e.target.value }))}
                  />
                </div>
              </div>
            )}

            <div>
              <Label>Forma de Pagamento</Label>
              <Input
                placeholder="Ex: Financiamento bancário, FGTS..."
                value={form.payment_method}
                onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}
              />
            </div>

            <div>
              <Label>Condições / Observações</Label>
              <Textarea
                placeholder="Condições específicas da proposta..."
                value={form.conditions}
                onChange={e => setForm(f => ({ ...f, conditions: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !form.property_id || !form.contact_id || !form.offered_value}>
              {saving ? 'Salvando...' : editProposal ? 'Salvar' : 'Criar Rascunho'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Modal */}
      <Dialog open={rejectModal.open} onOpenChange={o => setRejectModal(s => ({ ...s, open: o }))}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Rejeitar Proposta</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Label>Motivo da rejeição *</Label>
            <Textarea
              placeholder="Informe o motivo..."
              value={rejectModal.reason}
              onChange={e => setRejectModal(s => ({ ...s, reason: e.target.value }))}
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
      <Dialog open={counterModal.open} onOpenChange={o => setCounterModal(s => ({ ...s, open: o }))}>
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
              onChange={e => setCounterModal(s => ({ ...s, value: e.target.value }))}
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

function ProposalCard({ proposal, onEdit, onDelete, onSend, onAccept, onReject, onWithdraw, onCounter }: ProposalCardProps) {
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
    <div className="bg-card border rounded-lg p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <Badge className={`text-xs font-medium ${statusColor}`}>{statusLabel}</Badge>
            <Badge variant="outline" className="text-xs">{typeLabel}</Badge>
            {isExpired && proposal.status === 'sent' && (
              <Badge className="text-xs bg-orange-100 text-orange-700">Expirada</Badge>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Property */}
            <div className="flex items-start gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Imóvel</p>
                <p className="text-sm font-medium truncate">
                  {proposal.property?.title ?? proposal.property_id.slice(0, 8)}
                </p>
                {proposal.property?.code && (
                  <p className="text-xs text-muted-foreground">{proposal.property.code}</p>
                )}
              </div>
            </div>

            {/* Contact */}
            <div className="flex items-start gap-2">
              <User className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Lead</p>
                <p className="text-sm font-medium">{proposal.contact?.name ?? '-'}</p>
              </div>
            </div>

            {/* Value */}
            <div className="flex items-start gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Valor ofertado</p>
                <p className="text-sm font-semibold text-foreground">{proposal.display_offered_value}</p>
                {proposal.counter_value && (
                  <p className="text-xs text-amber-600">Contra: {formatCurrency(proposal.counter_value)}</p>
                )}
              </div>
            </div>
          </div>

          {/* Dates row */}
          <div className="flex gap-4 mt-2">
            {proposal.sent_at && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Send className="h-3 w-3" />
                Enviada em {formatDate(proposal.sent_at)}
              </div>
            )}
            {proposal.expires_at && proposal.status === 'sent' && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                Expira em {formatDate(proposal.expires_at)}
              </div>
            )}
            {proposal.responded_at && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <CheckCircle className="h-3 w-3" />
                Respondida em {formatDate(proposal.responded_at)}
              </div>
            )}
          </div>

          {proposal.conditions && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{proposal.conditions}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {canSend && (
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
              <Button variant="ghost" size="sm" className="h-8 px-2">
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
      </div>
    </div>
  );
}
