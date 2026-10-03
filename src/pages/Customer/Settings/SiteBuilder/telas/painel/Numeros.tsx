import { dataCurta, numero, porcentagem, VAZIO } from '@/lib/formato';
import type { DashboardNumbers, SiteDashboard } from '@/services/siteBuilder/siteBuilderService';

// Os quatro cartões de cima do Painel. Variação só existe com período anterior;
// sem ele, o cartão diz desde quando o site está sendo contado.
type Chave = keyof DashboardNumbers;

const CARTOES: { chave: Chave; rotulo: string; taxa?: boolean }[] = [
  { chave: 'visits', rotulo: 'Visitas' },
  { chave: 'visitors', rotulo: 'Pessoas diferentes' },
  { chave: 'contacts', rotulo: 'Contatos pelo site' },
  { chave: 'conversion_rate', rotulo: 'Visitas que viraram contato', taxa: true },
];

function Variacao({ dash, chave, taxa }: { dash: SiteDashboard; chave: Chave; taxa?: boolean }) {
  const antes = dash.previous?.[chave];
  const agora = dash[chave];
  if (!dash.previous) {
    return (
      <p className="text-xs text-muted-foreground">
        {dash.counting_since ? `contando desde ${dataCurta(dash.counting_since)}` : 'contando a partir de hoje'}
      </p>
    );
  }
  if (agora == null || antes == null) return <p className="text-xs text-muted-foreground">sem período anterior para comparar</p>;
  const diff = agora - antes;
  if (diff === 0) return <p className="text-xs text-muted-foreground">igual ao período anterior</p>;
  const texto = taxa ? porcentagem(Math.abs(diff)) : numero(Math.abs(diff));
  return (
    <p className={`text-xs font-medium ${diff > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
      {diff > 0 ? '▲' : '▼'} {texto} <span className="font-normal text-muted-foreground">vs. período anterior</span>
    </p>
  );
}

export default function Numeros({ dash }: { dash: SiteDashboard }) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
      {CARTOES.map(c => {
        const v = dash[c.chave];
        const valor = v == null ? VAZIO : c.taxa ? porcentagem(v) : numero(v);
        return (
          <div key={c.chave} className="space-y-1 rounded-xl border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">{c.rotulo}</p>
            <p className="text-3xl font-semibold">{valor}</p>
            <Variacao dash={dash} chave={c.chave} taxa={c.taxa} />
          </div>
        );
      })}
    </div>
  );
}
