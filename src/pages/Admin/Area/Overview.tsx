import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Snowflake, AlertTriangle, Clock, Loader2, ArrowRight } from 'lucide-react';
import api from '@/services/core/api';

interface PooledTenant {
  id: string;
  name: string;
  slug: string;
  status: string;
  members: number | null;
  archived?: boolean;
  created_at?: string;
}

/**
 * Visão Geral da Área do Admin.
 *
 * Regra desta tela: só número que vem do backend. Nada de placeholder, nada de
 * métrica "estimada". Se o dado não existe (ex: financeiro/margem), a seção não
 * aparece — em vez de mostrar zero e parecer que é zero de verdade.
 *
 * Fonte: GET /super/pooled_tenants (mesmo endpoint da tela de Clientes).
 */
export default function AdminOverview() {
  const [tenants, setTenants] = useState<PooledTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .get('/super/pooled_tenants')
      .then(r => {
        if (!alive) return;
        setTenants(r.data?.data || []);
        setError(null);
      })
      .catch(() => {
        if (alive) setError('Não consegui carregar os clientes.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const active = tenants.filter(t => t.status === 'active' && !t.archived).length;
  const provisioning = tenants.filter(t => t.status === 'trial').length;
  const suspended = tenants.filter(t => t.status === 'suspended').length;
  const errored = tenants.filter(t => t.status === 'error').length;

  const cards = [
    { label: 'Ativos', value: active, icon: Building2, tone: 'text-emerald-500' },
    { label: 'Provisionando', value: provisioning, icon: Clock, tone: 'text-blue-500' },
    { label: 'Congelados', value: suspended, icon: Snowflake, tone: 'text-orange-500' },
    { label: 'Com erro', value: errored, icon: AlertTriangle, tone: 'text-red-500' },
  ];

  return (
    <div className="p-6">
      <div className="mb-6 border-l-4 border-primary pl-3">
        <h1 className="text-xl font-semibold">Visão Geral</h1>
        <p className="text-sm text-muted-foreground">Saúde do SaaS num relance</p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando...
        </div>
      ) : error ? (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {cards.map(c => (
              <div key={c.label} className="rounded-lg border border-sidebar-border bg-sidebar p-4">
                <div className="flex items-center gap-2">
                  <c.icon className={`h-4 w-4 ${c.tone}`} />
                  <p className="text-xs text-muted-foreground">{c.label}</p>
                </div>
                <p className="mt-2 text-2xl font-bold">{c.value}</p>
              </div>
            ))}
          </div>

          {errored > 0 && (
            <div className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm">
              <p className="font-medium text-red-400">
                {errored === 1 ? '1 cliente está com erro' : `${errored} clientes estão com erro`}
              </p>
              <ul className="mt-1 space-y-0.5 text-red-300/90">
                {tenants
                  .filter(t => t.status === 'error')
                  .map(t => (
                    <li key={t.id}>{t.name}</li>
                  ))}
              </ul>
            </div>
          )}

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <Link
              to="/admin/clientes"
              className="group flex items-center justify-between rounded-lg border border-sidebar-border bg-sidebar p-4 transition-colors hover:border-primary/40"
            >
              <div>
                <p className="font-medium">Clientes</p>
                <p className="text-sm text-muted-foreground">
                  {tenants.length} no total. Criar, congelar, entrar no CRM.
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>

            <Link
              to="/admin/auditoria"
              className="group flex items-center justify-between rounded-lg border border-sidebar-border bg-sidebar p-4 transition-colors hover:border-primary/40"
            >
              <div>
                <p className="font-medium">Auditoria</p>
                <p className="text-sm text-muted-foreground">O que aconteceu, por cliente.</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
