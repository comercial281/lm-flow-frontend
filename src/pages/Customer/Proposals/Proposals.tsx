import React, { useState, useEffect, useCallback, useRef } from 'react';
import { formatDateBR } from '@/utils/dateUtils';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { toast } from 'sonner';
import {
  Search, Plus, FileText, Building2, User, TrendingUp,
  Send, CheckCircle, XCircle, RefreshCw, ChevronDown,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/ds';
import {
  proposalsService,
  Proposal,
  ProposalFormData,
  PROPOSAL_STATUS_LABELS,
  PROPOSAL_STATUS_COLORS,
  PROPOSAL_TYPE_LABELS,
} from '@/services/proposals/proposalsService';
import { propertiesService, Property } from '@/services/properties/propertiesService';
import { LeadCombobox } from '@/components/visits/LeadCombobox';
import { LeadPickerItem } from '@/services/visits/visitsService';
import { useFeature } from '@/contexts/TenantFeaturesContext';

function formatCurrency(value?: number | null): string {
  if (value == null) return '-';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(iso?: string | null): string {
  if (!iso) return '-';
  return formatDateBR(iso);
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
  const canCreate = useFeature('proposals_create');
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

  // Property combobox state (mirrors pattern from Visits.tsx)
  const [propertyQuery, setPropertyQuery] = useState('');
  const [propertyResults, setPropertyResults] = useState<Property[]>([]);
  const [showPropertyDropdown, setShowPropertyDropdown] = useState(false);
  const [propertySearching, setPropertySearching] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const propertyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const propertyWrapperRef = useRef<HTMLDivElement | null>(null);

  // Lead combobox state
  const [selectedLead, setSelectedLead] = useState<LeadPickerItem | null>(null);

  // Close property dropdown on outside click
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (propertyWrapperRef.current && !propertyWrapperRef.current.contains(e.target as Node)) {
        setShowPropertyDropdown(false);
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const searchProperties = (q: string) => {
    setPropertyQuery(q);
    if (propertyTimeout.current) clearTimeout(propertyTimeout.current);
    if (!q.trim()) { setPropertyResults([]); setShowPropertyDropdown(false); return; }
    setPropertySearching(true);
    propertyTimeout.current = setTimeout(async () => {
      try {
        const res = await propertiesService.list({ q, per_page: 8 });
        setPropertyResults(res.data ?? []);
        setShowPropertyDropdown(true);
      } catch { setPropertyResults([]); }
      finally { setPropertySearching(false); }
    }, 300);
  };

  const selectProperty = (p: Property) => {
    setSelectedProperty(p);
    setForm(f => ({ ...f, property_id: p.id }));
    setPropertyQuery(p.title);
    setShowPropertyDropdown(false);
  };

  const handleLeadChange = (lead: LeadPickerItem) => {
    setSelectedLead(lead);
    setForm(f => ({ ...f, contact_id: lead.id }));
  };

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
    setSelectedProperty(null);
    setSelectedLead(null);
    setPropertyQuery('');
    setPropertyResults([]);
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
    setSelectedProperty(proposal.property ? { id: proposal.property.id, title: proposal.property.title, code: proposal.property.code } as Property : null);
    setSelectedLead(proposal.contact ? { id: proposal.contact.id, name: proposal.contact.name } as LeadPickerItem : null);
    setPropertyQuery(proposal.property?.title ?? '');
    setCreateOpen(true);
  };

  const handleSave = async () => {
    if (!form.property_id) { toast.error('Selecione um imóvel'); return; }
    if (!form.contact_id) { toast.error('Selecione um lead'); return; }
    if (!form.offered_value) { toast.error('Informe o valor ofertado'); return; }
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
        toast.success('Proposta atualizada');
      } else {
        await proposalsService.create(data);
        toast.success('Rascunho criado');
      }
      setCreateOpen(false);
      load();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Erro ao salvar proposta'));
    } finally {
      setSaving(false);
    }
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
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editProposal ? 'Editar Proposta' : 'Nova Proposta'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Property combobox */}
            <div className="relative" ref={propertyWrapperRef}>
              <Label>Imóvel *</Label>
              <div className="relative mt-1">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Buscar imóvel por título, código ou bairro..."
                  value={propertyQuery}
                  onChange={e => searchProperties(e.target.value)}
                  onFocus={() => { if (propertyResults.length) setShowPropertyDropdown(true); }}
                  className="pl-9"
                />
                {propertySearching && (
                  <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
                )}
              </div>
              {showPropertyDropdown && propertyResults.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-64 overflow-y-auto">
                  {propertyResults.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      className="w-full text-left px-3 py-2.5 hover:bg-muted/50 border-b border-border last:border-0"
                      onClick={() => selectProperty(p)}
                    >
                      <div className="font-medium text-sm truncate">{p.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {[p.code, p.address_neighborhood, p.address_city].filter(Boolean).join(' · ') || '—'}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {selectedProperty && (
                <div className="text-xs text-muted-foreground mt-1">
                  Selecionado: <span className="font-medium text-foreground">{selectedProperty.code}</span> · {selectedProperty.title}
                </div>
              )}
            </div>

            {/* Lead combobox */}
            <LeadCombobox
              value={selectedLead}
              onChange={handleLeadChange}
              label="Lead *"
              placeholder="Buscar lead ou contato por nome/telefone..."
            />

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
      </td>
    </tr>
  );
}
