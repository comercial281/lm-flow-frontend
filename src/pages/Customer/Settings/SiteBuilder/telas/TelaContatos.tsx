import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Mail, RefreshCw, Users } from 'lucide-react';
import { formatDateBR } from '@/utils/dateUtils';
import { telefone } from '@/lib/formato';
import {
  siteBuilderService, SITE_LEAD_STATUS_COLORS, SITE_LEAD_STATUS_LABELS,
  type Site, type SiteLead,
} from '@/services/siteBuilder/siteBuilderService';
import { emailDeliveryLabel } from '@/features/siteBuilder/portalPages';

export default function TelaContatos({ site }: { site: Site }) {
  // Leads
  const [leads, setLeads] = useState<SiteLead[]>([]);
  const [leadsTotal, setLeadsTotal] = useState(0);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [leadsStatusFilter, setLeadsStatusFilter] = useState('');

  const loadLeads = useCallback(async (statusFilter?: string) => {
    if (!site) return;
    setLeadsLoading(true);
    try {
      const params: { status?: string; per_page: number } = { per_page: 50 };
      if (statusFilter) params.status = statusFilter;
      const result = await siteBuilderService.listLeads(site.id, params);
      setLeads(result.data);
      setLeadsTotal(result.meta.total);
    } catch {
      toast.error('Erro ao carregar leads');
    } finally {
      setLeadsLoading(false);
    }
  }, [site]);

  useEffect(() => { loadLeads(leadsStatusFilter || undefined); }, [loadLeads, leadsStatusFilter]);

  return (
    <div>
      {/* Status filter */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {['', 'received', 'contacted', 'converted', 'lost', 'spam'].map(s => (
          <button
            key={s}
            onClick={() => setLeadsStatusFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              leadsStatusFilter === s
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {s === '' ? `Todos (${leadsTotal})` : SITE_LEAD_STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {leadsLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
          <RefreshCw className="h-4 w-4 animate-spin mr-2" />Carregando...
        </div>
      ) : leads.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Users className="h-10 w-10 mb-2 opacity-30" />
          <p className="text-sm">Nenhum lead capturado ainda</p>
        </div>
      ) : (
        <div className="space-y-2">
          {leads.map(lead => (
            <div key={lead.id} className="flex items-start gap-4 p-4 rounded-lg border border-border bg-card">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{lead.name ?? '—'}</span>
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${SITE_LEAD_STATUS_COLORS[lead.status] ?? ''}`}>
                    {SITE_LEAD_STATUS_LABELS[lead.status] ?? lead.status}
                  </span>
                  {lead.form_type === 'anuncie_imovel' && (
                    <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium">Anuncie seu imóvel</span>
                  )}
                  {lead.source && (
                    <span className="text-xs text-muted-foreground">via {lead.source}</span>
                  )}
                </div>
                {/* Desfecho do e-mail: a ficha do "Anuncie" e a cópia do contato
                    feito na página de um imóvel (com as travas de repetido e de
                    limite por hora). Sem esta linha, e-mail que não saiu passaria
                    em silêncio: o contato fica guardado e ninguém sabe. */}
                {(() => {
                  const d = emailDeliveryLabel(lead.email_delivery);
                  if (!d) return null;
                  const tone = d.tone === 'ok'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : d.tone === 'warn'
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-destructive';
                  return (
                    <p className={`mt-1 flex items-center gap-1.5 text-xs ${tone}`}>
                      <Mail className="h-3 w-3 flex-none" /> {d.text}
                    </p>
                  );
                })()}
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  {lead.email && (
                    <span className="text-xs text-muted-foreground">{lead.email}</span>
                  )}
                  {lead.phone && (
                    <span className="text-xs text-muted-foreground">{telefone(lead.phone)}</span>
                  )}
                </div>
                {lead.message && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{lead.message}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDateBR(lead.created_at)}
                  {lead.utm_campaign && ` · campanha: ${lead.utm_campaign}`}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
