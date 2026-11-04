// Formulários do Meta, em tabela (Tarefa 8, 04/11/2026): formulário e último lead · imóvel · funil e etapa, quem assume ·
// quem atende (IA e motivo) · leads em 90 dias · ativo. A linha abre a janela. Os formulários do Facebook ainda sem
// ficha e sem lead ficam recolhidos ao fim (`OutrosFormularios`), cada um com Plugar.
// ⚠️ Lista do servidor ainda não chegou (ou falhou): a linha NÃO afirma "0 leads" nem "Sem IA". Mostra traço.
import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Badge, Button } from '@/components/ui/ds';
import Chave from '@/components/base/Chave';
import { plural } from '@/lib/formato';
import type { LeadAdsFormConfig, MetaForm } from '@/services/leadAds/leadAdsFormsService';
import type { ItemDeCampanha } from '@/services/campanhas/campanhasService';
import { itemDaFicha, vendeEmTexto } from '@/features/campanhas/itensDeCampanha';
import { donoEmTexto } from '@/features/campanhas/qualIaAtende';
import { ultimoLeadEmTexto } from '@/features/campanhas/telaDeCampanhas';
import { CabecalhoDaTabela, Celula, GRADE_DOS_FORMULARIOS, LinhaDaTabela, Tabela } from './TabelaDaTela';

export interface TabelaDeFormulariosProps {
  fichas: LeadAdsFormConfig[];
  /** Os itens da lista do servidor (IA, imóvel, leads). Sem eles a linha mostra o que a ficha sabe. */
  itens?: ItemDeCampanha[];
  /** A lista do servidor chegou. Sem ela, nada de "0 leads" nem "Sem IA". */
  listaPronta: boolean;
  nomes?: Record<string, string>;
  nomeDaFicha: (c: LeadAdsFormConfig) => string;
  /** "Funil > Etapa". */
  destino: (c: LeadAdsFormConfig) => string;
  /** Corretor ou roleta, em palavras. */
  quemAssume: (c: LeadAdsFormConfig) => string;
  /** Só com mais de uma página conectada. */
  nomeDaPagina: (c: LeadAdsFormConfig) => string | null;
  podeEditar: boolean;
  podeLigar: boolean;
  aoAbrir: (c: LeadAdsFormConfig) => void;
  aoLigar: (c: LeadAdsFormConfig, ligada: boolean) => Promise<void>;
}

export default function TabelaDeFormularios({
  fichas, itens, listaPronta, nomes, nomeDaFicha, destino, quemAssume, nomeDaPagina, podeEditar, podeLigar, aoAbrir, aoLigar,
}: TabelaDeFormulariosProps) {
  const grade = GRADE_DOS_FORMULARIOS;
  return (
    <Tabela rotulo="Formulários do Meta">
      <CabecalhoDaTabela grade={grade} colunas={['Formulário', 'Imóvel', 'Funil e quem assume', 'IA que atende', 'Leads em 90 dias', 'Ativo', '']} />
      <div className="space-y-3">
        {fichas.map((cfg) => {
          const nome = nomeDaFicha(cfg);
          const item = itemDaFicha(cfg, nome, itens?.find((i) => i.form_config_id === cfg.id));
          const vende = vendeEmTexto(item, nomes);
          const donos = item.agents ?? [];
          const pagina = nomeDaPagina(cfg);
          const ultimo = listaPronta ? ultimoLeadEmTexto(item.last_lead_at) : null;
          return (
            <LinhaDaTabela key={cfg.id} grade={grade} testId="linha-do-formulario" aoAbrir={() => aoAbrir(cfg)}>
              <Celula rotulo="Formulário" className="sm:col-span-2 xl:col-span-1">
                <div className="min-w-0 max-w-full">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 break-words font-medium">{nome}</span>
                    {pagina && <Badge variant="secondary" className="text-xs">{pagina}</Badge>}
                    {!cfg.form_name?.trim() && <Badge variant="outline" className="text-xs text-amber-700 dark:text-amber-400">Sem nome no Facebook</Badge>}
                    {!cfg.is_active && <Badge variant="outline" className="text-xs text-muted-foreground">Ficha desligada</Badge>}
                  </div>
                  {ultimo && <p className="mt-0.5 text-xs text-muted-foreground">{ultimo}</p>}
                </div>
              </Celula>
              <Celula rotulo="Imóvel">
                {!listaPronta ? <span className="text-muted-foreground">—</span>
                  : vende ? <span className="min-w-0 break-words font-medium">{vende}</span>
                    : <span className="text-muted-foreground">Não definido</span>}
              </Celula>
              <Celula rotulo="Funil e quem assume">
                <div className="min-w-0">
                  <p className="break-words">{destino(cfg)}</p>
                  <p className="break-words text-xs text-muted-foreground">{quemAssume(cfg)}</p>
                </div>
              </Celula>
              <Celula rotulo="IA que atende">
                {!listaPronta ? <span className="text-muted-foreground">—</span>
                  : donos.length === 0 ? <span className="text-muted-foreground">Sem IA</span>
                    : donos.map((d) => (
                      <Badge key={`${d.sales_agent_id}|${d.sales_agent_number_id ?? ''}`} variant="secondary" className="h-auto max-w-full whitespace-normal break-words text-left text-xs">
                        {donoEmTexto(d)}
                      </Badge>
                    ))}
              </Celula>
              <Celula rotulo="Leads em 90 dias">
                {listaPronta ? plural(item.leads_count, 'lead', 'leads') : <span className="text-muted-foreground">—</span>}
              </Celula>
              <Celula rotulo="Ativo">
                <span data-nao-abre>
                  <Chave
                    rotulo={`Ficha ativa de ${nome}`}
                    ligada={cfg.is_active}
                    semRotuloVisivel
                    genero="a"
                    desabilitada={!podeLigar}
                    aoMudar={(ligada) => aoLigar(cfg, ligada)}
                  />
                </span>
              </Celula>
              <Celula rotulo="" className="xl:justify-self-end">
                <Button variant="outline" size="sm" onClick={() => aoAbrir(cfg)} title={podeEditar ? 'Editar' : 'Ver'} aria-label={`${podeEditar ? 'Editar' : 'Ver'} ${nome}`}>
                  {podeEditar ? 'Editar' : 'Ver'}
                </Button>
              </Celula>
            </LinhaDaTabela>
          );
        })}
      </div>
    </Tabela>
  );
}

export interface OutrosFormulariosProps {
  formularios: MetaForm[];
  mostrarPagina: boolean;
  /** Uma frase por formulário (ex.: "Cai na Roleta X pela regra..."). */
  nota?: (mf: MetaForm) => ReactNode;
  aoPlugar: (mf: MetaForm) => void;
  /** Sem `lead_ads_form_configs.create` o servidor recusa a ficha nova: Plugar nem aparece. */
  podePlugar?: boolean;
}

/** Formulários do Facebook sem ficha e sem lead barrado: recolhidos, pra não competir com o que precisa de ação. */
export function OutrosFormularios({ formularios, mostrarPagina, nota, aoPlugar, podePlugar = true }: OutrosFormulariosProps) {
  const [aberto, setAberto] = useState(false);
  if (formularios.length === 0) return null;
  const Seta = aberto ? ChevronDown : ChevronRight;
  return (
    <div className="mt-6" data-testid="outros-formularios">
      <Button variant="ghost" size="sm" className="-ml-3" aria-expanded={aberto} onClick={() => setAberto((a) => !a)}>
        <Seta className="h-4 w-4" aria-hidden="true" />
        {plural(formularios.length, 'outro formulário no Facebook, ainda sem ficha', 'outros formulários no Facebook, ainda sem ficha')}
      </Button>
      {aberto && (
        <div className="mt-2 space-y-3">
          {formularios.map((mf) => (
            <div key={mf.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-dashed border-border bg-muted/20 px-5 py-4">
              <div className="min-w-0 flex-1 basis-56">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 break-words font-medium">{mf.name?.trim() || `Formulário ${mf.id}`}</span>
                  <Badge variant="outline" className="text-xs">{mf.status}</Badge>
                  {mostrarPagina && mf.page_name && <Badge variant="secondary" className="text-xs">{mf.page_name}</Badge>}
                  {!mf.name?.trim() && <Badge variant="outline" className="text-xs text-amber-700 dark:text-amber-400">Sem nome no Facebook</Badge>}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{plural(mf.leads_count, 'lead', 'leads')}</p>
                {nota?.(mf)}
              </div>
              {podePlugar && <Button variant="outline" size="sm" onClick={() => aoPlugar(mf)} aria-label={`Plugar ${mf.name?.trim() || mf.id}`}>Plugar</Button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
