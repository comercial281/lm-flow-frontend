import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, Search, UserRoundCheck } from 'lucide-react';
import { Button, Input } from '@/components/ui/ds';
import { EmptyState } from '@/components/base';
import { useCan } from '@/hooks/useCan';
import { cn } from '@/lib/utils';
import { dataCurta, numero, plural, telefone } from '@/lib/formato';
import {
  propertyOwnersService,
  type Proprietario,
  type ProprietarioCompleto,
  type StatusDoProprietario,
} from '@/services/propertyOwners/propertyOwnersService';
import { ORIGEM_DO_PROPRIETARIO, STATUS_DO_PROPRIETARIO, iniciais } from '@/features/properties/proprietarios/statusDoProprietario';
import { linkNaLista } from '@/features/properties/listingKind';
import PilulaDeStatus from './PilulaDeStatus';
import JanelaDoProprietario from './JanelaDoProprietario';

const POR_PAGINA = 50;
const ESPERA_DA_BUSCA_MS = 300;

// Clique na pílula ou num código não abre a ficha (o menu da pílula vem por
// portal, mas o clique ainda sobe pela árvore do React até a linha).
const naoAbreAFicha = (e: React.MouseEvent) => e.stopPropagation();

function Linha({ o, aoAbrir, aoMudarStatus }: {
  o: Proprietario;
  aoAbrir: () => void;
  aoMudarStatus: (atualizado: ProprietarioCompleto) => void;
}) {
  return (
    <article data-testid="linha-proprietario" onClick={aoAbrir}
      className="flex cursor-pointer items-start gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm transition-colors hover:border-primary/40">
      <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
        {iniciais(o.name)}
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <Link to={`/property-owners/${o.id}`} onClick={naoAbreAFicha} className="block truncate font-medium hover:underline">{o.name}</Link>
        <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {o.phone && <span>{telefone(o.phone)}</span>}
          <span>{ORIGEM_DO_PROPRIETARIO[o.source] ?? ORIGEM_DO_PROPRIETARIO.manual}</span>
        </p>
        {o.properties.length > 0 && (
          <div onClick={naoAbreAFicha} className="flex flex-wrap gap-1.5">
            {o.properties.map(p => (
              <Link key={p.id} to={linkNaLista({ code: p.code, listing_kind: 'resale' })}
                className="rounded-md border px-1.5 py-0.5 text-xs font-medium text-primary hover:bg-primary/10">
                {p.code}
              </Link>
            ))}
          </div>
        )}
        {o.status_changed_at && (
          <p className="text-xs text-muted-foreground">
            Atualizado em {dataCurta(o.status_changed_at)}{o.status_changed_by ? ` por ${o.status_changed_by.name}` : ''}
          </p>
        )}
      </div>
      <div onClick={naoAbreAFicha} className="shrink-0">
        <PilulaDeStatus id={o.id} status={o.status} aoMudar={aoMudarStatus} />
      </div>
    </article>
  );
}

interface ListaDeProprietariosProps {
  /** A janela "Novo proprietário" é aberta pelo botão do cabeçalho da página. */
  novoAberto: boolean;
  aoFecharNovo: () => void;
  /** Só pro botão da tela vazia (o do cabeçalho já abre pelo pai). */
  aoAbrirNovo?: () => void;
}

export default function ListaDeProprietarios({ novoAberto, aoFecharNovo, aoAbrirNovo }: ListaDeProprietariosProps) {
  const can = useCan();
  const podeGerir = can('properties', 'update');
  const navigate = useNavigate();

  const [busca, setBusca] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<StatusDoProprietario | ''>('');
  const [itens, setItens] = useState<Proprietario[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [carregando, setCarregando] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [erro, setErro] = useState(false);
  // Só a resposta do último pedido vale (busca digitada rápido, filtro trocado).
  const pedido = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setQ(busca.trim()), ESPERA_DA_BUSCA_MS);
    return () => clearTimeout(timer);
  }, [busca]);

  const carregar = useCallback(async (p: number) => {
    const meu = ++pedido.current;
    if (p === 1) setCarregando(true); else setCarregandoMais(true);
    setErro(false);
    try {
      const r = await propertyOwnersService.list({ q: q || undefined, status: status || undefined, page: p, per_page: POR_PAGINA });
      if (meu !== pedido.current) return;
      setItens(antes => (p === 1 ? r.data : [...antes, ...r.data]));
      setTotal(r.meta.total);
      setPagina(p);
    } catch {
      if (meu === pedido.current) setErro(true);
    } finally {
      if (meu === pedido.current) { setCarregando(false); setCarregandoMais(false); }
    }
  }, [q, status]);

  useEffect(() => { void carregar(1); }, [carregar]);

  const mudouStatus = (a: ProprietarioCompleto) =>
    setItens(l => l.map(o => (o.id === a.id
      ? { ...o, status: a.status, status_changed_at: a.status_changed_at, status_changed_by: a.status_changed_by }
      : o)));

  const limparFiltros = () => { setBusca(''); setQ(''); setStatus(''); };
  const temFiltro = !!q || !!status;

  const conteudo = erro ? (
    <EmptyState tipo="erro" aoTentarDeNovo={() => void carregar(1)} />
  ) : carregando && itens.length === 0 ? (
    <div role="status" className="flex flex-col gap-2.5">
      <span className="sr-only">Carregando proprietários</span>
      {[0, 1, 2].map(i => <div key={i} className="h-20 animate-pulse rounded-xl border bg-muted/40" />)}
    </div>
  ) : itens.length === 0 && !temFiltro ? (
    podeGerir ? (
      <EmptyState
        icon={UserRoundCheck}
        title="Nenhum proprietário ainda"
        description="Aqui ficam os donos dos imóveis de revenda: contato, status e os imóveis de cada um."
        action={aoAbrirNovo ? { label: 'Novo proprietário', onClick: aoAbrirNovo } : undefined}
      />
    ) : (
      <EmptyState
        icon={UserRoundCheck}
        title="Nenhum proprietário liberado para você"
        description="Quando o gestor liberar um proprietário para você, ele aparece aqui."
      />
    )
  ) : itens.length === 0 ? (
    <EmptyState tipo="semResultado" aoLimparFiltros={limparFiltros} />
  ) : (
    <>
      <div aria-busy={carregando} className={cn('flex flex-col gap-2.5', carregando && 'opacity-60')}>
        {itens.map(o => (
          <Linha key={o.id} o={o} aoAbrir={() => navigate(`/property-owners/${o.id}`)} aoMudarStatus={mudouStatus} />
        ))}
      </div>
      <div className="mt-4 flex flex-col items-center gap-2 text-xs text-muted-foreground">
        <span>Mostrando {numero(itens.length)} de {plural(total, 'proprietário', 'proprietários')}</span>
        {itens.length < total && (
          <Button variant="outline" onClick={() => void carregar(pagina + 1)} disabled={carregandoMais || carregando}>
            {carregandoMais ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Carregando...</> : 'Mostrar mais'}
          </Button>
        )}
      </div>
    </>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input aria-label="Buscar proprietário" placeholder="Buscar por nome ou telefone" value={busca}
            onChange={e => setBusca(e.target.value)} className="pl-9" />
        </div>
      </div>
      <div role="group" aria-label="Filtrar por status" className="flex flex-wrap gap-2">
        {[{ valor: '' as const, rotulo: 'Todos' }, ...STATUS_DO_PROPRIETARIO].map(s => (
          <button key={s.valor || 'todos'} type="button" aria-pressed={status === s.valor} onClick={() => setStatus(s.valor)}
            className={cn('rounded-full border px-3 py-1 text-sm transition-colors',
              status === s.valor ? 'border-primary bg-primary/10 font-medium text-primary' : 'border-border text-muted-foreground hover:bg-muted')}>
            {s.rotulo}
          </button>
        ))}
      </div>
      {conteudo}
      <JanelaDoProprietario
        aberta={novoAberto}
        aoFechar={aoFecharNovo}
        aoSalvar={criado => { aoFecharNovo(); navigate(`/property-owners/${criado.id}`); }}
      />
    </div>
  );
}
