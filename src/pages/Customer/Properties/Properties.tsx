import { useState, useEffect, useCallback, useRef, Suspense, lazy } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { numero, plural } from '@/lib/formato';
import {
  Button,
  Input,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/ds';
import {
  Plus,
  Search,
  Building2,
  Wand2,
  Loader2,
  List,
  LayoutGrid,
  Map as MapIcon,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react';
import {
  propertiesService,
  Property,
  PROPERTY_TYPE_LABELS,
} from '@/services/properties/propertiesService';
import { useFeature } from '@/contexts/TenantFeaturesContext';
import { useCan } from '@/hooks/useCan';
import { propertiesActionGates } from './propertiesActionGates';
import PropertyImportDialog from './PropertyImportDialog';
import PropertyPhotosDialog from './PropertyPhotosDialog';
import PropertyBookDialog from '@/components/properties/PropertyBookDialog';
import NoAccessState from '@/components/permissions/NoAccessState';
import { Seletor } from '@/components/base/Seletor';
import { isForbiddenError } from '@/services/core/forbidden';
import { lerRecorteImoveis, type FiltroDoLink } from '@/features/dashboard/links';
import { ChipDaDashboard } from '@/features/dashboard/ChipDaDashboard';
import { getTenantSlug } from '@/services/core/tenant';
import Abas from '@/components/base/Abas';
import { BaseHeader, EmptyState, Pagina } from '@/components/base';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import {
  ABA_NA_URL,
  FILTROS_VAZIOS,
  abaPadrao,
  filtrosAtivos,
  lerAba,
  rotuloDaSituacao,
  tipoDoImovel,
  tirarFiltro,
  type Filtros,
  type ListingKind,
} from '@/features/properties/listingKind';
import PainelDeFiltros, { type Facetas } from './lista/PainelDeFiltros';
import EtiquetasDosFiltros from './lista/EtiquetasDosFiltros';
import LinhaRevenda from './lista/LinhaRevenda';
import LinhaEmpreendimento from './lista/LinhaEmpreendimento';
import CartaoGrade from './lista/CartaoGrade';
import JanelaSituacao from './lista/JanelaSituacao';
import type { AcoesDoImovel, Permissoes } from './lista/MenuDoImovel';
import { lerVisao, paramsDaLista, type Ordem, type Visao } from './lista/estadoDaLista';

// O mapa (Leaflet) só baixa quando a pessoa abre a visão Mapa.
const VisaoMapa = lazy(() => import('./lista/VisaoMapa'));

const VISOES: { valor: Visao; rotulo: string; icone: LucideIcon }[] = [
  { valor: 'lista', rotulo: 'Lista', icone: List },
  { valor: 'grade', rotulo: 'Grade', icone: LayoutGrid },
  { valor: 'mapa', rotulo: 'Mapa', icone: MapIcon },
];

export default function Properties() {
  const navigate = useNavigate();
  const pode           = useCan();
  const acoes          = propertiesActionGates(useFeature('properties_create'), pode);
  const canCreate      = acoes.create;
  const canDelete      = acoes.delete;
  const canAiBatch     = useFeature('properties_ai_batch');
  const [properties, setProperties] = useState<Property[]>([]);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(true);
  const [deleting, setDeleting]     = useState(false);
  const [recusado, setRecusado]     = useState(false);

  const [searchParams, setSearchParams]       = useSearchParams();
  // Filtro que veio de um clique na Dashboard (?recorte=…). Lido uma vez ao abrir.
  const [recorte, setRecorte]                 = useState<FiltroDoLink | null>(() => lerRecorteImoveis(searchParams));
  const [search, setSearch]                   = useState(searchParams.get('q') ?? '');
  // A busca que a lista usa: anda 400 ms atrás do que a pessoa digita.
  const [buscaAtiva, setBuscaAtiva]           = useState(search);

  // ── Lista nova: abas Empreendimentos/Revenda, filtro retrátil, linhas ──────
  // `kind` nulo = ainda não sabemos a aba (a padrão é a com mais cadastros).
  const [kind, setKind]               = useState<ListingKind | null>(() => lerAba(searchParams));
  const [contagem, setContagem]       = useState<{ development: number; resale: number } | null>(null);
  const [filtros, setFiltros]         = useState<{ development: Filtros; resale: Filtros }>(FILTROS_VAZIOS);
  const [painelAberto, setPainelAberto] = useState(false);
  const [ordem, setOrdem]             = useState<Ordem>('recent');
  const [visao, setVisao]             = useState<Visao>(() => lerVisao(searchParams));
  const [pagina, setPagina]           = useState(1);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [erroDeCarga, setErroDeCarga] = useState(false);
  const [facetas, setFacetas]         = useState<Facetas | null>(null);
  const [situacaoDe, setSituacaoDe]   = useState<Property | null>(null);
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();

  const [importOpen, setImportOpen]     = useState(false);
  // Aberto pela volta da revisão (?importar=1): o lote reabre na lista de onde saiu.
  const [voltouDaRevisao, setVoltouDaRevisao] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [toDelete, setToDelete]                 = useState<Property | null>(null);
  const [propertyScores, setPropertyScores]     = useState<Record<string, number>>({});

  const [photosProperty, setPhotosProperty] = useState<Property | null>(null);
  const [bookProperty, setBookProperty] = useState<Property | null>(null);

  // Batch generate
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchSelected, setBatchSelected]   = useState<Set<string>>(new Set());
  const [batchRunning, setBatchRunning]     = useState(false);
  const [batchResults, setBatchResults]     = useState<Array<{
    id: string; status: 'ok' | 'error'; headline?: string; description?: string; error?: string;
  }> | null>(null);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Só a resposta do último pedido vale: trocar de aba rápido não pode deixar a
  // lista da aba anterior aparecer por cima da atual.
  const ultimoPedido = useRef(0);

  const filtrosDaAba = kind ? filtros[kind] : null;

  const load = useCallback(async (pag = 1) => {
    // Na visão Mapa a lista não aparece: nada de recarregar atrás do mapa.
    if (!kind || !filtrosDaAba || visao === 'mapa') return;
    const pedido = ++ultimoPedido.current;
    if (pag > 1) setCarregandoMais(true); else setLoading(true);
    setRecusado(false);
    setErroDeCarga(false);
    try {
      const res = await propertiesService.list(paramsDaLista({
        kind, filtros: filtrosDaAba, busca: buscaAtiva, ordem, recorte: recorte?.params ?? null, pagina: pag,
      }));
      if (pedido !== ultimoPedido.current) return;
      const novos = res.data ?? [];
      // Página 2 em diante é o "Mostrar mais": acrescenta no fim.
      setProperties(prev => (pag > 1 ? [...prev, ...novos.filter(n => !prev.some(p => p.id === n.id))] : novos));
      setTotal(res.meta?.total ?? 0);
      setPagina(pag);
    } catch (e) {
      if (pedido !== ultimoPedido.current) return;
      if (isForbiddenError(e)) setRecusado(true);
      else if (pag > 1) toast.error('Não deu pra carregar mais imóveis');
      else setErroDeCarga(true);
    } finally {
      if (pedido === ultimoPedido.current) { setLoading(false); setCarregandoMais(false); }
    }
  }, [kind, filtrosDaAba, buscaAtiva, ordem, recorte, visao]);

  // Recarrega da página 1 sempre que muda a aba, os filtros dela, a ordem, o
  // recorte da Dashboard, a busca (já com o atraso de 400 ms) ou quando volta do mapa.
  useEffect(() => { load(1); }, [load]);

  // Quantos há em cada aba, com o mesmo recorte da lista (link da Dashboard e
  // "só os meus"), mas sem os filtros do painel: é o total da aba.
  const contar = useCallback(
    () => propertiesService.contarPorTipo(recorte?.params ?? {}),
    [recorte],
  );
  // Só a última contagem pedida vale: uma recontagem começada com o recorte
  // antigo não pode sobrescrever a do recorte novo.
  const ultimaContagem = useRef(0);
  const recontar = useCallback(() => {
    const pedido = ++ultimaContagem.current;
    contar()
      .then(c => {
        if (pedido !== ultimaContagem.current) return;
        setContagem(c);
        setKind(k => k ?? abaPadrao(c));
      })
      .catch(() => { if (pedido === ultimaContagem.current) setKind(k => k ?? 'resale'); });
  }, [contar]);
  useEffect(() => {
    recontar();
    // Sair da tela invalida a resposta que ainda estiver no ar.
    return () => { ultimaContagem.current++; };
  }, [recontar]);

  // Bairros, tipos e captadores da aba, para os seletores do painel. Leitura de
  // fundo: falha deixa os seletores só com "Todos", sem aviso.
  const soOsMeus = recorte?.params.mine === '1';
  useEffect(() => {
    if (!kind) return;
    let vivo = true;
    setFacetas(null);
    propertiesService.facets(kind, { mine: soOsMeus })
      .then(f => { if (vivo) setFacetas(f); })
      .catch(() => { if (vivo) setFacetas(null); });
    return () => { vivo = false; };
  }, [kind, soOsMeus]);

  useEffect(() => () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); }, []);

  // Volta da revisão de um imóvel do lote (/properties/:id/editar?de=lote): o
  // lote reabre na lista de onde a pessoa saiu e o parâmetro sai.
  const importarNoEndereco = searchParams.get('importar') === '1';
  useEffect(() => {
    if (!importarNoEndereco) return;
    setVoltouDaRevisao(true);
    setImportOpen(true);
    setSearchParams(prev => {
      const novo = new URLSearchParams(prev);
      novo.delete('importar');
      return novo;
    }, { replace: true });
  }, [importarNoEndereco, setSearchParams]);

  // Busca global (Ctrl+K) com a tela já aberta: o endereço traz ?q= e ?aba= novos.
  // Na abertura, os dois já entram pelo useState lá em cima.
  const qDoEndereco = searchParams.get('q');
  const ultimoQ = useRef(qDoEndereco);
  useEffect(() => {
    if (qDoEndereco === ultimoQ.current) return;
    ultimoQ.current = qDoEndereco;
    if (qDoEndereco == null) return;
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    setSearch(qDoEndereco);
    setBuscaAtiva(qDoEndereco);
    const aba = lerAba(searchParams);
    if (aba && aba !== kind) {
      setKind(aba);
      setProperties([]);
      setTotal(0);
      setLoading(true);
    }
  }, [qDoEndereco, searchParams, kind]);

  const handleSearch = (val: string) => {
    setSearch(val);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => setBuscaAtiva(val), 400);
  };

  // Grava ?aba= e ?visao= sem mexer no resto do endereço (o recorte da Dashboard fica).
  const gravarNoEndereco = (chave: string, valor: string | null) => {
    setSearchParams(prev => {
      const novo = new URLSearchParams(prev);
      if (valor) novo.set(chave, valor); else novo.delete(chave);
      return novo;
    }, { replace: true });
  };

  const trocarAba = (k: ListingKind) => {
    if (k === kind) return;
    setKind(k);
    // A lista da outra aba sai na hora; o esqueleto fica até a nova chegar.
    setProperties([]);
    setTotal(0);
    setLoading(true);
    gravarNoEndereco('aba', ABA_NA_URL[k]);
  };

  const trocarVisao = (v: Visao) => {
    setVisao(v);
    gravarNoEndereco('visao', v === 'lista' ? null : v);
  };

  // Tira o filtro do link (e só ele: aba e visão continuam no endereço).
  const tirarRecorte = () => {
    setRecorte(null);
    setSearchParams(prev => {
      const novo = new URLSearchParams(prev);
      ['recorte', 'desde', 'ate', 'meus'].forEach(c => novo.delete(c));
      return novo;
    }, { replace: true });
  };

  const mudarFiltros = (f: Filtros) => {
    if (!kind) return;
    // O link manda a própria situação (ex.: "Sem fotos" é Disponível). Quem
    // escolhe outra situação no painel tira o link, senão o painel diria
    // "Vendido" e a lista mostraria os disponíveis.
    const nova = (f as { situacao?: string }).situacao;
    const antes = (filtros[kind] as { situacao?: string }).situacao;
    if (recorte?.params.status && nova && nova !== antes) tirarRecorte();
    setFiltros(prev => ({ ...prev, [kind]: f }));
  };

  const limparFiltrosDaAba = () => {
    if (!kind) return;
    setFiltros(prev => ({ ...prev, [kind]: FILTROS_VAZIOS[kind] }));
  };

  // "Nada encontrado → Limpar filtros": tira tudo o que estreita a lista.
  const limparFiltros = () => {
    limparFiltrosDaAba();
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    setSearch('');
    setBuscaAtiva('');
    if (recorte) tirarRecorte();
  };

  // O cadastro é uma página: /properties/new?tipo=… e /properties/:id/editar.
  const openCreate = (kindNovo: ListingKind) => navigate(`/properties/new?tipo=${ABA_NA_URL[kindNovo]}`);
  const openEdit = (p: Property) => navigate(`/properties/${p.id}/editar`);

  // Situação escolhida na janela "Mudar situação…" (não muda mais direto no card).
  // Devolve se salvou, pra janela saber se fecha.
  const handleStatusChange = async (p: Property, newStatus: string): Promise<boolean> => {
    if (newStatus === p.status) return true;
    try {
      const updated = await propertiesService.update(p.id, { status: newStatus });
      setProperties(prev => prev.map(x => x.id === updated.id ? updated : x));
      recontar();
      toast.success(`Situação alterada para ${rotuloDaSituacao(tipoDoImovel(p), newStatus)}`);
      return true;
    } catch (e) {
      const err = e as { response?: { data?: { error?: { message?: string }; message?: string } } };
      const msg = err?.response?.data?.error?.message || err?.response?.data?.message || 'Não deu pra alterar a situação';
      toast.error(msg);
      return false;
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await propertiesService.delete(toDelete.id);
      setProperties(prev => prev.filter(p => p.id !== toDelete.id));
      setTotal(t => Math.max(0, t - 1));
      recontar();
      toast.success('Imóvel excluído');
      setDeleteDialogOpen(false);
    } catch {
      toast.error('Não deu pra excluir o imóvel');
    } finally {
      setDeleting(false);
    }
  };

  // Relê um imóvel e troca no lugar (contagens ficam como estão). Falha não avisa:
  // a linha só fica com a capa antiga até a próxima recarga.
  const atualizarImovel = async (id: string) => {
    try {
      const novo = await propertiesService.get(id);
      setProperties(prev => prev.map(p => (p.id === novo.id ? novo : p)));
    } catch { /* leitura de fundo */ }
  };

  const handleCalculateScore = async (id: string) => {
    try {
      const result = await propertiesService.calculateScore(id);
      setPropertyScores(prev => ({ ...prev, [id]: result.score }));
      toast.success(`Força do anúncio: ${result.score}%`);
    } catch {
      toast.error('Não deu pra calcular a força do anúncio');
    }
  };

  const handleBatchGenerate = async () => {
    if (batchSelected.size === 0) { toast.error('Selecione ao menos um imóvel'); return; }
    setBatchRunning(true);
    setBatchResults(null);
    try {
      const results = await propertiesService.batchGenerateDescriptions(Array.from(batchSelected));
      setBatchResults(results);
      const ok = results.filter(r => r.status === 'ok').length;
      toast.success(plural(ok, 'descrição gerada', 'descrições geradas'));
      load(1);
    } catch {
      toast.error('Erro na geração em lote');
    } finally {
      setBatchRunning(false);
    }
  };

  const toggleBatchSelect = (id: string) => {
    setBatchSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ── Ações do menu ⋮ de cada linha ─────────────────────────────────────────
  // Página pública do imóvel, no site da própria imobiliária.
  const abrirNoSite = (p: Property) => {
    const slug = getTenantSlug();
    if (!slug) { toast.error('Não achei o endereço do seu site'); return; }
    window.open(`${window.location.origin}/imovel/${slug}/${p.code}`, '_blank', 'noopener');
  };

  const moverDeAba = async (p: Property) => {
    const outro: ListingKind = tipoDoImovel(p) === 'development' ? 'resale' : 'development';
    const destino = outro === 'resale' ? 'Revenda' : 'Empreendimentos';
    const texto = outro === 'resale'
      ? 'Ele passa a aparecer em Comprar e Alugar no site. Fase da obra, previsão de entrega e tipologias ficam guardadas, mas não aparecem mais.'
      : 'Ele passa a aparecer em Lançamentos no site e ganha fase da obra e tipologias para preencher.';
    if (!(await confirmar({ titulo: `Mover ${p.code} para ${destino}?`, descricao: texto, rotuloDaAcao: 'Mover' }))) return;
    try {
      await propertiesService.update(p.id, { listing_kind: outro });
      toast.success(`Movido para ${destino}`);
      setProperties(prev => prev.filter(x => x.id !== p.id));
      setTotal(t => Math.max(0, t - 1));
      recontar();
    } catch (e) {
      const err = e as { response?: { data?: { error?: { message?: string }; message?: string } } };
      toast.error(err?.response?.data?.error?.message || err?.response?.data?.message || 'Não deu pra mover o imóvel');
    }
  };

  const acoesDoImovel: AcoesDoImovel = {
    editar: openEdit,
    fotos: p => setPhotosProperty(p),
    book: p => setBookProperty(p),
    landing: p => navigate(`/properties/${p.id}/landing`),
    site: abrirNoSite,
    forca: p => handleCalculateScore(p.id),
    situacao: p => setSituacaoDe(p),
    mover: moverDeAba,
    excluir: p => { setToDelete(p); setDeleteDialogOpen(true); },
  };
  const permissoes: Permissoes = { editar: pode('properties', 'update'), excluir: canDelete };

  if (recusado) return <NoAccessState />;

  const filtrosDaTela = kind
    ? filtrosAtivos(kind, filtros[kind], t => PROPERTY_TYPE_LABELS[t] ?? t, id => facetas?.captors.find(c => c.id === id)?.name ?? 'captador')
    : [];
  const temFiltro = filtrosDaTela.length > 0 || buscaAtiva.trim() !== '';
  const totalDaAba = kind && contagem ? contagem[kind] : null;
  const nomeDaAba = (n: number) => (kind === 'development'
    ? plural(n, 'empreendimento', 'empreendimentos')
    : plural(n, 'imóvel de revenda', 'imóveis de revenda'));
  const abaVazia = totalDaAba === 0 && !temFiltro && !recorte && properties.length === 0;

  const esqueleto = (
    <div role="status" className="mt-4 flex flex-col gap-2.5">
      <span className="sr-only">Carregando imóveis</span>
      {[0, 1, 2].map(i => <div key={i} className="h-28 animate-pulse rounded-xl border bg-muted/40" />)}
    </div>
  );

  const conteudo = !kind ? null
    : visao === 'mapa' ? (
      <Suspense fallback={esqueleto}><VisaoMapa kind={kind} /></Suspense>
    ) : erroDeCarga ? (
      <EmptyState tipo="erro" aoTentarDeNovo={() => load(1)} />
    ) : loading && properties.length === 0 ? esqueleto
    : abaVazia ? (
      kind === 'development' ? (
        <EmptyState
          icon={Building2}
          title="Você ainda não tem empreendimento cadastrado"
          description="Empreendimento é lançamento ou prédio com várias plantas. Ele aparece em Lançamentos no seu site e a IA apresenta as tipologias."
          action={canCreate ? { label: 'Cadastrar o primeiro empreendimento', onClick: () => setImportOpen(true) } : undefined}
        />
      ) : (
        <EmptyState
          icon={Building2}
          title="Você ainda não tem imóvel de revenda"
          description="Revenda é o imóvel de terceiro, à venda ou para alugar. Ele aparece em Comprar e Alugar no seu site."
          action={canCreate ? { label: 'Cadastrar o primeiro imóvel', onClick: () => setImportOpen(true) } : undefined}
        />
      )
    ) : properties.length === 0 ? (
      <EmptyState tipo="semResultado" aoLimparFiltros={limparFiltros} />
    ) : (
      <>
        {visao === 'grade' ? (
          <div aria-busy={loading} className={`grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3.5 ${loading ? 'opacity-60' : ''}`}>
            {properties.map(p => (
              <CartaoGrade key={p.id} p={p} acoes={acoesDoImovel} permissoes={permissoes} forca={propertyScores[p.id]} />
            ))}
          </div>
        ) : (
          <div aria-busy={loading} className={`flex flex-col gap-2.5 ${loading ? 'opacity-60' : ''}`}>
            {properties.map(p => (tipoDoImovel(p) === 'development'
              ? <LinhaEmpreendimento key={p.id} p={p} acoes={acoesDoImovel} permissoes={permissoes} forca={propertyScores[p.id]} />
              : <LinhaRevenda key={p.id} p={p} acoes={acoesDoImovel} permissoes={permissoes} forca={propertyScores[p.id]} />))}
          </div>
        )}
        <div className="mt-4 flex flex-col items-center gap-2 text-xs text-muted-foreground">
          <span>Mostrando {numero(properties.length)} de {numero(total)}</span>
          {properties.length < total && (
            // Travado enquanto a lista recarrega: com filtro novo e página antiga,
            // a página 2 do filtro novo grudaria na página 1 do antigo.
            <Button variant="outline" onClick={() => load(pagina + 1)} disabled={carregandoMais || loading}>
              {carregandoMais ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Carregando...</> : 'Mostrar mais'}
            </Button>
          )}
        </div>
      </>
    );

  return (
    <Pagina
      cabecalho={
        <BaseHeader
          title="Meus imóveis"
          // Com recorte da Dashboard a soma seria do recorte; o chip já diz o que está filtrado.
          subtitle={contagem && !recorte
            ? `Empreendimentos e imóveis de revenda da imobiliária. · ${plural(contagem.development + contagem.resale, 'cadastro', 'cadastros')}`
            : 'Empreendimentos e imóveis de revenda da imobiliária.'}
          aDireita={kind && canAiBatch && (
            <Button variant="outline" onClick={() => { setBatchSelected(new Set()); setBatchResults(null); setBatchModalOpen(true); }}>
              <Wand2 className="h-4 w-4 mr-2" />
              Gerar descrições com IA
            </Button>
          )}
          primaryAction={kind && canCreate
            ? { label: kind === 'development' ? 'Novo empreendimento' : 'Novo imóvel', icon: <Plus className="h-4 w-4" />, onClick: () => setImportOpen(true) }
            : undefined}
        />
      }
    >
        {/* Abas e lista só depois de saber a aba (a padrão é a com mais cadastros). */}
        {!kind ? esqueleto : (
          <>
            <Abas
              rotulo="Tipo de cadastro"
              ativa={kind}
              aoTrocar={k => trocarAba(k as ListingKind)}
              abas={[
                { chave: 'development', rotulo: `Empreendimentos (${contagem ? numero(contagem.development) : '…'})` },
                { chave: 'resale', rotulo: `Revenda (${contagem ? numero(contagem.resale) : '…'})` },
              ]}
            />

            {/* Barra: busca, filtros, ordem e visão. O mapa mostra a aba inteira (não
                usa busca, filtro, ordem nem o link da Dashboard): lá fica só a visão. */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {visao !== 'mapa' && (
                <>
                  <div className="relative min-w-48 max-w-md flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      aria-label="Buscar"
                      placeholder={kind === 'development' ? 'Buscar por nome, código ou bairro' : 'Buscar por código, bairro ou rua'}
                      value={search}
                      onChange={e => handleSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Button variant="outline" aria-expanded={painelAberto} onClick={() => setPainelAberto(a => !a)}>
                    <SlidersHorizontal className="h-4 w-4 mr-2" />
                    Filtros
                    {filtrosDaTela.length > 0 && (
                      <span className="ml-1.5 rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                        {filtrosDaTela.length}
                      </span>
                    )}
                  </Button>
                  <Seletor aria-label="Ordenar" value={ordem} onChange={e => setOrdem(e.target.value as Ordem)} className="w-52">
                    <option value="recent">Mais recentes</option>
                    <option value="updated">Atualizados por último</option>
                    <option value="price_asc">Menor preço</option>
                    <option value="price_desc">Maior preço</option>
                  </Seletor>
                </>
              )}
              <div role="group" aria-label="Visão" className="inline-flex rounded-md border border-input p-0.5">
                {VISOES.map(({ valor, rotulo, icone: Icone }) => (
                  <button
                    key={valor}
                    type="button"
                    aria-pressed={visao === valor}
                    onClick={() => trocarVisao(valor)}
                    className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium ${visao === valor ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    <Icone className="h-3.5 w-3.5" aria-hidden="true" />
                    {rotulo}
                  </button>
                ))}
              </div>
              {recorte && visao !== 'mapa' && <ChipDaDashboard rotulo={recorte.rotulo} onTirar={tirarRecorte} />}
            </div>

            {painelAberto && visao !== 'mapa' && (
              <PainelDeFiltros
                // Um painel por aba: preço digitado e ainda não enviado vai para a aba dele.
                key={kind}
                kind={kind}
                filtros={filtros[kind]}
                facetas={facetas}
                aoMudar={mudarFiltros}
                aoLimpar={limparFiltrosDaAba}
                aoRecolher={() => setPainelAberto(false)}
              />
            )}

            {visao !== 'mapa' && (
              <EtiquetasDosFiltros
                itens={filtrosDaTela}
                aoTirar={chave => setFiltros(prev => ({ ...prev, [kind]: tirarFiltro(kind, prev[kind], chave) }))}
                aoLimparTudo={limparFiltrosDaAba}
              />
            )}

            {visao !== 'mapa' && !(loading && properties.length === 0) && !erroDeCarga && totalDaAba != null && !abaVazia && (
              <p className="mt-4 text-sm text-muted-foreground">
                {temFiltro ? `${numero(total)} de ${nomeDaAba(totalDaAba)}` : nomeDaAba(totalDaAba)}
              </p>
            )}

            <div className="mt-3">{conteudo}</div>
          </>
        )}

      {/* Delete dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir imóvel</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir <strong>{toDelete?.title}</strong>? O histórico será preservado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Photos dialog */}
      {photosProperty && (
        <PropertyPhotosDialog
          property={photosProperty}
          // Ao fechar, relê só este imóvel: trocar a capa (ou subir/apagar foto) tem
          // que refletir na miniatura, sem perder as páginas do "Mostrar mais" e a rolagem.
          onClose={() => { const id = photosProperty.id; setPhotosProperty(null); atualizarImovel(id); }}
        />
      )}

      {/* Book dialog — ver/baixar o PDF do book salvo no imóvel */}
      {bookProperty && (
        <PropertyBookDialog
          property={bookProperty}
          onClose={() => setBookProperty(null)}
        />
      )}

      {/* Importação em lote com IA (books/URLs -> rascunhos) */}
      <PropertyImportDialog
        open={importOpen}
        onClose={() => { setImportOpen(false); setVoltouDaRevisao(false); }}
        retomarRevisao={voltouDaRevisao}
        onManual={() => { setImportOpen(false); openCreate(kind ?? 'resale'); }}
        onReview={id => navigate(`/properties/${id}/editar?de=lote`)}
        onChanged={() => { load(1); recontar(); }}
        listingKind={kind ?? undefined}
      />

      {/* Mudar situação: a pessoa escolhe, lê o efeito e salva. */}
      <JanelaSituacao
        imovel={situacaoDe}
        aoFechar={() => setSituacaoDe(null)}
        aoSalvar={async status => {
          if (situacaoDe && await handleStatusChange(situacaoDe, status)) setSituacaoDe(null);
        }}
      />

      {dialogoDeConfirmacao}


      {/* Batch generate dialog */}
      <Dialog open={batchModalOpen} onOpenChange={open => { if (!batchRunning) setBatchModalOpen(open); }}>
        <DialogContent className="max-w-xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-primary" />
              Geração de descrições em lote
            </DialogTitle>
            <DialogDescription>
              Selecione os imóveis e gere descrições com IA para todos de uma vez.
            </DialogDescription>
          </DialogHeader>

          {!batchResults ? (
            <>
              <div className="flex items-center justify-between mb-2 mt-1">
                <span className="text-xs text-muted-foreground">{batchSelected.size} selecionado{batchSelected.size !== 1 ? 's' : ''}</span>
                <button
                  className="text-xs text-primary hover:underline"
                  onClick={() => setBatchSelected(
                    batchSelected.size === properties.length
                      ? new Set()
                      : new Set(properties.map(p => p.id))
                  )}
                >
                  {batchSelected.size === properties.length ? 'Desselecionar todos' : 'Selecionar todos'}
                </button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                {properties.map(p => (
                  <label key={p.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={batchSelected.has(p.id)}
                      onChange={() => toggleBatchSelect(p.id)}
                      className="rounded flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.title}</p>
                      <p className="text-xs text-muted-foreground">{p.code} · {PROPERTY_TYPE_LABELS[p.property_type] ?? p.property_type}</p>
                    </div>
                    {p.description && <span className="text-xs text-emerald-600 flex-shrink-0">desc</span>}
                  </label>
                ))}
              </div>
              <DialogFooter className="mt-3">
                <Button variant="outline" onClick={() => setBatchModalOpen(false)}>Cancelar</Button>
                <Button onClick={handleBatchGenerate} disabled={batchRunning || batchSelected.size === 0}>
                  {batchRunning
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Gerando...</>
                    : <><Wand2 className="h-4 w-4 mr-2" />Gerar {batchSelected.size > 0 ? batchSelected.size : ''} descriç{batchSelected.size !== 1 ? 'ões' : 'ão'}</>
                  }
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto space-y-2 mt-1 pr-1">
                {batchResults.map(r => {
                  const prop = properties.find(p => p.id === r.id);
                  return (
                    <div key={r.id} className={`p-3 rounded-lg border ${r.status === 'ok' ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/20' : 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20'}`}>
                      <p className="text-sm font-medium truncate">{prop?.title ?? r.id}</p>
                      {r.status === 'ok' && r.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.description}</p>
                      )}
                      {r.status === 'error' && (
                        <p className="text-xs text-red-600 mt-1">{r.error}</p>
                      )}
                    </div>
                  );
                })}
              </div>
              <DialogFooter className="mt-3">
                <Button onClick={() => setBatchModalOpen(false)}>Fechar</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Pagina>
  );
}

// PropertyBookDialog — visualiza e baixa o book (PDF) salvo no imóvel.
// PropertyBookDialog foi extraído para @/components/properties/PropertyBookDialog
// (compartilhado com o bloco do book no cadastro).
