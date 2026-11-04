// "Pra resolver" (Tarefa 8, 04/11/2026): o que está barrando lead agora. Só aparece com item.
// Formulário do Facebook sem ficha (ou com ficha desligada) que já trouxe lead que não entrou: nome, quantos estão
// esperando e o botão Plugar. Plugou em até 2 dias, o `ReconcileLeadsJob` traz os leads sozinho. Mais velho que isso
// só entra por importação manual. Servidor antigo (sem `recent_count`): só a contagem.
import { Ban, Loader2, ToggleLeft, ToggleRight } from 'lucide-react';
import { Badge, Button, Card } from '@/components/ui/ds';
import { plural } from '@/lib/formato';
import type { IgnoredLeadForm } from '@/services/leadAds/leadAdsFormsService';
import type { MetaPage } from '@/services/integrations/metaPagesService';
import { frasesDoLeadBarrado, ultimoLeadEmTexto } from '@/features/campanhas/telaDeCampanhas';

export interface PraResolverProps {
  formularios: IgnoredLeadForm[];
  /** O formulário já tem ficha, só que desligada: Plugar abre essa ficha em vez de criar outra. */
  fichaDesligada: (formId: string) => boolean;
  /** Só com mais de uma página conectada. */
  nomeDaPagina: (f: IgnoredLeadForm) => string | null;
  aoPlugar: (f: IgnoredLeadForm) => void;
  /** Super-admin: as páginas que barram lead e a chave "Receber leads de qualquer formulário desta página". */
  paginasDaChave?: MetaPage[];
  paginaOcupada?: string | null;
  aoAlternarPagina?: (p: MetaPage) => void;
}

export default function PraResolver({
  formularios, fichaDesligada, nomeDaPagina, aoPlugar, paginasDaChave = [], paginaOcupada = null, aoAlternarPagina,
}: PraResolverProps) {
  if (formularios.length === 0) return null;
  const total = formularios.reduce((soma, f) => soma + f.lead_count, 0);
  const haEntradaSozinha = formularios.some((f) => (f.recent_count ?? 0) > 0);

  return (
    <section className="mb-8" data-testid="pra-resolver" aria-labelledby="pra-resolver-titulo">
      <h2 id="pra-resolver-titulo" className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">Pra resolver</h2>
      <Card className="gap-0 overflow-hidden border-amber-500/40 py-0">
        <div className="flex items-start gap-2 border-b border-border px-5 py-4">
          <Ban className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-medium">{plural(total, 'lead não entrou', 'leads não entraram')}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {haEntradaSozinha
                ? 'Plugue em até 2 dias e os leads que estão esperando entram sozinhos. Os mais antigos só entram por importação manual.'
                : `${formularios.length > 1 ? 'Vieram destes formulários, que não estão plugados' : 'Veio deste formulário, que não está plugado'}. Se for seu, plugue: os próximos leads entram.`}
            </p>
          </div>
        </div>

        <ul className="divide-y divide-border">
          {formularios.map((f) => {
            const frases = frasesDoLeadBarrado(f);
            const ultimo = ultimoLeadEmTexto(f.last_lead_at);
            const pagina = nomeDaPagina(f);
            return (
              <li key={f.form_id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
                <div className="min-w-0 flex-1 basis-56">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 break-words text-sm font-medium">{f.form_name || `Formulário ${f.form_id}`}</span>
                    {fichaDesligada(f.form_id) && <Badge variant="outline" className="text-xs text-amber-700 dark:text-amber-400">Ficha desligada</Badge>}
                    {pagina && <Badge variant="secondary" className="text-xs">{pagina}</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {[frases.principal, frases.porImportacao, ultimo].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => aoPlugar(f)} aria-label={`Plugar ${f.form_name || f.form_id}`}>Plugar</Button>
              </li>
            );
          })}
        </ul>

        {/* Válvula de escape, por página. Só o super-admin edita página: pro resto a chave nem aparece (botão que só dá 403 é pior que botão nenhum). */}
        {paginasDaChave.length > 0 && aoAlternarPagina && (
          <div className="space-y-2 border-t border-border bg-muted/20 px-5 py-3">
            {paginasDaChave.map((page) => (
              <div key={page.id} className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => aoAlternarPagina(page)}
                  disabled={paginaOcupada === page.id}
                  className="mt-0.5 flex-shrink-0 disabled:opacity-50"
                  aria-label={`Receber leads de qualquer formulário desta página${paginasDaChave.length > 1 ? `: ${page.page_name}` : ''}`}
                  aria-pressed={!!page.accept_unconfigured_forms}
                  title={page.accept_unconfigured_forms
                    ? 'Ligado: clique para só aceitar os formulários plugados'
                    : 'Desligado: clique para aceitar qualquer formulário desta página'}
                >
                  {paginaOcupada === page.id
                    ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    : page.accept_unconfigured_forms
                      ? <ToggleRight className="h-5 w-5 text-green-500" />
                      : <ToggleLeft className="h-5 w-5 text-muted-foreground" />}
                </button>
                <div className="min-w-0">
                  <p className="text-xs font-medium">
                    Receber leads de qualquer formulário desta página
                    {paginasDaChave.length > 1 && <> ({page.page_name})</>}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">Ligado, tudo o que a página produzir entra no CRM, plugado ou não.</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </section>
  );
}
