import { useState, useEffect, useCallback } from 'react';
import { formatDateBR } from '@/utils/dateUtils';
import { toast } from 'sonner';
import {
  FileCheck, Search, ExternalLink, RefreshCw, Building2, User, AlertTriangle,
} from 'lucide-react';
import { Button, Input, Badge } from '@/components/ui/ds';
import {
  contractsService,
  Contract,
  CONTRACT_STATUS_LABELS,
  CONTRACT_STATUS_COLORS,
} from '@/services/contracts/contractsService';

const STATUS_TABS = [
  { key: '', label: 'Todos' },
  { key: 'generating', label: 'Gerando' },
  { key: 'awaiting_signature', label: 'Aguardando assinatura' },
  { key: 'signed', label: 'Assinados' },
  { key: 'error', label: 'Erro' },
];

function formatDate(iso?: string | null): string {
  if (!iso) return '-';
  return formatDateBR(iso);
}

export default function Contracts() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      const res = await contractsService.list(params);
      setContracts(res.data);
    } catch {
      setContracts([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const filtered = contracts.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.proposal?.contact?.name?.toLowerCase().includes(q) ||
      c.proposal?.property?.title?.toLowerCase().includes(q)
    );
  });

  const handleRegenerate = async (proposalId: string) => {
    try {
      await contractsService.generate(proposalId);
      toast.success('Geração de contrato reiniciada');
      setTimeout(load, 1500);
    } catch {
      toast.error('Erro ao gerar contrato');
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="border-b bg-card px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Contratos</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Contratos gerados a partir de propostas aceitas — assinatura eletrônica via Autentique
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por lead ou imóvel..."
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
          <Button variant="ghost" size="sm" onClick={load} className="h-8 gap-1 text-xs ml-auto">
            <RefreshCw className="h-3.5 w-3.5" />
            Atualizar
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground">
            <RefreshCw className="h-5 w-5 animate-spin mr-2" />
            Carregando...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
            <FileCheck className="h-10 w-10 opacity-30" />
            <p className="font-medium">Nenhum contrato encontrado</p>
            <p className="text-xs">Contratos são gerados automaticamente quando uma proposta é aceita.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(contract => (
              <ContractCard
                key={contract.id}
                contract={contract}
                onRegenerate={() => handleRegenerate(contract.proposal_id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ContractCard({ contract, onRegenerate }: { contract: Contract; onRegenerate: () => void }) {
  const statusColor = CONTRACT_STATUS_COLORS[contract.status] ?? '';
  const statusLabel = CONTRACT_STATUS_LABELS[contract.status] ?? contract.status;

  return (
    <div className="bg-card border rounded-lg p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <Badge className={`text-xs font-medium ${statusColor}`}>{statusLabel}</Badge>
            {contract.proposal?.proposal_type && (
              <Badge variant="outline" className="text-xs">
                {contract.proposal.proposal_type === 'purchase' ? 'Compra' : 'Locação'}
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-start gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Imóvel</p>
                <p className="text-sm font-medium truncate">{contract.proposal?.property?.title ?? '-'}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <User className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Lead</p>
                <p className="text-sm font-medium">{contract.proposal?.contact?.name ?? '-'}</p>
              </div>
            </div>
          </div>

          {contract.signed_at && (
            <p className="text-xs text-muted-foreground mt-2">Assinado em {formatDate(contract.signed_at)}</p>
          )}

          {contract.status === 'error' && contract.error_message && (
            <div className="flex items-start gap-1.5 mt-2 text-xs text-red-600">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              {contract.error_message}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {contract.signature_url_client && (
            <a href={contract.signature_url_client} target="_blank" rel="noreferrer">
              <Button size="sm" variant="outline" className="gap-1 h-8 text-xs">
                <ExternalLink className="h-3 w-3" />
                Link cliente
              </Button>
            </a>
          )}
          {contract.status === 'error' && (
            <Button size="sm" variant="outline" className="gap-1 h-8 text-xs" onClick={onRegenerate}>
              <RefreshCw className="h-3 w-3" />
              Tentar de novo
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
