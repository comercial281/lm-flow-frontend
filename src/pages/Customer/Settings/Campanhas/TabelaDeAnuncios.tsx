// Anúncios de WhatsApp, em tabela (Tarefa 8, 04/11/2026): anúncio · o que oferece (ou o selo "Não diz o que oferece", com
// "Parece: <imóvel>" pelo nome da campanha) · quem atende · leads · último. Anúncio sem nome de campanha fica recolhido ao fim.
// O selo substitui o aviso do topo ("N campanhas não dizem o que vendem"): é opcional e não compete com lead parado.
import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Badge, Button } from '@/components/ui/ds';
import { plural } from '@/lib/formato';
import { propertiesService } from '@/services/properties/propertiesService';
import type { ItemDeCampanha } from '@/services/campanhas/campanhasService';
import { nomeDoItem, semOferta, vendeEmTexto } from '@/features/campanhas/itensDeCampanha';
import { donoEmTexto } from '@/features/campanhas/qualIaAtende';
import { semNomeDeCampanha, sugestaoPeloNome, ultimoLeadEmTexto } from '@/features/campanhas/telaDeCampanhas';
import { CabecalhoDaTabela, Celula, GRADE_DOS_ANUNCIOS, LinhaDaTabela, Tabela } from './TabelaDaTela';

/** Quantos anúncios sem oferta pedem um imóvel parecido ao servidor (uma busca cada). */
const MAX_DE_SUGESTOES = 12;

export interface TabelaDeAnunciosProps {
  itens: ItemDeCampanha[];
  nomes?: Record<string, string>;
  podeEditar: boolean;
  aoAbrir: (item: ItemDeCampanha) => void;
}

/** "Parece: <imóvel>" para quem não diz o que oferece. Falhou ou não achou: nada aparece. */
function useImoveisParecidos(itens: ItemDeCampanha[]): Record<string, string> {
  const [achados, setAchados] = useState<Record<string, string>>({});
  const pedidos = useMemo(
    () => itens.filter(semOferta).slice(0, MAX_DE_SUGESTOES).map((it) => ({ key: it.key, q: sugestaoPeloNome(nomeDoItem(it)) })).filter((p): p is { key: string; q: string } => !!p.q),
    [itens],
  );
  const chave = pedidos.map((p) => `${p.key}=${p.q}`).join('|');
  useEffect(() => {
    let vivo = true;
    pedidos.forEach(({ key, q }) => {
      propertiesService.list({ q, per_page: 1 })
        .then((r) => { const p = r.data?.[0]; if (vivo && p?.title) setAchados((a) => ({ ...a, [key]: p.title })); })
        .catch(() => undefined);
    });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);
  return achados;
}

function Linhas({ itens, nomes, podeEditar, aoAbrir, parecidos }: TabelaDeAnunciosProps & { parecidos: Record<string, string> }) {
  const grade = GRADE_DOS_ANUNCIOS;
  return (
    <div className="space-y-3">
      {itens.map((it) => {
        const nome = nomeDoItem(it);
        const vende = vendeEmTexto(it, nomes);
        const donos = it.agents ?? [];
        const sub = it.kind === 'ad' ? (it.ad_title ? `Anúncio "${it.ad_title}"` : 'Anúncio sem nome de campanha') : 'Campanha de anúncio de WhatsApp';
        const ultimo = ultimoLeadEmTexto(it.last_lead_at);
        return (
          <LinhaDaTabela key={it.key} grade={grade} testId="linha-do-anuncio" aoAbrir={() => aoAbrir(it)}>
            <Celula rotulo="Anúncio" className="sm:col-span-2 xl:col-span-1">
              <div className="min-w-0 max-w-full">
                <p className="break-words font-medium">{nome}</p>
                <p className="break-words text-xs text-muted-foreground">{sub}</p>
              </div>
            </Celula>
            <Celula rotulo="O que oferece">
              {vende ? <span className="min-w-0 break-words font-medium">{vende}</span> : (
                <div className="min-w-0">
                  <Badge variant="outline" className="h-auto whitespace-normal border-amber-500/40 text-left text-xs text-amber-700 dark:text-amber-400">Não diz o que oferece</Badge>
                  {parecidos[it.key] && <p className="mt-1 break-words text-xs text-muted-foreground">Parece: {parecidos[it.key]}</p>}
                </div>
              )}
            </Celula>
            <Celula rotulo="IA que atende">
              {donos.length === 0 ? <span className="text-muted-foreground">Sem IA</span> : donos.map((d) => (
                <Badge key={`${d.sales_agent_id}|${d.sales_agent_number_id ?? ''}`} variant="secondary" className="h-auto max-w-full whitespace-normal break-words text-left text-xs">{donoEmTexto(d)}</Badge>
              ))}
            </Celula>
            <Celula rotulo="Leads em 90 dias">{plural(it.leads_count, 'lead', 'leads')}</Celula>
            <Celula rotulo="Último lead">{ultimo ? <span className="text-xs text-muted-foreground">{ultimo.replace('Último lead ', '')}</span> : <span className="text-muted-foreground">—</span>}</Celula>
            <Celula rotulo="" className="xl:justify-self-end">
              <Button variant="outline" size="sm" onClick={() => aoAbrir(it)} aria-label={`${podeEditar ? 'Editar' : 'Ver'} ${nome}`}>{podeEditar ? 'Editar' : 'Ver'}</Button>
            </Celula>
          </LinhaDaTabela>
        );
      })}
    </div>
  );
}

export default function TabelaDeAnuncios(props: TabelaDeAnunciosProps) {
  const { itens } = props;
  const [aberto, setAberto] = useState(false);
  const comNome = useMemo(() => itens.filter((i) => !semNomeDeCampanha(i)), [itens]);
  const semNome = useMemo(() => itens.filter(semNomeDeCampanha), [itens]);
  const parecidos = useImoveisParecidos(comNome);
  const Seta = aberto ? ChevronDown : ChevronRight;
  return (
    <Tabela rotulo="Anúncios de WhatsApp">
      {comNome.length > 0 && (
        <>
          <CabecalhoDaTabela grade={GRADE_DOS_ANUNCIOS} colunas={['Anúncio', 'O que oferece', 'IA que atende', 'Leads em 90 dias', 'Último lead', '']} />
          <Linhas {...props} itens={comNome} parecidos={parecidos} />
        </>
      )}
      {semNome.length > 0 && (
        <div className={comNome.length > 0 ? 'mt-6' : undefined} data-testid="anuncios-sem-nome">
          <Button variant="ghost" size="sm" className="-ml-3" aria-expanded={aberto} onClick={() => setAberto((a) => !a)}>
            <Seta className="h-4 w-4" aria-hidden="true" />
            {plural(semNome.length, 'anúncio sem nome de campanha', 'anúncios sem nome de campanha')}
          </Button>
          {aberto && (
            <div className="mt-2">
              <Linhas {...props} itens={semNome} parecidos={{}} />
            </div>
          )}
        </div>
      )}
    </Tabela>
  );
}
