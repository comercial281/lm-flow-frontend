// Tabela das páginas de Sites e landing pages (Task 8, 10/11/2026). Mesmo desenho das tabelas de Campanhas:
// de 1280 px pra cima é tabela; abaixo vira cartão, com o nome de cada campo em cima.
import { Badge } from '@/components/ui/ds';
import Chave from '@/components/base/Chave';
import { dataHora, plural } from '@/lib/formato';
import type { PaginaDeSite } from '@/services/externalLeadPages/externalLeadPagesService';
import { CabecalhoDaTabela, Celula, LinhaDaTabela, Tabela } from '../../Campanhas/TabelaDaTela';

const GRADE = 'xl:grid-cols-[minmax(0,2.2fr)_minmax(0,1.8fr)_minmax(0,2fr)_5.5rem_minmax(0,1.6fr)_6.25rem]';

/** Resultado de procurar um nome numa lista que a tela carrega à parte. "faltou" só vale com a lista carregada de verdade. */
export type Busca<T> = { tipo: 'achou'; valor: T } | { tipo: 'carregando' } | { tipo: 'falhou' } | { tipo: 'faltou' };

export interface NomesDasPaginas {
  funil: (id: string) => Busca<string>;
  etapa: (funilId: string, etapaId: string) => Busca<string>;
  roleta: (id: string) => Busca<{ nome: string; naFila: number | null }>;
  corretor: (id: string) => Busca<string>;
}

const TextoNeutro = ({ b }: { b: Busca<unknown> }) =>
  b.tipo === 'faltou'
    ? <span className="text-muted-foreground">Não encontrado</span>
    : <span className="text-muted-foreground" aria-label={b.tipo === 'carregando' ? 'Carregando' : undefined}>{b.tipo === 'carregando' ? '…' : '—'}</span>;

export interface TabelaDePaginasProps {
  paginas: PaginaDeSite[];
  nomes: NomesDasPaginas;
  aoAbrir: (pagina: PaginaDeSite) => void;
  aoLigar: (pagina: PaginaDeSite, ativa: boolean) => Promise<boolean | void>;
}

type Tom = 'ambar' | 'vermelho' | 'verde';
const CLASSE_DO_TOM: Record<Tom, string> = {
  ambar: 'border-amber-500/40 text-amber-700 dark:text-amber-400',
  vermelho: 'border-destructive/40 text-destructive',
  verde: 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400',
};

export function seloDoUltimoEnvio(p: PaginaDeSite): { texto: string; tom: Tom } {
  if (!p.last_delivery) return { texto: 'Esperando o 1º envio', tom: 'ambar' };
  if (p.rejected_last_24h > 0) return { texto: plural(p.rejected_last_24h, 'recusado', 'recusados'), tom: 'vermelho' };
  if (p.last_delivery.outcome === 'failed') return { texto: 'Erro no último envio', tom: 'vermelho' };
  return { texto: dataHora(p.last_delivery.at), tom: 'verde' };
}

function QuemAssume({ p, nomes }: { p: PaginaDeSite; nomes: NomesDasPaginas }) {
  if (p.roleta_config_id) {
    const r = nomes.roleta(p.roleta_config_id);
    if (r.tipo !== 'achou') return <TextoNeutro b={r} />;
    return (
      <div className="min-w-0">
        <p className="break-words font-medium">{r.valor.nome}</p>
        {r.valor.naFila != null && <p className="text-xs text-muted-foreground">{plural(r.valor.naFila, 'corretor na fila', 'corretores na fila')}</p>}
      </div>
    );
  }
  if (p.default_assignee_id) {
    const c = nomes.corretor(p.default_assignee_id);
    if (c.tipo !== 'achou') return <TextoNeutro b={c} />;
    return (
      <div className="min-w-0">
        <p className="break-words font-medium">{c.valor}</p>
        <p className="text-xs text-muted-foreground">Corretor fixo</p>
      </div>
    );
  }
  return (
    <div className="min-w-0">
      <p className="font-medium">Ninguém</p>
      <p className="text-xs text-muted-foreground">Entra sem responsável</p>
    </div>
  );
}

function ParaOndeVai({ p, nomes }: { p: PaginaDeSite; nomes: NomesDasPaginas }) {
  if (!p.pipeline_id) return <span className="text-muted-foreground">—</span>;
  const f = nomes.funil(p.pipeline_id);
  if (f.tipo !== 'achou') return <TextoNeutro b={f} />;
  const e = p.stage_id ? nomes.etapa(p.pipeline_id, p.stage_id) : null;
  return <span className="min-w-0 break-words">{e?.tipo === 'achou' ? `${f.valor} › ${e.valor}` : f.valor}</span>;
}

export default function TabelaDePaginas({ paginas, nomes, aoAbrir, aoLigar }: TabelaDePaginasProps) {
  return (
    <Tabela rotulo="Páginas que mandam lead">
      <CabecalhoDaTabela grade={GRADE} colunas={['Página', 'Para onde vai', 'Quem assume', 'Leads em 30 dias', 'Último envio', 'Ativa']} />
      <div className="space-y-3">
        {paginas.map((p) => {
          const selo = seloDoUltimoEnvio(p);
          return (
            <LinhaDaTabela key={p.id} grade={GRADE} testId="linha-da-pagina" aoAbrir={() => aoAbrir(p)}>
              <Celula rotulo="Página" className="sm:col-span-2 xl:col-span-1">
                <div className="min-w-0 max-w-full">
                  <p className="break-words font-medium">{p.name}</p>
                  {p.last_delivery?.page_host && <p className="break-words text-xs text-muted-foreground">{p.last_delivery.page_host}</p>}
                </div>
              </Celula>
              <Celula rotulo="Para onde vai">
                <ParaOndeVai p={p} nomes={nomes} />
              </Celula>
              <Celula rotulo="Quem assume"><QuemAssume p={p} nomes={nomes} /></Celula>
              <Celula rotulo="Leads em 30 dias">{p.leads_30d}</Celula>
              <Celula rotulo="Último envio">
                <Badge variant="outline" className={`h-auto whitespace-normal text-left text-xs ${CLASSE_DO_TOM[selo.tom]}`}>{selo.texto}</Badge>
              </Celula>
              <Celula rotulo="Ativa" className="xl:justify-self-end">
                <span data-nao-abre>
                  <Chave rotulo={`Página ativa: ${p.name}`} ligada={p.active} semRotuloVisivel genero="a" aoMudar={(ativa) => aoLigar(p, ativa)} />
                </span>
              </Celula>
            </LinhaDaTabela>
          );
        })}
      </div>
    </Tabela>
  );
}
