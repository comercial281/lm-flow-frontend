import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { plural, dataCurta } from '@/lib/formato';
import { Card, Button, Input, Checkbox } from '@/components/ui/ds';
import { Seletor } from '@/components/base/Seletor';
import BarraSalvar from '@/components/base/BarraSalvar';
import { COR_DO_TOM } from '@/components/base/Aviso';
import BotoesDeEscolha from '@/components/base/BotoesDeEscolha';
import { mesmoConteudo, useAlteracoesNaoSalvas } from '@/hooks/useAlteracoesNaoSalvas';
import { Star, Search, Building2 } from 'lucide-react';
import {
  propertiesService,
  Property,
  TRANSACTION_TYPE_LABELS,
} from '@/services/properties/propertiesService';
import {
  portalsService,
  PortalAdType,
  PortalPublication,
} from '@/services/portals/portalsService';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import Carregando from '@/components/base/Carregando';
import EmptyState from '@/components/base/EmptyState';
import { extractError } from '@/utils/apiHelpers';
import {
  LEGADO_BASE,
  LEGADO_DESTAQUE,
  Estouro,
  contarPorTipo,
  estouros,
  estourosDoErro,
  mensagemDeEstouro,
  tipoBase,
} from '@/features/portals/adPlan';
import { tiposEmUso } from '@/features/portals/situacao';
import {
  FILTROS_DO_PORTAL_VAZIOS,
  type FiltrosDoPortal,
  type Mostrar,
  corretoresDaLista,
  filtrarImoveisDoPortal,
  temFiltro,
} from '@/features/portals/filtrosDoSeletor';
import { vencido } from '@/features/properties/emDia';

const FILTROS: Array<{ valor: Mostrar; rotulo: string }> = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'no_portal', rotulo: 'No portal' },
  { valor: 'fora', rotulo: 'Fora' },
];

const mapaDe = (pubs: PortalPublication[]) => new Map(pubs.map(p => [p.property_id, p.ad_type]));

// O index de imóveis entrega no máximo 200 por página (clamp do servidor). Até
// 2026-09-29 a tela pedia 500 de uma vez, recebia 200 calada e a carteira maior
// que isso sumia da lista — e do *Selecionar todos*. Agora vem página a página.
const POR_PAGINA = 200;
const MAX_PAGINAS = 50; // trava de segurança: 10 mil imóveis ativos

async function carregarAtivos(): Promise<Property[]> {
  const todos: Property[] = [];
  for (let page = 1; page <= MAX_PAGINAS; page++) {
    const res = await propertiesService.list({ status: 'active', per_page: POR_PAGINA, page });
    const lote = res.data ?? [];
    todos.push(...lote);
    const total = res.meta?.total;
    if (lote.length < POR_PAGINA || (total !== undefined && todos.length >= total)) break;
  }
  return todos;
}

interface Props {
  portalKey: string;
  /** Tipos de anúncio do portal, na ordem do servidor (o primeiro é o base). Vazio = servidor antigo. */
  adTypes: PortalAdType[];
  initialPublications: PortalPublication[];
  /** Modo legado (sem `adTypes`): a estrela de destaque de sempre. */
  supportsHighlight: boolean;
  onSaved?: () => void;
}

/**
 * Seleção de quais imóveis vão pro portal e em que TIPO DE ANÚNCIO cada um sai.
 *
 * O estado é um mapa imóvel → tipo. Com mais de um tipo o imóvel marcado ganha
 * um seletor; com um tipo só não há o que escolher. Sem tipos (servidor antigo)
 * vale a estrela de destaque, e o envio vai no formato legado.
 *
 * A cota de cada tipo é do plano do portal (o card *Plano de anúncios*). Estourar
 * NÃO trava: o contador fica vermelho, o *Salvar* continua habilitado, e o clique
 * abre "tem certeza?" com os tipos estourados — decisão do dono (2026-09-14). O
 * servidor faz a mesma conta e recusa com 422 sem a confirmação; quando as
 * contagens divergem (outra aba mexeu), o 422 abre o MESMO diálogo com as linhas
 * dele e reenvia confirmado.
 */
export default function PortalPropertiesSelector({
  portalKey,
  adTypes,
  initialPublications,
  supportsHighlight,
  onSaved,
}: Props) {
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const [properties, setProperties] = useState<Property[]>([]);
  const [publications, setPublications] = useState<Map<string, string>>(() => mapaDe(initialPublications));
  const [filtros, setFiltros] = useState<FiltrosDoPortal>(FILTROS_DO_PORTAL_VAZIOS);
  const mudar = (parcial: Partial<FiltrosDoPortal>) => setFiltros(f => ({ ...f, ...parcial }));
  const [todosOsTipos, setTodosOsTipos] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  const modoLegado = adTypes.length === 0;
  const base = modoLegado ? LEGADO_BASE : (tipoBase(adTypes)?.key ?? LEGADO_BASE);
  const comSeletor = adTypes.length > 1;

  const load = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      setProperties(await carregarAtivos());
    } catch {
      // Leitura de fundo não grita: a lista mostra o aviso no lugar dos imóveis.
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPublications(mapaDe(initialPublications)); }, [initialPublications]);

  // Alteração = o que a pessoa marcou difere do gravado. A publicação de imóvel
  // que saiu de Ativo não conta: ela é pausada no próximo salvar, mas sozinha
  // não acende a barra (a pessoa não mexeu em nada).
  const gravado = useMemo(() => [...mapaDe(initialPublications)].sort(), [initialPublications]);
  const temAlteracao = !mesmoConteudo([...publications].sort(), gravado);
  useAlteracoesNaoSalvas(temAlteracao);

  // Só imóvel ATIVO fica no portal. A publicação de um imóvel que saiu de Ativo
  // (vendido, alugado, inativo…) continua gravada, mas o feed já não o manda:
  // aqui ela some da contagem, da cota e do envio — salvar a pausa. Sem a lista
  // carregada não há como saber quem é ativo, e vale o que veio do servidor.
  const selecionadas = useMemo(() => {
    if (loading || loadFailed) return publications;
    const ativos = new Set(properties.map(p => p.id));
    return new Map([...publications].filter(([id]) => ativos.has(id)));
  }, [publications, properties, loading, loadFailed]);

  const counts = useMemo(() => contarPorTipo(adTypes, selecionadas), [adTypes, selecionadas]);
  const estourosLocais = useMemo(() => estouros(adTypes, counts), [adTypes, counts]);
  const emDestaque = useMemo(
    () => [...selecionadas.values()].filter(t => t === LEGADO_DESTAQUE).length,
    [selecionadas],
  );

  const filtered = useMemo(
    () => filtrarImoveisDoPortal(properties, publications, filtros),
    [properties, publications, filtros],
  );
  const filtrando = temFiltro(filtros);
  const corretores = useMemo(() => corretoresDaLista(properties), [properties]);
  // Tipo de anúncio só filtra onde há o que escolher: vários tipos, ou a estrela do modo legado.
  const tiposDoFiltro = modoLegado
    ? (supportsHighlight ? [{ key: LEGADO_BASE, label: 'Padrão' }, { key: LEGADO_DESTAQUE, label: 'Destaque' }] : [])
    : (comSeletor ? adTypes.map(t => ({ key: t.key, label: t.label })) : []);

  // Os contadores mostram só o tipo com cota ou com imóvel marcado agora; o resto
  // fica atrás de "+N tipos sem uso" (o ZAP tem seis tipos e quase ninguém usa todos).
  const tiposComContagem = useMemo(
    () => adTypes.map(t => ({ ...t, count: counts[t.key] ?? 0 })),
    [adTypes, counts],
  );
  const tiposVisiveis = todosOsTipos ? tiposComContagem : tiposEmUso(tiposComContagem);
  const tiposEscondidos = tiposComContagem.length - tiposEmUso(tiposComContagem).length;

  const toggle = (id: string) => {
    setPublications(prev => {
      const next = new Map(prev);
      if (next.has(id)) next.delete(id); else next.set(id, base);
      return next;
    });
  };

  const setAdType = (id: string, adType: string) => {
    setPublications(prev => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.set(id, adType);
      return next;
    });
  };

  const toggleFeatured = (id: string) => {
    setPublications(prev => {
      const atual = prev.get(id);
      if (atual === undefined) return prev;
      const next = new Map(prev);
      next.set(id, atual === LEGADO_DESTAQUE ? LEGADO_BASE : LEGADO_DESTAQUE);
      return next;
    });
  };

  // Quem já estava marcado mantém o tipo; quem entra agora entra no base.
  // Com filtro, age só no que aparece: filtrar "Leonardo" e desmarcar todos não
  // pode tirar do portal os imóveis do resto da equipe.
  const selectAll = () => {
    setPublications(prev => {
      const next = new Map(prev);
      filtered.forEach(p => { if (!next.has(p.id)) next.set(p.id, base); });
      return next;
    });
  };
  const deselectAll = () => {
    if (!filtrando) { setPublications(new Map()); return; }
    setPublications(prev => {
      const next = new Map(prev);
      filtered.forEach(p => next.delete(p.id));
      return next;
    });
  };

  const dialogoDeEstouro = (lista: Estouro[]) => confirmar({
    titulo: 'Plano de anúncios estourado',
    descricao: (
      <span className="block space-y-2">
        <span className="block space-y-1">
          {lista.map(e => (
            <span key={e.key} className="block">{mensagemDeEstouro([e])}</span>
          ))}
        </span>
        <span className="block">O portal rebaixa os que sobrarem para o tipo abaixo. Salvar mesmo assim?</span>
      </span>
    ),
    rotuloDaAcao: 'Salvar mesmo assim',
    destrutivo: true,
  });

  const enviar = async (pubs: PortalPublication[], confirmOverflow: boolean) => {
    setSaving(true);
    try {
      await portalsService.updatePublications(portalKey, pubs, { confirmOverflow });
      toast.success('Publicações atualizadas');
      onSaved?.();
    } catch (err) {
      // As contagens do servidor podem ter divergido das da tela (outra aba
      // mexeu no plano ou nos imóveis): o 422 traz as linhas DELE, e a pergunta
      // é a mesma. Já confirmado, não pergunta de novo — vira erro.
      const doServidor = estourosDoErro(err);
      if (doServidor.length > 0 && !confirmOverflow) {
        setSaving(false);
        if (await dialogoDeEstouro(doServidor)) await enviar(pubs, true);
        return;
      }
      toast.error(extractError(err).message || 'Erro ao salvar publicações');
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    if (modoLegado) {
      setSaving(true);
      try {
        const ids = [...selecionadas.keys()];
        const featuredIds = ids.filter(id => selecionadas.get(id) === LEGADO_DESTAQUE);
        await portalsService.updatePublicationsLegacy(portalKey, ids, featuredIds);
        toast.success('Publicações atualizadas');
        onSaved?.();
      } catch (err) {
        toast.error(extractError(err).message || 'Erro ao salvar publicações');
      } finally {
        setSaving(false);
      }
      return;
    }

    const pubs: PortalPublication[] = [...selecionadas].map(([property_id, ad_type]) => ({ property_id, ad_type }));
    let confirmOverflow = false;
    if (estourosLocais.length > 0) {
      if (!(await dialogoDeEstouro(estourosLocais))) return;
      confirmOverflow = true;
    }
    await enviar(pubs, confirmOverflow);
  };

  const limparFiltros = () => setFiltros(FILTROS_DO_PORTAL_VAZIOS);

  return (
    <div className="space-y-4">
      {!modoLegado && (
        // Sempre visível: ver a cota antes de estourar é o que faz a regra
        // parecer regra, e não castigo.
        <div className="flex flex-wrap items-center gap-2" data-testid="contadores-por-tipo">
          {tiposVisiveis.map(t => {
            const estourou = t.limit !== null && t.limit !== undefined && t.count > t.limit;
            const cheio = t.limit !== null && t.limit !== undefined && t.limit > 0 && t.count === t.limit;
            return (
              <span
                key={t.key}
                data-testid={`contador-${t.key}`}
                title={estourou ? 'Acima da cota do plano — o portal rebaixa os que sobrarem' : undefined}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
                  estourou
                    ? 'border-destructive/40 bg-destructive/10 text-destructive'
                    : cheio
                      ? COR_DO_TOM.atencao
                      : 'bg-muted/40 text-foreground'
                }`}
              >
                {t.label}
                <span className={estourou ? 'font-bold' : 'text-muted-foreground'}>
                  {t.limit === null || t.limit === undefined ? t.count : `${t.count} / ${t.limit}`}
                </span>
              </span>
            );
          })}
          {tiposEscondidos > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setTodosOsTipos(v => !v)}>
              {todosOsTipos ? 'Esconder tipos sem uso' : `+ ${plural(tiposEscondidos, 'tipo sem uso', 'tipos sem uso')}`}
            </Button>
          )}
        </div>
      )}

      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              className="pl-9"
              aria-label="Buscar imóvel"
              placeholder="Buscar por código, título, bairro ou cidade..."
              value={filtros.busca}
              onChange={e => mudar({ busca: e.target.value })}
            />
          </div>
          <BotoesDeEscolha rotulo="Mostrar" valor={filtros.mostrar} opcoes={FILTROS} aoEscolher={mostrar => mudar({ mostrar })} />
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          <Seletor className="w-full sm:w-52" aria-label="Corretor" value={filtros.corretor}
            onChange={e => mudar({ corretor: e.target.value })}>
            <option value="">Todos os corretores</option>
            {corretores.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Seletor>
          {tiposDoFiltro.length > 0 && (
            <Seletor className="w-full sm:w-60" aria-label="Tipo de anúncio" value={filtros.tipo}
              onChange={e => mudar({ tipo: e.target.value })}>
              <option value="">Qualquer tipo de anúncio</option>
              {tiposDoFiltro.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </Seletor>
          )}
          <Button variant={filtros.desatualizados ? 'default' : 'outline'} size="sm"
            aria-pressed={filtros.desatualizados}
            onClick={() => mudar({ desatualizados: !filtros.desatualizados })}>
            Desatualizados
          </Button>
          {/* Sem resultado, quem oferece limpar é o aviso da lista. */}
          {filtrando && filtered.length > 0 && <Button variant="ghost" size="sm" onClick={limparFiltros}>Limpar filtros</Button>}
        </div>
        <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
          <p className="mr-auto text-xs text-muted-foreground">
            {filtrando ? `${plural(filtered.length, 'imóvel', 'imóveis')} na lista · ` : ''}
            {plural(selecionadas.size, 'selecionado', 'selecionados')}
            {modoLegado && supportsHighlight ? ` · ${emDestaque} em destaque` : ''}
          </p>
          <Button variant="ghost" size="sm" onClick={selectAll}>
            {filtrando ? 'Selecionar os da lista' : 'Selecionar todos'}
          </Button>
          <Button variant="ghost" size="sm" onClick={deselectAll}>
            {filtrando ? 'Desmarcar os da lista' : 'Desmarcar todos'}
          </Button>
        </div>

        {loading ? (
          <Carregando linhas={4} rotulo="Carregando imóveis..." className="p-4" />
        ) : loadFailed ? (
          <EmptyState
            tipo="erro"
            tamanho="compacto"
            title="Não foi possível carregar os imóveis agora."
            aoTentarDeNovo={() => void load()}
            className="m-4"
          />
        ) : properties.length === 0 ? (
          <EmptyState
            tamanho="compacto"
            tipo="vazio"
            title="Nenhum imóvel ativo encontrado."
            description="Cadastre imóveis com status Ativo para publicá-los."
            className="m-4"
          />
        ) : filtered.length === 0 ? (
          <EmptyState tamanho="compacto" tipo="semResultado" aoLimparFiltros={limparFiltros} className="m-4" />
        ) : (
          <div className="max-h-[32rem] overflow-y-auto divide-y divide-border mt-2">
            {filtered.map(p => {
              const adType = publications.get(p.id);
              const isSelected = adType !== undefined;
              const isFeatured = adType === LEGADO_DESTAQUE;
              return (
                <div key={p.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40">
                  <Checkbox
                    aria-label={`Publicar ${p.code}`}
                    checked={isSelected}
                    onCheckedChange={() => toggle(p.id)}
                    className="shrink-0"
                  />
                  <div className="flex min-w-0 flex-1 cursor-pointer items-center gap-3" onClick={() => toggle(p.id)}>
                    <FotoDaLinha url={p.cover_photo_url} titulo={p.title} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        <span className="text-muted-foreground font-mono text-xs mr-2">{p.code}</span>
                        {p.title}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {TRANSACTION_TYPE_LABELS[p.transaction_type] ?? p.transaction_type}
                        {p.display_price ? ` · ${p.display_price}` : ''}
                        {p.address_neighborhood ? ` · ${p.address_neighborhood}` : ''}
                        {p.address_city ? `, ${p.address_city}` : ''}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{detalhesDaLinha(p)}</p>
                    </div>
                  </div>
                  {comSeletor && isSelected && (
                    <div className="w-36 sm:w-44 shrink-0">
                      <Seletor className="w-full"
                        aria-label={`Tipo de anúncio de ${p.code}`}
                        value={adType}
                        onChange={e => setAdType(p.id, e.target.value)}
                      >
                        {adTypes.map(t => (
                          <option key={t.key} value={t.key}>{t.label}</option>
                        ))}
                      </Seletor>
                    </div>
                  )}
                  {modoLegado && supportsHighlight && (
                    <button
                      type="button"
                      title={isFeatured ? 'Remover destaque' : 'Destacar neste portal'}
                      aria-label={isFeatured ? 'Remover destaque' : 'Destacar neste portal'}
                      onClick={() => toggleFeatured(p.id)}
                      disabled={!isSelected}
                      className={`shrink-0 p-1.5 rounded-md transition-colors ${
                        isFeatured
                          ? 'text-amber-500'
                          : isSelected
                            ? 'text-muted-foreground hover:text-amber-500'
                            : 'text-muted-foreground/30 cursor-not-allowed'
                      }`}
                    >
                      <Star className="h-4 w-4" fill={isFeatured ? 'currentColor' : 'none'} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
      <BarraSalvar
        visivel={temAlteracao}
        salvando={saving}
        aoSalvar={() => void save()}
        aoDescartar={() => setPublications(mapaDe(initialPublications))}
      />
      {dialogoDeConfirmacao}
    </div>
  );
}

// Foto grande na linha: no portal a equipe reconhece o imóvel pela foto, não pelo
// código (como no "Visualizar carga" da Kenlo). Guarda a URL que falhou, não um
// booleano, porque a linha é reaproveitada quando a lista filtra.
function FotoDaLinha({ url, titulo }: { url?: string | null; titulo: string }) {
  const [falhou, setFalhou] = useState<string | null>(null);
  const valida = url && url !== falhou ? url : null;
  return (
    <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-md bg-muted">
      {valida ? (
        <img src={valida} alt={titulo} loading="lazy" onError={() => setFalhou(valida)}
          className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <Building2 className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-muted-foreground/50" aria-hidden="true" />
      )}
    </div>
  );
}

function detalhesDaLinha(p: Property): string {
  const partes: string[] = [];
  if (p.bedrooms) partes.push(plural(p.bedrooms, 'dorm', 'dorms'));
  if (p.parking_spaces) partes.push(plural(p.parking_spaces, 'vaga', 'vagas'));
  if (p.photos_count) partes.push(plural(p.photos_count, 'foto', 'fotos'));
  const corretor = p.captor?.name ?? p.responsible?.name;
  if (corretor) partes.push(`${p.captor?.name ? 'Captador' : 'Responsável'}: ${corretor}`);
  if (p.updated_at) partes.push(`${vencido(p) ? 'Desatualizado · ' : ''}Atualizado ${dataCurta(p.updated_at)}`);
  return partes.join(' · ');
}
