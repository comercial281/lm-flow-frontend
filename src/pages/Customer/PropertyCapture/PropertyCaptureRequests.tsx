import { useState, useEffect, useCallback } from 'react';
import { formatDateBR } from '@/utils/dateUtils';
import {
  Search, RefreshCw, CheckCircle, XCircle, ClipboardList,
  Clock, ThumbsUp, Ban,
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
  Label,
  Textarea,
} from '@/components/ui/ds';
import {
  propertyCaptureRequestsService,
  PropertyCaptureRequest,
  CAPTURE_STATUS_LABELS,
  CAPTURE_STATUS_COLORS,
} from '@/services/propertyCaptureRequests/propertyCaptureRequestsService';
import { TRANSACTION_TYPE_LABELS, PROPERTY_TYPE_LABELS } from '@/services/properties/propertiesService';
import { useFeature } from '@/contexts/TenantFeaturesContext';

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
  return formatDateBR(iso);
}

function prettySource(s?: string | null): string {
  if (!s) return '-';
  return s.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function initials(name?: string | null): string {
  if (!name) return '?';
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || '?';
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
  const canApprove = useFeature('property_capture_approve');

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
      {/* Cabeçalho estilo protótipo */}
      <div className="border-b bg-card px-6 py-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-start gap-3">
            <div
              className="w-1 h-9 rounded-full shrink-0"
              style={{ background: 'linear-gradient(to bottom, #7c3aed, #9333ea)' }}
            />
            <div>
              <h1 className="text-2xl font-bold text-foreground leading-tight">Captação</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Prospecção de proprietários e imóveis pra abastecer o catálogo
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={load} className="h-8 gap-1 text-xs">
            <RefreshCw className="h-3.5 w-3.5" />
            Atualizar
          </Button>
        </div>

        {/* KPIs estilo dark card do protótipo */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <StatCard icon={Clock} label="Aguardando análise" value={stats.pending} tint="rgba(249,115,22,0.14)" color="text-orange-400" iconBg="bg-orange-500/15" />
          <StatCard icon={ThumbsUp} label="Aprovadas" value={stats.approved} tint="rgba(16,185,129,0.14)" color="text-emerald-400" iconBg="bg-emerald-500/15" />
          <StatCard icon={Ban} label="Rejeitadas" value={stats.rejected} tint="rgba(239,68,68,0.14)" color="text-red-400" iconBg="bg-red-500/15" />
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por proprietário, cidade..."
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

      {/* Tabela */}
      <div className="flex-1 overflow-auto px-6 py-5">
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
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="font-medium px-4 py-3">Proprietário</th>
                    <th className="font-medium px-4 py-3">Imóvel</th>
                    <th className="font-medium px-4 py-3">Origem</th>
                    <th className="font-medium px-4 py-3">Preço pedido</th>
                    <th className="font-medium px-4 py-3">Status</th>
                    <th className="font-medium px-4 py-3">Recebido</th>
                    <th className="font-medium px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(req => (
                    <CaptureRow
                      key={req.id}
                      request={req}
                      acting={acting}
                      canApprove={canApprove}
                      onApprove={() => handleApprove(req.id)}
                      onReject={() => setRejectModal({ open: true, id: req.id, reason: '' })}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal de rejeição */}
      <Dialog open={rejectModal.open} onOpenChange={(o: boolean) => setRejectModal(s => ({ ...s, open: o }))}>
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

function StatCard({
  icon: Icon, label, value, tint, color, iconBg,
}: {
  icon: React.ElementType; label: string; value: number; tint: string; color: string; iconBg: string;
}) {
  return (
    <div
      className="relative flex flex-col gap-2 rounded-xl border bg-card/60 p-4 overflow-hidden"
      style={{ borderColor: 'rgba(255,255,255,0.06)' }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full blur-2xl"
        style={{ background: tint }}
      />
      <div className="flex items-center gap-2 relative">
        <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${iconBg}`}>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
      </div>
      <p className={`text-3xl font-bold tracking-tight leading-none ${color} relative`}>{value}</p>
    </div>
  );
}

function CaptureRow({
  request: r,
  acting,
  canApprove,
  onApprove,
  onReject,
}: {
  request: PropertyCaptureRequest;
  acting: string | null;
  canApprove: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const statusColor = CAPTURE_STATUS_COLORS[r.status] ?? '';
  const statusLabel = CAPTURE_STATUS_LABELS[r.status] ?? r.status;
  const canAct = r.status === 'pending_review' || r.status === 'assigned';
  const isActing = acting === r.id;

  const propertyLine = [
    PROPERTY_TYPE_LABELS[r.property_type] ?? r.property_type,
    r.address.city,
  ].filter(Boolean).join(' · ');

  return (
    <tr className="border-t border-border/60 hover:bg-muted/20 transition-colors align-top">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="inline-flex items-center justify-center w-8 h-8 rounded-full shrink-0 text-xs font-semibold text-violet-300 bg-violet-500/15 border border-violet-500/20">
            {initials(r.owner.name)}
          </div>
          <div className="min-w-0">
            <div className="font-medium truncate">{r.owner.name || 'Sem nome'}</div>
            {r.owner.phone && <div className="text-xs text-muted-foreground truncate">{r.owner.phone}</div>}
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="min-w-0 max-w-[260px]">
          <div className="truncate" title={r.address.full || undefined}>{propertyLine || '-'}</div>
          <div className="flex items-center gap-1.5 mt-1">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {TRANSACTION_TYPE_LABELS[r.transaction_type] ?? r.transaction_type}
            </Badge>
            {(r.bedrooms || r.useful_area_m2) && (
              <span className="text-[11px] text-muted-foreground">
                {r.bedrooms ? `${r.bedrooms} qts` : ''}{r.bedrooms && r.useful_area_m2 ? ' · ' : ''}{r.useful_area_m2 ? `${r.useful_area_m2}m²` : ''}
              </span>
            )}
          </div>
          {r.property_id && <div className="text-[11px] text-emerald-500 mt-0.5">Imóvel criado</div>}
        </div>
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{prettySource(r.source)}</td>
      <td className="px-4 py-3 whitespace-nowrap font-medium">
        {formatCurrency(r.expected_price) ?? <span className="text-muted-foreground">—</span>}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          <Badge className={`text-xs w-fit ${statusColor}`}>{statusLabel}</Badge>
          {r.rejection_reason && (
            <span className="text-[11px] text-red-500 max-w-[160px] truncate" title={r.rejection_reason}>
              {r.rejection_reason}
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">{formatDate(r.created_at)}</td>
      <td className="px-4 py-3">
        {canAct ? (
          <div className="flex items-center justify-end gap-1.5">
            {canApprove && (
              <Button
                size="sm"
                className="gap-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-700"
                onClick={onApprove}
                disabled={isActing}
              >
                <CheckCircle className="h-3 w-3" />
                Aprovar
              </Button>
            )}
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
        ) : (
          <div className="text-right text-xs text-muted-foreground">—</div>
        )}
      </td>
    </tr>
  );
}
