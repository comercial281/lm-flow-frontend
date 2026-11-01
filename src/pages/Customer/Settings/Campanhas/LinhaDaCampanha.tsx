// Uma linha da lista de Campanhas (Tarefa 77): nome, quantos leads, o que vende, a condição e qual IA atende.
// O `ResumoDaCampanha` (as três células) também entra no cartão do formulário, que tem o resto da ficha.
import { Badge, Button, Card } from '@/components/ui/ds';
import type { ItemDeCampanha } from '@/services/campanhas/campanhasService';
import { resumoDaCondicao } from '@/features/campanhas/condicaoDaCampanha';
import { nomeDoItem, vendeEmTexto } from '@/features/campanhas/itensDeCampanha';
import { donoEmTexto } from '@/features/campanhas/qualIaAtende';

function Celula({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <span className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{rotulo}</span>
      <div className="mt-1 flex flex-wrap items-center gap-1 text-sm">{children}</div>
    </div>
  );
}

export function ResumoDaCampanha({ item, nomes }: { item: ItemDeCampanha; nomes?: Record<string, string> }) {
  const vende = vendeEmTexto(item, nomes);
  const donos = item.agents ?? [];
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Celula rotulo="Vende">
        {vende ? <span className="truncate font-medium">{vende}</span> : <Badge variant="outline" className="border-amber-500/40 text-amber-600">Não diz o que vende</Badge>}
      </Celula>
      <Celula rotulo="Condição do anúncio">
        {resumoDaCondicao(item.offer_condition).map((s) => <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>)}
      </Celula>
      <Celula rotulo="Qual IA atende">
        {donos.length === 0
          ? <span className="text-muted-foreground">Nenhuma</span>
          : donos.map((d) => <Badge key={`${d.sales_agent_id}|${d.sales_agent_number_id ?? ''}`} variant="secondary" className="max-w-full truncate text-xs">{donoEmTexto(d)}</Badge>)}
      </Celula>
    </div>
  );
}

export const contagemDeLeads = (n: number) => `${n} ${n === 1 ? 'lead' : 'leads'} em 90 dias`;

export default function LinhaDaCampanha({ item, nomes, podeEditar, aoEditar }: {
  item: ItemDeCampanha;
  nomes?: Record<string, string>;
  podeEditar: boolean;
  aoEditar: (item: ItemDeCampanha) => void;
}) {
  const nome = nomeDoItem(item);
  const sub = item.kind === 'ad' ? (item.ad_title ? `Anúncio "${item.ad_title}"` : 'Anúncio sem nome de campanha') : 'Campanha de anúncio de WhatsApp';
  return (
    <Card className="gap-0 overflow-hidden py-0" data-testid="linha-da-campanha">
      <div className="grid gap-3 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-medium">{nome}</p>
            <p className="truncate text-xs text-muted-foreground">{sub}</p>
            <p className="text-xs text-muted-foreground">{contagemDeLeads(item.leads_count)}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => aoEditar(item)} aria-label={`${podeEditar ? 'Editar' : 'Ver'} ${nome}`}>
            {podeEditar ? 'Editar' : 'Ver'}
          </Button>
        </div>
        <ResumoDaCampanha item={item} nomes={nomes} />
      </div>
    </Card>
  );
}
