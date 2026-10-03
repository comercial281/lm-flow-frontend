import { Link } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { numero, porcentagem } from '@/lib/formato';
import type { SiteDashboard } from '@/services/siteBuilder/siteBuilderService';

const ROTULOS: Record<SiteDashboard['sources'][number]['key'], string> = {
  google: 'Google', direct: 'Link direto', ads: 'Anúncios', social: 'Redes sociais', other: 'Outros sites',
};

export function Origens({ dash }: { dash: SiteDashboard }) {
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-5">
      <h2 className="text-base font-semibold">De onde vêm as visitas</h2>
      {dash.visits === 0 ? (
        <p className="text-sm text-muted-foreground">Ainda sem visitas no período.</p>
      ) : (
        <ul className="space-y-2.5">
          {dash.sources.map(s => (
            <li key={s.key} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>{ROTULOS[s.key]}</span>
                <span className="text-muted-foreground">{porcentagem(s.pct, 0)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, s.pct))}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ImoveisVistos({ dash }: { dash: SiteDashboard }) {
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-5">
      <h2 className="text-base font-semibold">Imóveis mais vistos</h2>
      {dash.top_properties.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum imóvel visto ainda.</p>
      ) : (
        <ul className="space-y-1">
          {dash.top_properties.slice(0, 5).map(p => (
            <li key={p.id}>
              <Link
                to={`/properties?q=${encodeURIComponent(p.code)}`}
                className="flex items-center gap-3 rounded-lg p-1.5 hover:bg-muted"
              >
                {p.cover_url
                  ? <img src={p.cover_url} alt="" className="h-10 w-14 flex-none rounded object-cover" />
                  : <span className="flex h-10 w-14 flex-none items-center justify-center rounded bg-muted"><Building2 className="h-4 w-4 text-muted-foreground" /></span>}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{p.title}</span>
                  <span className="block text-xs text-muted-foreground">{p.code}</span>
                </span>
                <span className="flex-none text-xs text-muted-foreground">{numero(p.views)} {p.views === 1 ? 'visita' : 'visitas'}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
