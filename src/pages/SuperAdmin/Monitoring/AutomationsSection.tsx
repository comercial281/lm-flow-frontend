import { useState, useEffect, useCallback } from 'react';
import {
  Zap, ChevronDown, ChevronRight, ExternalLink, AlertTriangle,
  CheckCircle2, XCircle, Loader2, Workflow, Building2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Badge } from '@evoapi/design-system';
import clientInstancesService, {
  AutomationsMonitorData, AutomationGroup, AutomationItem,
} from '@/services/clientInstances/clientInstancesService';

function SourceChip({ source }: { source: AutomationItem['source'] }) {
  const isN8n = source === 'n8n';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        isN8n
          ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
          : 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300'
      }`}
    >
      <Workflow className="h-2.5 w-2.5" />
      {isN8n ? 'n8n' : 'Make'}
    </span>
  );
}

function GroupRow({ group, defaultOpen }: { group: AutomationGroup; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const allOn = group.active === group.total;

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 py-2.5 text-left hover:bg-muted/40 transition-colors px-1 rounded"
      >
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
        {group.internal
          ? <Workflow className="h-4 w-4 text-muted-foreground shrink-0" />
          : <Building2 className="h-4 w-4 text-[#7c3aed] shrink-0" />}
        <span className="font-medium text-foreground truncate flex-1">{group.client}</span>

        {group.mislabeled > 0 && (
          <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 text-[10px] gap-1">
            <AlertTriangle className="h-2.5 w-2.5" />
            {group.mislabeled} divergente{group.mislabeled > 1 ? 's' : ''}
          </Badge>
        )}
        <span
          className={`text-xs font-semibold rounded-full px-2 py-0.5 ${
            allOn
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
          }`}
        >
          {group.active}/{group.total} ativas
        </span>
      </button>

      {open && (
        <ul className="pb-2 pl-7 pr-1 space-y-1">
          {group.automations.map((a) => (
            <li key={`${a.source}-${a.external_id}`} className="flex items-center gap-2 text-sm py-1">
              {a.active
                ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                : <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />}
              <SourceChip source={a.source} />
              <span className={`flex-1 truncate ${a.active ? 'text-foreground' : 'text-muted-foreground'}`} title={a.raw_name}>
                {a.name}
              </span>
              {a.mislabeled && (
                <span className="text-[10px] text-orange-600 dark:text-orange-400 shrink-0" title="O nome diz [ATIVO] mas a automação está desligada">
                  rotulada ATIVO, está OFF
                </span>
              )}
              {a.link && (
                <a href={a.link} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-[#7c3aed] shrink-0" title="Abrir">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AutomationsSection() {
  const [data, setData] = useState<AutomationsMonitorData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await clientInstancesService.automations();
      setData(res.data.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  const ov = data?.overview;
  const groups = data?.groups ?? [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Zap className="h-5 w-5 text-[#7c3aed]" /> Automações por cliente
          {ov && (
            <span className="ml-1 text-sm font-normal text-muted-foreground">
              {ov.active}/{ov.automations} ativas · {ov.sources.n8n} n8n + {ov.sources.make} Make
              {ov.mislabeled > 0 && ` · ${ov.mislabeled} divergentes`}
            </span>
          )}
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        {data?.errors && data.errors.length > 0 && (
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            Fonte indisponível: {data.errors.join(' · ')}
          </div>
        )}

        {!data && loading && (
          <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando automações…
          </div>
        )}

        {data && groups.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma automação encontrada.
          </div>
        )}

        {groups.length > 0 && (
          <div>
            {groups.map((g) => (
              <GroupRow key={g.client} group={g} defaultOpen={!g.internal} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
