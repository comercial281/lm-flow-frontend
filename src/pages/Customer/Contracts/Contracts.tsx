import { useState, useEffect, useCallback } from 'react';
import { formatDateBR } from '@/utils/dateUtils';
import { toast } from 'sonner';
import {
  FileCheck, Search, ExternalLink, RefreshCw, FileText, AlertTriangle,
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

function initials(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
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

  const signedCount = contracts.filter(c => c.status === 'signed').length;
  const awaitingCount = contracts.filter(c => c.status === 'awaiting_signature').length;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Cabeçalho estilo protótipo: barra de destaque + título + subtítulo */}
      <div className="border-b bg-card px-6 py-5">
        <div className="flex items-start gap-3 mb-4">
          <div
            className="w-1 h-9 rounded-full shrink-0"
            style={{ background: 'linear-gradient(to bottom, #7c3aed, #9333ea)' }}
          />
          <div>
            <h1 className="text-2xl font-bold text-foreground leading-tight">Contratos</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {contracts.length} contrato{contracts.length === 1 ? '' : 's'}
              {signedCount > 0 && ` · ${signedCount} assinado${signedCount === 1 ? '' : 's'}`}
              {awaitingCount > 0 && ` · ${awaitingCount} aguardando`}
              {' — PDF → assinatura via Autentique'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
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

      <div className="flex-1 overflow-auto px-6 py-5">
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
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="font-medium px-4 py-3">Cliente</th>
                    <th className="font-medium px-4 py-3">Imóvel</th>
                    <th className="font-medium px-4 py-3">Tipo</th>
                    <th className="font-medium px-4 py-3">Etapa</th>
                    <th className="font-medium px-4 py-3">Atualizado</th>
                    <th className="font-medium px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(contract => (
                    <ContractRow
                      key={contract.id}
                      contract={contract}
                      onRegenerate={() => handleRegenerate(contract.proposal_id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ContractRow({ contract, onRegenerate }: { contract: Contract; onRegenerate: () => void }) {
  const statusColor = CONTRACT_STATUS_COLORS[contract.status] ?? '';
  const statusLabel = CONTRACT_STATUS_LABELS[contract.status] ?? contract.status;
  const name = contract.proposal?.contact?.name ?? '-';
  const type = contract.proposal?.proposal_type === 'purchase'
    ? 'Compra e venda'
    : contract.proposal?.proposal_type === 'rent'
      ? 'Locação'
      : '-';
  const updated = contract.signed_at
    ? `Assinado ${formatDate(contract.signed_at)}`
    : formatDate(contract.updated_at);

  return (
    <tr className="border-t border-border/60 hover:bg-muted/20 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="inline-flex items-center justify-center w-8 h-8 rounded-full shrink-0 text-xs font-semibold text-violet-300 bg-violet-500/15 border border-violet-500/20">
            {initials(name === '-' ? undefined : name)}
          </div>
          <span className="font-medium truncate">{name}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="text-muted-foreground truncate block max-w-[220px]">
          {contract.proposal?.property?.title ?? '-'}
        </span>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">{type}</td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          <Badge className={`text-xs font-medium w-fit ${statusColor}`}>{statusLabel}</Badge>
          {contract.status === 'error' && contract.error_message && (
            <span className="inline-flex items-center gap-1 text-[11px] text-red-500">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              <span className="truncate max-w-[180px]">{contract.error_message}</span>
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground text-xs">{updated}</td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1.5">
          {contract.document_url && (
            <a href={contract.document_url} target="_blank" rel="noreferrer">
              <Button size="sm" variant="ghost" className="gap-1 h-8 text-xs">
                <FileText className="h-3.5 w-3.5" />
                PDF
              </Button>
            </a>
          )}
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
      </td>
    </tr>
  );
}
