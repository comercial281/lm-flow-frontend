import { useState, useEffect, useCallback } from 'react';
import {
  Search, RefreshCw, CheckCircle, XCircle, Building2, User,
  Phone, Mail, MapPin, DollarSign, ChevronDown, ClipboardList,
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
  propertyCaptureRequestsService,
  PropertyCaptureRequest,
  CAPTURE_STATUS_LABELS,
  CAPTURE_STATUS_COLORS,
} from '@/services/propertyCaptureRequests/propertyCaptureRequestsService';
import { TRANSACTION_TYPE_LABELS, PROPERTY_TYPE_LABELS } from '@/services/properties/propertiesService';

const STATUS_TABS = [
  { key: '', label: 'Todas' },
  { key: 'pending_review', label: 'Aguardando' },
  { key: 'assigned', label: 'Designadas' },
  { key: 'approved', label: 'Aprovadas' },
  { key: 'rejected', label: 'Rejeitadas' },
];

function formatCurrency(v?: number | null) {
  if (!v) return null;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR');
}

export default function PropertyCaptureRequests() {
  const [requests, setRequests] = useState<PropertyCaptureRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending_review');
  const [search, setSearch] = useState('');
  const [rejectModal, setRejectModal] = useState<{ open: boolean; id: string; reason: string }>({
    open: false, id: '', reason: '',
  });
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      const res = await propertyCaptureRequestsService.list(params);
      setRequests(res.data);
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const filtered = requests.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.owner.name?.toLowerCase().includes(q) ||
      r.owner.phone?.toLowerCase().includes(q) ||
      r.address.city?.toLowerCase().includes(q) ||
      r.address.full?.toLowerCase().includes(q)
    );
  });

  const handleApprove = async (id: string) => {
    setActing(id);
    try {
      await propertyCaptureRequestsService.approve(id);
      load();
    } finally {
      setActing(null);
    }
  };

  const handleReject = async () => {
    setActing(rejectModal.id);
    try {
      await propertyCaptureRequestsService.reject(rejectModal.id, rejectModal.reason);
      setRejectModal({ open: false, id: '', reason: '' });
      load();
    } finally {
      setActing(null);
    }
  };

  const stats = {
    pending: requests.filter(r => r.status === 'pending_review').length,
    approved: requests.filter(r => r.status === 'approved' || r.status === 'converted').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="border-b bg-card px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ClipboardList className="h-6 w-6 text-primary" />
              Solicitações de Captação
            </h1>
            <p className="text-sm text-muted-foreground">Imóveis submetidos para análise e captação</p>
          </div>
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
            <p className="text-xs text-amber-700 dark:text-amber-400">Aguardando análise</p>
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{stats.pending}</p>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3">
            <p className="text-xs text-emerald-700 dark:text-emerald-400">Aprovadas</p>
            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{stats.approved}</p>
          </div>
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
            <p className="text-xs text-red-700 dark:text-red-400">Rejeitadas</p>
            <p className="text-2xl font-bold text-red-700 dark:text-red-400">{stats.rejected}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por proprietário, cidade..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-1">
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

      {/* List */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground">
            <RefreshCw className="h-5 w-5 animate-spin mr-2" />
            Carregando...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
            <ClipboardList className="h-10 w-10 opacity-30" />
            <p className="font-medium">Nenhuma solicitação encontrada</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(req => (
              <CaptureRequestCard
                key={req.id}
                request={req}
                acting={acting}
                onApprove={() => handleApprove(req.id)}
                onReject={() => setRejectModal({ open: true, id: req.id, reason: '' })}
              />
            ))}
          </div>
        )}
      </div>

      {/* Reject Modal */}
      <Dialog open={rejectModal.open} onOpenChange={o => setRejectModal(s => ({ ...s, open: o }))}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Rejeitar Solicitação</DialogTitle>
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
            <Button variant="outline" onClick={() => setRejectModal({ open: false, id: '', reason: '' })}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={!rejectModal.reason || !!acting}>
              Rejeitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CaptureRequestCard({
  request: r,
  acting,
  onApprove,
  onReject,
}: {
  request: PropertyCaptureRequest;
  acting: string | null;
  onApprove: () => void;
  onReject: () => void;
}) {
  const statusColor = CAPTURE_STATUS_COLORS[r.status] ?? '';
  const statusLabel = CAPTURE_STATUS_LABELS[r.status] ?? r.status;
  const canAct = r.status === 'pending_review' || r.status === 'assigned';
  const isActing = acting === r.id;

  return (
    <div className="bg-card border rounded-lg p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <Badge className={`text-xs ${statusColor}`}>{statusLabel}</Badge>
            <Badge variant="outline" className="text-xs">
              {TRANSACTION_TYPE_LABELS[r.transaction_type] ?? r.transaction_type}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {PROPERTY_TYPE_LABELS[r.property_type] ?? r.property_type}
            </Badge>
            <span className="text-xs text-muted-foreground ml-auto">{formatDate(r.created_at)}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Owner */}
            <div className="space-y-1">
              {r.owner.name && (
                <div className="flex items-center gap-1 text-sm">
                  <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="font-medium truncate">{r.owner.name}</span>
                </div>
              )}
              {r.owner.phone && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Phone className="h-3 w-3 shrink-0" />
                  {r.owner.phone}
                </div>
              )}
              {r.owner.email && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Mail className="h-3 w-3 shrink-0" />
                  <span className="truncate">{r.owner.email}</span>
                </div>
              )}
            </div>

            {/* Address */}
            <div className="flex items-start gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="text-sm">
                {r.address.full && <p className="truncate">{r.address.full}</p>}
                {r.address.city && (
                  <p className="text-xs text-muted-foreground">
                    {r.address.city}{r.address.state && `, ${r.address.state}`}
                  </p>
                )}
                {r.address.cep && <p className="text-xs text-muted-foreground">CEP: {r.address.cep}</p>}
              </div>
            </div>

            {/* Details */}
            <div className="space-y-1">
              {r.expected_price && (
                <div className="flex items-center gap-1 text-sm font-semibold text-primary">
                  <DollarSign className="h-3.5 w-3.5 shrink-0" />
                  {formatCurrency(r.expected_price)}
                </div>
              )}
              <div className="flex gap-3 text-xs text-muted-foreground">
                {r.bedrooms && <span>{r.bedrooms} qts</span>}
                {r.bathrooms && <span>{r.bathrooms} ban</span>}
                {r.useful_area_m2 && <span>{r.useful_area_m2}m²</span>}
              </div>
              {r.property_id && (
                <p className="text-xs text-emerald-600 font-medium">
                  Imóvel criado
                </p>
              )}
            </div>
          </div>

          {r.description && (
            <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{r.description}</p>
          )}
          {r.rejection_reason && (
            <p className="text-xs text-red-600 mt-1">Motivo: {r.rejection_reason}</p>
          )}
        </div>

        {/* Actions */}
        {canAct && (
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              className="gap-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-700"
              onClick={onApprove}
              disabled={isActing}
            >
              <CheckCircle className="h-3 w-3" />
              Aprovar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1 h-8 text-xs text-destructive hover:text-destructive"
              onClick={onReject}
              disabled={isActing}
            >
              <XCircle className="h-3 w-3" />
              Rejeitar
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
