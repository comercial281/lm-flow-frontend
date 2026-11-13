import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useCtxDoSite } from '@/features/siteBuilder/public/useTenantDoSite';
import { API, filterProperties, usePortalData, type PortalFilters, type PortalTab } from '../portalShared';
import { chaveDaLista, fetchListaDoSite, type ListaDoSite } from '../portalProperties';
import { opcoesDePreco } from '@/features/siteBuilder/public/faixasDePreco';
import { abaDaBusca, filtrosDaUrl, opcaoDoTexto } from '@/features/siteBuilder/public/filtros';
import { usePortalTracking } from '../usePortalTracking';
import { useIconeDaAba } from '@/features/siteBuilder/public/useIconeDaAba';
import { ehOrdem, resolverLista, type Ordem } from '@/features/siteBuilder/public/listaConfig';
import { ordenarImoveis } from '@/features/siteBuilder/public/ordenar';
import type { SugestaoDeLugar } from '@/features/siteBuilder/public/sugestoesDeLugar';

/* ────────────────────────────────────────────────────────────────────────────
   Lógica da página de Imóveis (busca), a mesma pros dois desenhos (Clássico e
   Moderno). Estado de filtro vive na URL (query params) → resultado
   compartilhável, bookmarkável e com botão "voltar" do navegador funcionando.
   Filtragem é client-side sobre o inventário já carregado (mesmo endpoint da
   home). Visita, rastreamento e ícone da aba também moram aqui.
──────────────────────────────────────────────────────────────────────────── */

/**
 * Seletor de cidade/bairro: a URL pode vir com "campinas" (vitrine, atalho) e a
 * opção é "Campinas" — marca a equivalente. Sem nenhuma, o valor da URL vira
 * opção: com filtro ativo o campo nunca mostra o rótulo vazio.
 */
function opcoesDeTexto(lista: string[], valor: string): { valor: string; opcoes: [string, string][] } {
  const marcada = opcaoDoTexto(lista, valor);
  const opcoes = lista.map((x): [string, string] => [x, x]);
  return { valor: marcada, opcoes: marcada && !lista.includes(marcada) ? [...opcoes, [marcada, marcada]] : opcoes };
}

/** Espera sem mudança na URL antes de contar a visita da busca. */
const ESPERA_VISITA_MS = 1500;

/**
 * Quantos cards aparecem por vez. O catálogo chega INTEIRO (centenas de
 * imóveis); o "Mostrar mais" evita despejar tudo numa página só. O contador do
 * título continua sendo o total filtrado — é ele que responde "quantos tem".
 */
export const RESULTS_PAGE_SIZE = 30;

/** Patch de filtros na URL: valor vazio tira a chave. */
export type PatchDaBusca = Partial<Record<keyof PortalFilters | 'sort', string>>;

export function useBuscaDosImoveis(tenant: string | undefined) {
  const [params, setParams] = useSearchParams();
  const dados = usePortalData(tenant);
  const { state, site, items, cities, hoods, abas, manutencao } = dados;
  const { pathname, search } = useLocation();
  const ctx = useCtxDoSite(tenant ?? '');

  // Página de lista (/imoveis/a-venda/casa/sorocaba): o servidor diz quem entra
  // e o nome dela, com a mesma regra do <head> que o Google leu. undefined =
  // ainda perguntando; null = a lista não existe (404 no servidor).
  const chave = chaveDaLista(pathname);
  const [respostaDaLista, setRespostaDaLista] = useState<{ chave: string; valor: ListaDoSite | null | 'erro' } | null>(null);
  useEffect(() => {
    if (!tenant || !chave) return;
    let vivo = true;
    fetchListaDoSite(API, tenant, chave).then(
      valor => { if (vivo) setRespostaDaLista({ chave, valor }); },
      () => { if (vivo) setRespostaDaLista({ chave, valor: 'erro' }); },
    );
    return () => { vivo = false; };
  }, [tenant, chave]);
  const listaDoServidor = chave ? (respostaDaLista?.chave === chave ? respostaDaLista.valor : undefined) : null;
  const listaOk = listaDoServidor && listaDoServidor !== 'erro' ? listaDoServidor : null;
  useEffect(() => {
    if (state === 'ok' && listaOk) document.title = `${listaOk.titulo} | ${site.name || 'Imóveis'}`;
  }, [state, listaOk, site.name]);

  // Uma visita por carga da página, levando os filtros (pathname + query) de quando a URL
  // assentou pela 1ª vez. Mexer nos filtros depois não conta visita nova.
  const caminhoAtual = pathname + search;
  const [caminhoRegistrado, setCaminhoRegistrado] = useState<string | null>(null);
  useEffect(() => {
    if (caminhoRegistrado) return;
    const t = setTimeout(() => setCaminhoRegistrado(caminhoAtual), ESPERA_VISITA_MS);
    return () => clearTimeout(t);
  }, [caminhoAtual, caminhoRegistrado]);
  // Em manutenção nada de rastreamento nem visita: a página é a de manutenção.
  usePortalTracking(state === 'ok' && !manutencao ? site : null, tenant, caminhoRegistrado ? { kind: 'search', path: caminhoRegistrado } : null);
  useIconeDaAba(site.branding?.favicon_url);

  // Só vale aba visível; a da URL que não é (desligada ou sem imóvel) cai na primeira visível.
  // Na lista, a aba vem do negócio do caminho (para-alugar e temporada = Alugar).
  const tabDaLista: PortalTab | null = chave ? (/^(para-alugar|temporada)(\/|$)/.test(chave) ? 'rent' : 'sale') : null;
  const tab: PortalTab = abaDaBusca(params.get('tab'), abas, tabDaLista);

  const filters: PortalFilters = useMemo(() => filtrosDaUrl(params, tab), [params, tab]);

  // Atualiza um ou mais filtros na URL. `replace` evita poluir o histórico
  // (usado na digitação do código); os controles discretos empurram histórico
  // para o botão "voltar" restaurar o filtro anterior.
  const update = (patch: PatchDaBusca, replace = false) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v); else next.delete(k);
    }
    setParams(next, { replace });
  };

  // Campo "Condomínio, bairro ou cidade": o texto é local enquanto se digita; Enter ou sair do
  // campo grava `place`. Só condomínio e place da URL preenchem o campo (bairro/cidade ficam nos selects).
  const [textoDoLugar, setTextoDoLugar] = useState(filters.condominium || filters.place || '');
  const escolhida = useRef<SugestaoDeLugar | null>(null);
  // O que o campo mostra pela URL: o rótulo da sugestão escolhida enquanto a URL ainda é a dela
  // (qualquer grupo); mudou o select, o campo volta a só condomínio/place.
  const escolhidaNaUrl = () => {
    const e = escolhida.current;
    return !!e && !filters.place
      && (e.filtros.condominium ?? '') === filters.condominium
      && (e.filtros.neighborhood ?? '') === filters.neighborhood
      && (e.filtros.city ?? '') === filters.city;
  };
  const textoDaUrl = () => (escolhidaNaUrl() ? escolhida.current!.rotulo : (filters.condominium || filters.place || ''));
  useEffect(() => {
    setTextoDoLugar(textoDaUrl());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.condominium, filters.place, filters.neighborhood, filters.city]);
  const escolherLugar = (s: SugestaoDeLugar) => {
    escolhida.current = s;
    setTextoDoLugar(s.rotulo);
    update({ place: '', condominium: '', neighborhood: '', city: '', ...s.filtros });
  };
  // Os filtros da sugestão escolhida que ainda estão na URL (bairro, cidade): saem junto com o texto dela.
  const filtrosDaEscolhida = (): PatchDaBusca => (escolhidaNaUrl()
    ? Object.fromEntries(Object.keys(escolhida.current!.filtros).map(k => [k, '']))
    : {});
  const confirmarLugar = () => {
    const t = textoDoLugar.trim();
    if (t === textoDaUrl().trim()) return;
    if (!t && (filters.neighborhood || filters.city) && !filters.condominium && !filters.place) return;
    // Mexeu no texto de uma sugestão que ainda está na URL: os filtros dela (bairro, cidade) saem junto,
    // senão "Granja" ficaria preso ao bairro "Centro" e a lista viria vazia.
    const daEscolhida = filtrosDaEscolhida();
    escolhida.current = null;
    update({ ...daEscolhida, place: t, condominium: '' }, true);
  };
  // O "×" do campo: tira o texto e o lugar da URL (com o bairro/cidade da sugestão escolhida).
  const limparLugar = () => {
    const daEscolhida = filtrosDaEscolhida();
    escolhida.current = null;
    setTextoDoLugar('');
    update({ ...daEscolhida, place: '', condominium: '' });
  };

  // Ordem não é filtro: "Limpar filtros" mantém a escolhida.
  const clearAll = () => {
    const next = new URLSearchParams(filters.tab === 'sale' ? {} : { tab: filters.tab });
    const sort = params.get('sort');
    if (sort) next.set('sort', sort);
    escolhida.current = null;
    setTextoDoLugar('');
    setParams(next, { replace: true });
  };

  // Ordem: a da URL (?sort=) ou, sem ela (ou com um valor que não existe), o
  // padrão do site (Meu site › Lista de imóveis). Servidor velho = Mais recentes.
  const lista = useMemo(() => resolverLista(site.listing), [site.listing]);
  const sortDaUrl = params.get('sort');
  const ordem: Ordem = ehOrdem(sortDaUrl) ? sortDaUrl : lista.default_sort;
  // Escolher o padrão tira o ?sort= da URL: o link fica limpo e segue o site.
  const trocarOrdem = (o: Ordem) => update({ sort: o === lista.default_sort ? '' : o });

  // Filtra, ordena e só então pagina ("Mostrar mais").
  const daLista = useMemo(() => (listaOk ? items.filter(i => listaOk.ids.has(i.id)) : items), [items, listaOk]);
  const filtered = useMemo(() => filterProperties(daLista, filters), [daLista, filters]);
  const ordenados = useMemo(() => ordenarImoveis(filtered, ordem, filters.tab), [filtered, ordem, filters.tab]);
  const hasActiveFilters = !!(filters.type || filters.city || filters.neighborhood || filters.bedrooms || filters.code
    || filters.price_min || filters.price_max || filters.suites || filters.parking || filters.stage
    || filters.place || filters.condominium || filters.area);

  // Aluguel tem faixas de preço próprias: trocar de/para Alugar zera o preço.
  // Alugar não tem empreendimento: a fase escolhida sai junto.
  const trocarAba = (k: PortalTab) => {
    const zerarPreco = (k === 'rent') !== (filters.tab === 'rent') ? { price_min: '', price_max: '' } : {};
    update({ tab: k === 'sale' ? '' : k, ...zerarPreco, ...(k === 'rent' ? { stage: '' } : {}) });
  };
  const cidade = opcoesDeTexto(cities, filters.city);
  const bairro = opcoesDeTexto(hoods, filters.neighborhood);
  const preco = opcoesDePreco(filters.tab, filters.price_min, filters.price_max);

  // Mudou o filtro ou a ordem, a lista recomeça do topo.
  const [visible, setVisible] = useState(RESULTS_PAGE_SIZE);
  useEffect(() => { setVisible(RESULTS_PAGE_SIZE); }, [filters, ordem]);
  const shown = ordenados.slice(0, visible);
  const remaining = ordenados.length - shown.length;
  const mostrarMais = () => setVisible(v => v + RESULTS_PAGE_SIZE);

  return {
    ...dados, ctx, chave, listaDoServidor, listaOk,
    tab, filters, update, clearAll, hasActiveFilters, trocarAba,
    lista, ordem, trocarOrdem,
    filtered, shown, remaining, mostrarMais,
    cidade, bairro, preco,
    textoDoLugar, setTextoDoLugar, escolherLugar, confirmarLugar, limparLugar,
  };
}

/** Tudo o que a página de Imóveis desenha (Clássico e Moderno). */
export type BuscaDosImoveis = ReturnType<typeof useBuscaDosImoveis>;
