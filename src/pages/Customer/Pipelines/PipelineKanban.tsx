import { useState, useEffect, useCallback, useMemo, useRef, Suspense, startTransition, type Dispatch, type SetStateAction } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useLanguage } from '@/hooks/useLanguage';
import { Plus } from 'lucide-react';
import { plural } from '@/lib/formato';

import { pipelinesService } from '@/services/pipelines';
import { visitsService } from '@/services/visits/visitsService';
import {
  Pipeline,
  PipelineStage,
  PipelineItem,
  UpdatePipelineData,
  CreateStageData,
} from '@/types/analytics';
import { useFeature } from '@/contexts/TenantFeaturesContext';
import { useCan } from '@/hooks/useCan';
import { boardHeaderActions } from './boardActions';
import BoardTopBar, { type ModoDoQuadro } from './quadro/BoardTopBar';
import { csvDoFunil } from './quadro/csvDoFunil';
import EmptyState from '@/components/base/EmptyState';
import Carregando from '@/components/base/Carregando';
import { Skeleton } from '@/components/ui/ds';
import { getCachedPipeline, loadOpenPipeline } from './pipelinePayloadCache';
import { useOpenLeadConversation } from '@/hooks/useOpenLeadConversation';
import { lazyWithRetry } from '@/utils/chunkReload';
import { useCardForaDoQuadro } from '@/features/cardDoLead/useCardForaDoQuadro';
import { useAbrirPaginaDoCard, veioDeDentroDoApp } from '@/features/cardDoLead/paginaNoCelular';
import { useCelular } from '@/hooks/useCelular';
import AvisoDoCardForaDoQuadro from '@/features/cardDoLead/AvisoDoCardForaDoQuadro';
import { useCardNoEndereco } from './useCardNoEndereco';
import { STATUS_DA_ABA, pertenceAAba, podeArrastarNaAba } from './quadro/enderecoDoQuadro';
import { comSituacaoNova, situacaoDe } from '@/features/pipelines/situacao/situacao';
import { useBoardDrag } from './quadro/useBoardDrag';
import { usePipelineFilters } from './quadro/usePipelineFilters';
import { useFacetasDoQuadro } from './quadro/useFacetasDoQuadro';
import { useMaisCardsDaColuna } from './quadro/useMaisCardsDaColuna';
import {
  paramsDoQuadro,
  assinaturaDoQuadro,
  semFiltroNaAberta,
  limiteDaRecarga,
  ajustarTotais,
  POR_COLUNA,
} from './quadro/paramsDoQuadro';
import PainelDeFiltrosDoFunil from './quadro/PainelDeFiltrosDoFunil';
import StageColumn from './quadro/StageColumn';
import PipelineListView from './quadro/PipelineListView';
import { useAppDataStore } from '@/store/appDataStore';
import { useNomeDaAba } from '@/components/layout/nomeDaAba';

// Os modais abaixo só aparecem quando o usuário clica em algo pra abrir —
// código deles não precisa estar no bundle inicial da página de Pipelines.
const EditPipelineModal = lazyWithRetry(() => import('@/components/pipelines/EditPipelineModal'));
const CreateStageModal = lazyWithRetry(() => import('@/components/pipelines/CreateStageModal'));
const AddItemModal = lazyWithRetry(() => import('@/components/pipelines/AddItemModal'));
const BulkDispatchModal = lazyWithRetry(() => import('@/components/pipelines/BulkDispatchModal'));
const RemoveItemModal = lazyWithRetry(() => import('@/components/pipelines/RemoveItemModal'));
const EditItemModal = lazyWithRetry(() => import('@/components/pipelines/EditItemModal'));
const EditStageModal = lazyWithRetry(() => import('@/components/pipelines/EditStageModal'));
const DeleteStageModal = lazyWithRetry(() => import('@/components/pipelines/DeleteStageModal'));
const DeletePipelineModal = lazyWithRetry(() => import('@/components/pipelines/DeletePipelineModal'));
const ReorderStagesModal = lazyWithRetry(() => import('@/components/pipelines/ReorderStagesModal'));

// Esqueleto cinza do quadro (peça 13 do GLOSSARIO): colunas com a largura das
// etapas e alguns cards dentro, no lugar da rodinha no meio da tela.
function EsqueletoDoQuadro({ rotulo }: { rotulo: string }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className="flex flex-1 gap-6 overflow-hidden px-4 py-6 sm:px-6">
      <span className="sr-only">{rotulo}</span>
      {[3, 2, 4, 1].map((cards, i) => (
        <div key={i} aria-hidden="true" className="w-80 flex-shrink-0 space-y-3 rounded-xl border border-border bg-muted/40 p-4">
          <Skeleton className="h-5 w-1/2" />
          {Array.from({ length: cards }).map((_, j) => (
            <Skeleton key={j} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function PipelineKanban() {
  const { t } = useLanguage('pipelines');
  const { pipelineId } = useParams<{ pipelineId: string }>();
  const navigate = useNavigate();
  const {
    openLeadConversation,
    startConversationModal,
    opening: openingConversation,
  } = useOpenLeadConversation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Catálogo COMPLETO de etiquetas da conta, pro filtro de Tags — não dá pra
  // derivar só dos leads já carregados no board (ver allTags abaixo).
  const { labels: accountLabels, fetchLabels } = useAppDataStore();
  useEffect(() => {
    fetchLabels();
  }, [fetchLabels]);

  const [loading, setLoading] = useState(true);
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  useNomeDaAba(pipeline?.name);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [allPipelines, setAllPipelines] = useState<Pipeline[]>([]);
  // Aba e filtros no endereço; busca na tela (quadro/usePipelineFilters).
  const {
    aba, setAba, filtros, aplicar, busca, setBusca, buscaAplicada, filteredStages, totalVisivel, quantosFiltros,
  } = usePipelineFilters(stages);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const statusDaAba = STATUS_DA_ABA[aba];
  // Aba, busca e filtros vão pro servidor (quadro em lotes, spec 2026-10-15).
  const paramsAtuais = useMemo(() => paramsDoQuadro(aba, filtros, buscaAplicada), [aba, filtros, buscaAplicada]);
  const assinatura = assinaturaDoQuadro(paramsAtuais);
  const paramsRef = useRef(paramsAtuais);
  paramsRef.current = paramsAtuais;
  const stagesRef = useRef(stages);
  stagesRef.current = stages;
  // Ação local mexe nos cards: o número da coluna acompanha (ajustarTotais).
  const setStagesLocal = useCallback<Dispatch<SetStateAction<PipelineStage[]>>>(acao => {
    setStages(prev => ajustarTotais(prev, typeof acao === 'function' ? acao(prev) : acao));
  }, []);
  // Rolar a coluna pede mais 30: o total vem do servidor, então setStages cru (não o local).
  const maisCards = useMaisCardsDaColuna({ pipelineId, params: paramsAtuais, assinatura, setStages });
  const { facetas, erro: erroDasFacetas, tentarDeNovo: tentarFacetas } = useFacetasDoQuadro(pipelineId, statusDaAba, filtrosAbertos);
  // A aba decide se o card arrasta (Ganhos, Perdidos e Arquivados não).
  const podeArrastarCard = useCallback((item: PipelineItem) => podeArrastarNaAba(aba, item), [aba]);

  // Soltar em Concluído marcou Ganho: o card segue o mesmo caminho do Ganho pela
  // janela (handleItemStatusChanged, declarado mais abaixo — por isso a ref).
  const aoGanharRef = useRef<(item: PipelineItem) => void>(() => {});
  const aoGanharNoQuadro = useCallback((item: PipelineItem) => aoGanharRef.current(item), []);

  // Arraste do card, rolar o fundo e a roda do mouse (quadro/useBoardDrag).
  const {
    boardScrollRef, isDraggingRef, suppressClickUntilRef,
    handleBoardDragOver, handleBoardMouseDown, handleBoardWheel,
    handleDragStart, handleDragOver, handleDrop, handleCardDragOver, handleCardDrop, handleDragEnd,
  } = useBoardDrag({
    pipelineId, stages, setStages: setStagesLocal, mensagemDeErro: t('kanban.messages.itemMoveError'), podeArrastar: podeArrastarCard,
    aoGanhar: aoGanharNoQuadro,
  });

  // Modal states
  const [showEditPipelineModal, setShowEditPipelineModal] = useState(false);
  const [isUpdatingPipeline, setIsUpdatingPipeline] = useState(false);
  const [showCreateStageModal, setShowCreateStageModal] = useState(false);
  const [isCreatingStage, setIsCreatingStage] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [selectedStageForItem, setSelectedStageForItem] = useState<PipelineStage | null>(null);
  const [showRemoveItemModal, setShowRemoveItemModal] = useState(false);
  const [itemToRemove, setItemToRemove] = useState<PipelineItem | null>(null);
  const [isRemovingItem, setIsRemovingItem] = useState(false);
  const [showEditItemModal, setShowEditItemModal] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<PipelineItem | null>(null);
  const [isEditingItem, setIsEditingItem] = useState(false);
  const [showEditStageModal, setShowEditStageModal] = useState(false);
  const [showDeleteStageModal, setShowDeleteStageModal] = useState(false);
  const [stageToEdit, setStageToEdit] = useState<PipelineStage | null>(null);
  const [stageToDelete, setStageToDelete] = useState<PipelineStage | null>(null);
  const [isEditingStage, setIsEditingStage] = useState(false);
  const [isDeletingStage, setIsDeletingStage] = useState(false);
  const [showDeletePipelineModal, setShowDeletePipelineModal] = useState(false);
  const [showReorderStagesModal, setShowReorderStagesModal] = useState(false);
  const [isDeletingPipeline, setIsDeletingPipeline] = useState(false);
  const [isReorderingStages, setIsReorderingStages] = useState(false);
  const [disparoModalOpen, setDisparoModalOpen] = useState(false);

  // Modo de visualização do funil: quadro (Kanban) ou lista (todos os leads,
  // por ordem de chegada, com foto/tags/coluna/data — mais rápido pra escanear
  // o funil inteiro sem ficar rolando colunas).
  const [viewMode, setViewMode] = useState<ModoDoQuadro>('board');
  const [listSortOrder, setListSortOrder] = useState<'desc' | 'asc'>('desc');

  // Função do cliente (super-admin liga/desliga) E cargo. Os literais do
  // useFeature ficam: os scanners do catálogo leem o código por regex.
  const pode = useCan();
  const acoesDoQuadro = boardHeaderActions(
    {
      export: useFeature('pipeline_export'),
      bulkDispatch: useFeature('bulk_campaigns'),
    },
    pode,
  );
  const canExport = acoesDoQuadro.export;
  const canBulkDispatch = acoesDoQuadro.bulkDispatch;
  const canAddItem = useFeature('pipeline_add_item');

  // Carrega a ABA aberta em lotes (?status=, busca e filtros no servidor, 30
  // cards por coluna: há funil com milhares de cards). silent=true: refresh por
  // trás (foco, poll de 60 s, tempo real), sem espera na tela. Só Abertos sem
  // busca nem filtro usa o payload guardado (é o que o seletor de funis
  // pré-carrega). Resposta de um pedido que já não é o atual é jogada fora.
  const pedidoRef = useRef(0);
  const pipelineRef = useRef<Pipeline | null>(null);
  pipelineRef.current = pipeline;
  const [carregandoQuadro, setCarregandoQuadro] = useState(false);
  // A aba pedida não carregou: o quadro mostra o erro (nunca os cards da aba anterior).
  const [erroDaAba, setErroDaAba] = useState(false);
  // Funil e aba do quadro que está na tela. Busca ou filtro na MESMA aba mantém
  // os cards até a resposta chegar (só aria-busy); troca de aba ou de funil
  // mostra o esqueleto (nunca os cards da aba anterior).
  const quadroNaTelaRef = useRef<string | null>(null);
  const [atualizandoQuadro, setAtualizandoQuadro] = useState(false);
  // Depende da assinatura (aba, busca e filtros): quando ela troca, o efeito de
  // abertura relê sozinho. Os parâmetros em si vêm da ref (sempre os atuais).
  const loadPipelineData = useCallback(async (silent = false, reaproveitar = false) => {
    if (!pipelineId) return;
    const meu = ++pedidoRef.current;
    const params = paramsRef.current;
    const semFiltro = semFiltroNaAberta(params);
    // Recarga por trás relê até onde a pessoa rolou; a abertura pede o 1º lote.
    const porColuna = silent ? limiteDaRecarga(stagesRef.current) : POR_COLUNA;
    const cached = semFiltro ? getCachedPipeline(pipelineId) : undefined;
    const quadroPedido = `${pipelineId}|${String(params.status)}`;
    const mesmoQuadro = Boolean(pipelineRef.current) && quadroNaTelaRef.current === quadroPedido;
    const mostrarEspera = !silent && !cached && !mesmoQuadro;
    if (!silent) setAtualizandoQuadro(!cached && mesmoQuadro);
    if (!silent && cached) {
      quadroNaTelaRef.current = quadroPedido;
      setPipeline(cached);
      setStages(cached.stages || []);
      setLoading(false);
      setCarregandoQuadro(false);
    }
    if (!silent) setErroDaAba(false);
    if (mostrarEspera) {
      // Primeira carga: a tela inteira espera. Troca de aba: só o quadro.
      if (pipelineRef.current) setCarregandoQuadro(true);
      else setLoading(true);
    }
    try {
      // Abertos sem filtro, no 1º lote, passa pelo cache, que grava o payload guardado. Só a abertura
      // do quadro reaproveita o pedido que o hover já disparou; recarga depois
      // de ação pede de novo (senão traria o quadro de antes da ação).
      const pipelineData =
        semFiltro && porColuna === POR_COLUNA
          ? await loadOpenPipeline(pipelineId, { reaproveitar })
          : await pipelinesService.getBoard(pipelineId, params, porColuna);
      if (meu !== pedidoRef.current) return;
      quadroNaTelaRef.current = quadroPedido;
      setPipeline(pipelineData);
      setStages(pipelineData.stages || []);
      setErroDaAba(false);
      // Janela aberta num card que mudou de situação ou etapa por fora (outra
      // guia, automação): a janela acompanha. Sem mudança, o card fica o mesmo
      // objeto (a janela não se refaz a cada 60 s).
      setItemToEdit(prev => {
        if (!prev) return prev;
        const achado = (pipelineData.stages || []).flatMap(s => s.items || []).find(i => String(i.id) === String(prev.id));
        if (!achado) return prev;
        const mudou = situacaoDe(achado) !== situacaoDe(prev) || String(achado.stage_id) !== String(prev.stage_id);
        return mudou ? comSituacaoNova(prev, achado) : prev;
      });
    } catch (error) {
      console.error('Error loading pipeline data:', error);
      // Pedido que a pessoa fez (troca de aba, busca, filtro) e falhou: some o
      // quadro e mostra o erro (nunca cards que não batem com o pedido). Com o
      // payload guardado na tela, os cards dele continuam valendo.
      if (!silent && !cached && meu === pedidoRef.current) {
        toast.error(t('kanban.messages.loadDataError'));
        if (pipelineRef.current) {
          quadroNaTelaRef.current = null;
          setStages([]);
          setErroDaAba(true);
        }
      }
    } finally {
      if (meu === pedidoRef.current) {
        setLoading(false);
        setCarregandoQuadro(false);
        setAtualizandoQuadro(false);
      }
    }
  }, [pipelineId, assinatura]); // eslint-disable-line react-hooks/exhaustive-deps

  // Próximas visitas por contato (pra mostrar dia/hora no card).
  const [visitsByContact, setVisitsByContact] = useState<Record<string, string>>({});
  const loadUpcomingVisits = useCallback(async () => {
    try {
      const res = await visitsService.list({ upcoming: 'true', per_page: 500 });
      const map: Record<string, string> = {};
      (res.data || []).forEach(v => {
        if (!v.contact_id) return;
        // mantém a visita mais próxima por contato
        if (!map[v.contact_id] || new Date(v.scheduled_at) < new Date(map[v.contact_id])) {
          map[v.contact_id] = v.scheduled_at;
        }
      });
      setVisitsByContact(map);
    } catch {
      /* visitas são enriquecimento opcional do card */
    }
  }, []);

  // Load all pipelines for selector
  const loadAllPipelines = useCallback(async () => {
    try {
      // Seletor só precisa de nome/cor/etapas/contagem — modo enxuto (sem itens).
      const response = await pipelinesService.getPipelines({ include_items: false });
      const pipelinesData = response.data || [];
      setAllPipelines(pipelinesData);
    } catch (error) {
      console.error('Error loading pipelines:', error);
    }
  }, []);

  useEffect(() => {
    loadPipelineData(false, true);
  }, [loadPipelineData]);

  useEffect(() => {
    loadAllPipelines();
    loadUpcomingVisits();
  }, [loadAllPipelines, loadUpcomingVisits]);

  // Atualização automática (sem recarregar a página): lead novo aparece sozinho.
  // - ao voltar o foco pra aba / aba ficar visível: refresh silencioso na hora.
  // - a cada 60s enquanto a aba está visível: refresh silencioso.
  // Pula enquanto arrasta um card (não atrapalhar a reordenação otimista).
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      if (isDraggingRef.current) return;
      loadPipelineData(true);
      loadUpcomingVisits();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisibility);
    const interval = window.setInterval(refresh, 60_000);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisibility);
      clearInterval(interval);
    };
  }, [loadPipelineData, loadUpcomingVisits, isDraggingRef]);

  // AO VIVO (websocket): lead/mensagem nova chega pelo evento global 'lmflow:realtime'
  // (re-emitido pela conexão WS do app em useGlobalWebSocket). Refresh silencioso
  // com debounce de 1.5s pra colapsar rajadas (conversation.created + message.created
  // chegam juntos). O poll de 60s acima fica de rede de segurança se o WS cair.
  useEffect(() => {
    let timer: number | undefined;
    const onRealtime = () => {
      if (document.visibilityState !== 'visible' || isDraggingRef.current) return;
      clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (isDraggingRef.current) return;
        loadPipelineData(true);
        loadUpcomingVisits();
      }, 1500);
    };
    window.addEventListener('lmflow:realtime', onRealtime);
    return () => {
      window.removeEventListener('lmflow:realtime', onRealtime);
      clearTimeout(timer);
    };
  }, [loadPipelineData, loadUpcomingVisits, isDraggingRef]);

  // Card aberto no endereço (?card=): F5 e link colado abrem o card, e ele
  // continua no endereço enquanto estiver aberto. Fechar tira só o ?card=.
  // Card que não está no quadro carregado mostra o aviso (E0, 07/10/2026).
  const abrirCard = useCallback((item: PipelineItem) => {
    setItemToEdit(item);
    setShowEditItemModal(true);
  }, []);
  // O card aberto na janela conta como "no quadro" mesmo depois de sair da aba
  // (marcou Ganho em Abertos): sem isto, o aviso "não está nesta aba" aparecia
  // com a janela ainda aberta.
  const itensDoQuadro = useMemo(() => {
    const doQuadro = stages.flatMap(s => s.items ?? []);
    if (!showEditItemModal || !itemToEdit || doQuadro.some(i => String(i.id) === String(itemToEdit.id))) return doQuadro;
    return [...doQuadro, itemToEdit];
  }, [stages, showEditItemModal, itemToEdit]);
  // Celular (10/10/2026): o card abre na página, não na janela
  // (features/cardDoLead/paginaNoCelular.ts). O ?card= que chegou de outra tela
  // ou de um link troca de endereço (replace): o voltar leva pra onde a pessoa
  // estava, sem passar de novo pelo quadro.
  const celular = useCelular();
  const abrirPaginaDoCard = useAbrirPaginaDoCard();
  const irParaPaginaDoCard = useCallback((id: string) => {
    if (!pipelineId) return;
    abrirPaginaDoCard(pipelineId, id, { substituir: true, voltarPeloHistorico: veioDeDentroDoApp() });
  }, [pipelineId, abrirPaginaDoCard]);
  const {
    cardId: cardDoEndereco,
    foraDaAba: cardForaDaAba,
    abrirNoEndereco: abrirCardNoEndereco,
    fecharNoEndereco: fecharCardNoEndereco,
  } = useCardNoEndereco({
    itens: itensDoQuadro,
    carregando: loading,
    aoAbrir: abrirCard,
    irParaPagina: celular && pipelineId ? irParaPaginaDoCard : null,
  });

  // E4: o card do endereço que não está nos cards da aba (arquivado, de outra
  // aba, F5 noutra aba) é buscado pelo id e abre na janela. 404/403 = sem
  // acesso. Com a janela aberta, `itensDoQuadro` já conta o card (P3-T17):
  // `foraDaAba` fica false e nada é buscado.
  const cardForaDoQuadro = useCardForaDoQuadro(pipelineId, cardForaDaAba ? cardDoEndereco : null);
  useEffect(() => {
    if (cardForaDoQuadro.estado === 'achou') abrirCard(cardForaDoQuadro.item);
  }, [cardForaDoQuadro, abrirCard]);
  // Fechar a janela e tirar o ?card= na MESMA transição: o react-router aplica a
  // navegação dentro de uma transição, e se a janela fechasse antes o card (fora
  // da aba) sumiria dos itens com o ?card= ainda no endereço — nova busca, ou a
  // janela reabrindo sozinha.
  const fecharJanelaDoCard = useCallback((limpar?: () => void) => {
    startTransition(() => {
      setShowEditItemModal(false);
      limpar?.();
      fecharCardNoEndereco();
    });
  }, [fecharCardNoEndereco]);
  const fecharCard = useCallback((aberto: boolean) => {
    if (aberto) setShowEditItemModal(true);
    else fecharJanelaDoCard();
  }, [fecharJanelaDoCard]);

  // ?etapa= (link da Dashboard): rola até a coluna e destaca por 2 segundos.
  const [etapaDestacada, setEtapaDestacada] = useState<string | null>(null);
  useEffect(() => {
    const etapa = searchParams.get('etapa');
    if (!etapa || loading) return;
    document.getElementById(`etapa-${etapa}`)?.scrollIntoView?.({ behavior: 'smooth', inline: 'start', block: 'nearest' });
    setEtapaDestacada(etapa);
    const resto = new URLSearchParams(searchParams);
    resto.delete('etapa');
    setSearchParams(resto, { replace: true });
  }, [searchParams, loading, setSearchParams]);
  useEffect(() => {
    if (!etapaDestacada) return;
    const t = setTimeout(() => setEtapaDestacada(null), 2000);
    return () => clearTimeout(t);
  }, [etapaDestacada]);

  // Handle pipeline change
  const handlePipelineChange = (newPipelineId: string) => {
    if (newPipelineId !== pipelineId) {
      navigate(`/pipelines/${newPipelineId}`);
    }
  };

  // Todas as etiquetas da conta (catálogo completo — não só as que já aparecem
  // em algum card carregado neste pipeline; ver comentário acima em accountLabels).
  const allTags = useMemo(() => {
    return accountLabels
      .map(l => ({ name: l.title, color: l.color }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [accountLabels]);

  // Pipeline management handlers
  const handleEditPipeline = () => {
    setShowEditPipelineModal(true);
  };

  const handleUpdatePipeline = async (data: UpdatePipelineData) => {
    if (!pipeline) return;

    setIsUpdatingPipeline(true);
    try {
      await pipelinesService.updatePipeline(pipeline.id, data);
      toast.success(t('messages.updateSuccess'));
      setShowEditPipelineModal(false);
      // Reload pipeline data to reflect changes
      await loadPipelineData();
    } catch (error) {
      console.error('Error updating pipeline:', error);
      toast.error(t('messages.updateError'));
    } finally {
      setIsUpdatingPipeline(false);
    }
  };

  const handleDeletePipeline = () => {
    setShowDeletePipelineModal(true);
  };

  const handleCopyPipelineId = async () => {
    if (!pipeline?.id) return;
    await navigator.clipboard.writeText(String(pipeline.id));
    toast.success(t('kanban.idCopied'));
  };

  const handleConfirmDeletePipeline = async () => {
    if (!pipeline) return;

    setIsDeletingPipeline(true);
    try {
      await pipelinesService.deletePipeline(pipeline.id);
      toast.success(t('messages.deleteSuccess'));
      setShowDeletePipelineModal(false);
      navigate('/pipelines');
    } catch (error) {
      console.error('Error deleting pipeline:', error);
      toast.error(t('messages.deleteError'));
    } finally {
      setIsDeletingPipeline(false);
    }
  };

  const handleReorderStages = () => {
    setShowReorderStagesModal(true);
  };

  const handleUpdateStageOrder = async (orderedStages: PipelineStage[]) => {
    if (!pipelineId) return;

    setIsReorderingStages(true);
    try {
      // Backend expects just an array of stage IDs in the correct order
      const stageOrders = orderedStages.map(stage => stage.id);

      await pipelinesService.reorderPipelineStages(pipelineId, stageOrders);

      toast.success(t('kanban.messages.stageReordered'));
      setShowReorderStagesModal(false);
      // Reload pipeline data to reflect changes
      await loadPipelineData();
    } catch (error) {
      console.error('Error reordering stages:', error);
      toast.error(t('kanban.messages.stageReorderError'));
    } finally {
      setIsReorderingStages(false);
    }
  };

  // Stage management handlers
  const handleCreateStage = async (data: CreateStageData) => {
    if (!pipeline) return;

    setIsCreatingStage(true);
    try {
      await pipelinesService.createPipelineStage(pipeline.id, data);
      toast.success(t('kanban.messages.stageCreated'));
      setShowCreateStageModal(false);
      // Reload pipeline data to show new stage
      await loadPipelineData();
    } catch (error) {
      console.error('Error creating stage:', error);
      toast.error(t('kanban.messages.stageCreateError'));
    } finally {
      setIsCreatingStage(false);
    }
  };

  // Item management handlers
  const handleAddItem = (stage?: PipelineStage) => {
    setSelectedStageForItem(stage || stages[0] || null);
    setShowAddItemModal(true);
  };

  // Sem aviso aqui: a janela "Adicionar Lead ao Funil" já mostra o dela
  // ("Lead criado e adicionado ao funil." ou "Lead adicionado ao funil.").
  // Avisar aqui também dava dois avisos pro mesmo lead.
  const handleItemAdded = async () => {
    // Recarga por trás: sem esqueleto e relendo até onde a pessoa rolou.
    await loadPipelineData(true);
  };

  const handleRemoveItem = useCallback((item: PipelineItem) => {
    setItemToRemove(item);
    setShowRemoveItemModal(true);
  }, []);

  // Remove o card do board no estado (otimista), sem reload — usado ao arquivar.
  const removeItemFromBoardLocal = useCallback((itemId: string) => {
    setStagesLocal(prev =>
      prev.map(stage => ({
        ...stage,
        items: (stage.items || []).filter(i => String(i.id) !== String(itemId)),
      })),
    );
  }, [setStagesLocal]);

  // Arquivar = soft-hide: some do board na hora, fica em "Arquivados".
  const handleArchiveItem = useCallback(async (item: PipelineItem) => {
    if (!pipelineId) return;
    removeItemFromBoardLocal(item.id);
    try {
      await pipelinesService.archiveItem(pipelineId, item.id);
      toast.success('Lead arquivado');
      void loadPipelineData(true); // números das abas
    } catch {
      toast.error('Erro ao arquivar');
      loadPipelineData(true);
    }
  }, [pipelineId, removeItemFromBoardLocal, loadPipelineData]);

  // Aba Arquivados: Desarquivar devolve o card ao quadro (some desta aba).
  const handleUnarchiveItem = useCallback(async (item: PipelineItem) => {
    if (!pipelineId) return;
    removeItemFromBoardLocal(item.id);
    try {
      await pipelinesService.unarchiveItem(pipelineId, item.id);
      toast.success('Lead desarquivado');
    } catch {
      toast.error('Erro ao desarquivar');
    } finally {
      void loadPipelineData(true);
    }
  }, [pipelineId, removeItemFromBoardLocal, loadPipelineData]);

  const handleConfirmRemoveItem = async () => {
    if (!itemToRemove || !pipelineId) return;

    setIsRemovingItem(true);
    try {
      await pipelinesService.removeItemFromPipeline(pipelineId, itemToRemove.id);
      toast.success(t('kanban.messages.itemRemoved'));
      setShowRemoveItemModal(false);
      setItemToRemove(null);
      // Recarga por trás: sem esqueleto e relendo até onde a pessoa rolou.
      await loadPipelineData(true);
    } catch (error) {
      console.error('Error removing item from pipeline:', error);
      toast.error(t('kanban.messages.itemRemoveError'));
    } finally {
      setIsRemovingItem(false);
    }
  };

  // Clique no card: abre e grava o ?card= (F5 e "copiar o endereço" funcionam).
  // As duas funções são estáveis: o PipelineItemCard continua memoizado.
  // No celular, o clique vai pra página do card (entra no histórico: o voltar
  // devolve ao quadro).
  const handleEditItem = useCallback((item: PipelineItem) => {
    if (celular && pipelineId) {
      abrirPaginaDoCard(pipelineId, item.id);
      return;
    }
    abrirCard(item);
    abrirCardNoEndereco(String(item.id));
  }, [celular, pipelineId, abrirPaginaDoCard, abrirCard, abrirCardNoEndereco]);

  // Move otimista do card pra outra etapa, SEM reload (fluido igual o arrastar).
  // Usado pelas ações do card no modal ("Mover para coluna", "Ganho/Perdido")
  // e pela mudança de Fase ao salvar. O card pula de coluna na hora; o refresh
  // de dados acontece em segundo plano (silencioso), sem piscar a tela.
  const moveItemToStageLocal = useCallback((itemId: string, toStageId: string) => {
    if (!toStageId) return;
    setStagesLocal(prev => {
      let moved: PipelineItem | undefined;
      const without = prev.map(stage => ({
        ...stage,
        items: (stage.items || []).filter(i => {
          if (String(i.id) === String(itemId)) {
            moved = { ...i, stage_id: toStageId, pipeline_stage_id: toStageId } as PipelineItem;
            return false;
          }
          return true;
        }),
      }));
      if (!moved) return prev;
      return without.map(stage =>
        String(stage.id) === String(toStageId)
          ? { ...stage, items: [moved as PipelineItem, ...(stage.items || [])] }
          : stage,
      );
    });
    // Mantém o card aberto coerente com a nova etapa.
    setItemToEdit(prev =>
      prev && String(prev.id) === String(itemId)
        ? ({ ...prev, stage_id: toStageId, pipeline_stage_id: toStageId } as PipelineItem)
        : prev,
    );
  }, [setStagesLocal]);

  // Ganho/Perdido/Reabrir pela janela (e o Ganho de soltar em Concluído, P3-T17A):
  // o card pega a situação nova na hora; se a situação mudou a coluna (Ganho →
  // Concluído; Reabrir volta, ajuste de 08/10), ele troca de coluna; se não é mais
  // desta aba (marcou Ganho em Abertos), some do quadro. Os números das abas se
  // refazem em silêncio. A janela continua aberta.
  const handleItemStatusChanged = useCallback((novo: PipelineItem) => {
    setStagesLocal(prev => {
      const antigo = prev.flatMap(stage => stage.items || []).find(i => String(i.id) === String(novo.id));
      if (!antigo) return prev;
      const junto = comSituacaoNova(antigo, novo);
      const fica = pertenceAAba(aba, junto);
      const destino = String(junto.stage_id);
      return prev.map(stage => {
        const itens = stage.items || [];
        const estava = itens.some(i => String(i.id) === String(novo.id));
        if (fica && String(stage.id) === destino) {
          return { ...stage, items: estava ? itens.map(i => (String(i.id) === String(novo.id) ? junto : i)) : [junto, ...itens] };
        }
        return estava ? { ...stage, items: itens.filter(i => String(i.id) !== String(novo.id)) } : stage;
      });
    });
    setItemToEdit(prev => (prev && String(prev.id) === String(novo.id) ? comSituacaoNova(prev, novo) : prev));
    void loadPipelineData(true);
  }, [aba, loadPipelineData, setStagesLocal]);
  aoGanharRef.current = handleItemStatusChanged;

  const handleUpdateItem = async (data: {
    notes: string;
    stage_id: string;
    services: Array<{ name: string; value: string }>;
    currency: string;
    custom_attributes?: Record<string, unknown>;
  }) => {
    if (!itemToEdit || !pipelineId) return;

    const movedId = itemToEdit.id;
    const stageChanged = String(itemToEdit.stage_id) !== String(data.stage_id);

    setIsEditingItem(true);
    try {
      await pipelinesService.updateItemInPipeline(pipelineId, movedId, {
        pipeline_stage_id: data.stage_id,
        notes: data.notes,
        custom_fields: {
          services: data.services,
          currency: data.currency,
          // Merge custom attributes into custom_fields (backend expects them here)
          ...(data.custom_attributes || {}),
        },
      });
      toast.success(t('kanban.messages.itemUpdated'));
      fecharJanelaDoCard(() => setItemToEdit(null));
      // Move otimista na hora + refresh silencioso (sem o spinner de tela cheia
      // que dava a sensação de "recarregar a página").
      if (stageChanged) moveItemToStageLocal(movedId, data.stage_id);
      await loadPipelineData(true);
    } catch (error) {
      console.error('Error updating item:', error);
      toast.error(t('kanban.messages.itemUpdateError'));
      await loadPipelineData(true);
    } finally {
      setIsEditingItem(false);
    }
  };

  // Stage management handlers
  const handleEditStage = (stage: PipelineStage) => {
    setStageToEdit(stage);
    setShowEditStageModal(true);
  };

  const handleUpdateStage = async (data: {
    name: string;
    color: string;
    stage_type: string;
    automation_rules?: { description?: string };
    custom_fields?: Record<string, unknown>;
  }) => {
    if (!stageToEdit || !pipelineId) return;

    setIsEditingStage(true);
    try {
      await pipelinesService.updatePipelineStage(pipelineId, stageToEdit.id, {
        name: data.name,
        color: data.color,
        stage_type: data.stage_type,
        automation_rules: data.automation_rules,
        custom_fields: data.custom_fields,
      });
      toast.success(t('kanban.messages.stageUpdated'));
      setShowEditStageModal(false);
      setStageToEdit(null);
      // Reload pipeline data to reflect changes
      await loadPipelineData();
    } catch (error) {
      console.error('Error updating stage:', error);
      toast.error(t('kanban.messages.stageUpdateError'));
    } finally {
      setIsEditingStage(false);
    }
  };

  const handleDeleteStage = (stage: PipelineStage) => {
    setStageToDelete(stage);
    setShowDeleteStageModal(true);
  };

  const handleConfirmDeleteStage = async () => {
    if (!stageToDelete || !pipelineId) return;

    setIsDeletingStage(true);
    try {
      await pipelinesService.deletePipelineStage(pipelineId, stageToDelete.id);
      toast.success(t('kanban.messages.stageDeleted'));
      setShowDeleteStageModal(false);
      setStageToDelete(null);
      // Reload pipeline data to reflect changes
      await loadPipelineData();
    } catch (error) {
      console.error('Error deleting stage:', error);
      toast.error(t('kanban.messages.stageDeleteError'));
    } finally {
      setIsDeletingStage(false);
    }
  };

  // Exportar: todas as situações do funil (Abertos, Ganhos e Perdidos; sem os
  // arquivados), buscadas na hora — não só a aba aberta.
  const handleExportCSV = async () => {
    if (!pipelineId) return;
    try {
      const todos = await pipelinesService.getPipeline(pipelineId, { status: 'all' });
      const { csv, linhas } = csvDoFunil(todos.stages || []);
      if (linhas === 0) {
        toast.error('Nenhum lead para exportar.');
        return;
      }
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leads-${pipeline?.name || 'funil'}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${plural(linhas, 'lead exportado', 'leads exportados')}.`);
    } catch {
      toast.error('Não consegui exportar os leads.');
    }
  };

  if (loading) {
    return (
      <div className="flex h-full">
        <EsqueletoDoQuadro rotulo="Carregando o funil" />
      </div>
    );
  }

  return (
    <div className="flex w-full h-full min-w-0 overflow-hidden">
      <div className="flex-1 h-full flex flex-col bg-muted/30 min-w-0">
        <BoardTopBar
          pipeline={pipeline}
          pipelines={allPipelines}
          onTrocarFunil={handlePipelineChange}
          onVoltar={() => navigate('/pipelines')}
          aba={aba}
          onTrocarAba={setAba}
          contagens={pipeline?.status_counts}
          busca={busca}
          onBusca={setBusca}
          totalVisivel={totalVisivel}
          modo={viewMode}
          onModo={setViewMode}
          quantosFiltros={quantosFiltros}
          onAbrirFiltros={() => setFiltrosAbertos(true)}
          podeAdicionar={canAddItem}
          onAdicionar={() => handleAddItem()}
          acoes={{ exportar: canExport, disparo: canBulkDispatch }}
          onExportar={() => { void handleExportCSV(); }}
          onDisparo={() => setDisparoModalOpen(true)}
          onEditarFunil={handleEditPipeline}
          onReordenarEtapas={handleReorderStages}
          onCopiarId={() => { void handleCopyPipelineId(); }}
          onExcluirFunil={handleDeletePipeline}
        />

        <AvisoDoCardForaDoQuadro
          estado={cardForaDoQuadro}
          aoFechar={fecharCardNoEndereco}
          className="mx-4 mt-3 sm:mx-6"
        />

        {/* Kanban Board */}
        {(viewMode === 'board' || viewMode === 'list') && erroDaAba && !carregandoQuadro && (
          <EmptyState tipo="erro" aoTentarDeNovo={() => { void loadPipelineData(); }} />
        )}
        {viewMode === 'board' && carregandoQuadro && <EsqueletoDoQuadro rotulo="Carregando a aba" />}
        {viewMode === 'board' && !carregandoQuadro && !erroDaAba && (
        <div className="flex-1 overflow-hidden relative">
          <div
            ref={boardScrollRef}
            aria-busy={atualizandoQuadro || undefined}
            className="h-full overflow-x-auto overflow-y-hidden px-4 sm:px-6 py-6 cursor-grab"
            onDragOver={handleBoardDragOver}
            onMouseDown={handleBoardMouseDown}
            onWheel={handleBoardWheel}
          >
            {/* Kanban Content */}
            <div
              className="flex gap-6 h-full pb-6"
              style={{ width: 'fit-content', minWidth: '100%' }}
            >
              {/* Stage Columns */}
              {filteredStages.map((stage: PipelineStage) => (
                <StageColumn
                  key={stage.id}
                  stage={stage}
                  destacada={etapaDestacada === stage.id}
                  visitsByContact={visitsByContact}
                  isDraggingRef={isDraggingRef}
                  suppressClickUntilRef={suppressClickUntilRef}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onCardDragStart={handleDragStart}
                  onCardDragEnd={handleDragEnd}
                  onCardDragOver={handleCardDragOver}
                  onCardDrop={handleCardDrop}
                  onOpenItem={handleEditItem}
                  onArchive={handleArchiveItem}
                  onRemove={handleRemoveItem}
                  podeArrastar={podeArrastarCard}
                  arquivado={aba === 'arquivados'}
                  onUnarchive={handleUnarchiveItem}
                  onOpenConversation={openLeadConversation}
                  openingConversation={openingConversation}
                  onEditStage={handleEditStage}
                  onDeleteStage={handleDeleteStage}
                  carregandoMais={Boolean(maisCards.carregando[String(stage.id)])}
                  erroAoCarregarMais={Boolean(maisCards.erro[String(stage.id)])}
                  onCarregarMais={maisCards.carregarMais}
                />
              ))}

              {/* Add Stage Column */}
              {aba === 'abertos' && (
              <div className="w-80 flex-shrink-0">
                <div
                  className="bg-muted/50 rounded-xl p-6 h-full border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors cursor-pointer"
                  onClick={() => setShowCreateStageModal(true)}
                >
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                    <Plus className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-sm font-medium mb-1">{t('kanban.stage.addStage')}</h3>
                  <p className="text-xs text-center">{t('kanban.stage.addStageDescription')}</p>
                </div>
              </div>
              )}

              {/* Empty state for no stages */}
              {stages.length === 0 && (
                <div className="flex items-center justify-center w-full h-full">
                  <div className="text-center">
                    <div className="text-muted-foreground text-sm">
                      {t('kanban.stage.noStages')}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        )}

        {/* Lista: todos os leads do funil, por ordem de chegada */}
        {viewMode === 'list' && carregandoQuadro && (
          <Carregando linhas={6} rotulo="Carregando a aba" className="px-4 py-2 sm:px-6" />
        )}
        {viewMode === 'list' && !carregandoQuadro && !erroDaAba && (
          <PipelineListView
            stages={filteredStages}
            ordem={listSortOrder}
            aoTrocarOrdem={() => setListSortOrder(o => (o === 'asc' ? 'desc' : 'asc'))}
            onOpenItem={handleEditItem}
            visitsByContact={visitsByContact}
          />
        )}
      </div>

      <PainelDeFiltrosDoFunil
        aberto={filtrosAbertos}
        aoFechar={() => setFiltrosAbertos(false)}
        aba={aba}
        filtros={filtros}
        aoFiltrar={aplicar}
        stages={stages}
        etiquetas={allTags}
        facetas={facetas}
        erroDasFacetas={erroDasFacetas}
        aoTentarDeNovo={tentarFacetas}
      />

      {/* Edit Pipeline Modal */}
      {pipeline && (
        <Suspense fallback={null}>
          <EditPipelineModal
            open={showEditPipelineModal}
            onOpenChange={setShowEditPipelineModal}
            pipeline={pipeline}
            onSubmit={handleUpdatePipeline}
            loading={isUpdatingPipeline}
          />
        </Suspense>
      )}

      {/* Create Stage Modal */}
      <Suspense fallback={null}>
        <CreateStageModal
          open={showCreateStageModal}
          onOpenChange={setShowCreateStageModal}
          onSubmit={handleCreateStage}
          loading={isCreatingStage}
        />
      </Suspense>

      {/* Add Item Modal */}
      {pipeline && (
        <Suspense fallback={null}>
          <AddItemModal
            open={showAddItemModal}
            onOpenChange={setShowAddItemModal}
            pipelineId={pipeline.id}
            stages={stages}
            preselectedStage={selectedStageForItem}
            onItemAdded={handleItemAdded}
          />
        </Suspense>
      )}

      {/* Disparo em Massa Modal */}
      {pipeline && (
        <Suspense fallback={null}>
          <BulkDispatchModal
            open={disparoModalOpen}
            onOpenChange={setDisparoModalOpen}
            pipelineId={pipeline.id}
            pipelineName={pipeline.name}
            stages={stages}
          />
        </Suspense>
      )}

      {/* Remove Item Modal */}
      <Suspense fallback={null}>
        <RemoveItemModal
          open={showRemoveItemModal}
          onOpenChange={setShowRemoveItemModal}
          item={itemToRemove}
          onConfirm={handleConfirmRemoveItem}
          loading={isRemovingItem}
        />
      </Suspense>

      {/* Edit Item Modal */}
      {itemToEdit && (
        <Suspense fallback={null}>
          <EditItemModal
            open={showEditItemModal}
            onOpenChange={fecharCard}
            item={itemToEdit}
            stages={stages}
            pipeline={pipeline}
            onSubmit={handleUpdateItem}
            onItemStageMoved={moveItemToStageLocal}
            onItemStatusChanged={handleItemStatusChanged}
            // Tag grava na hora: recarrega em silêncio pro selo do card refletir a
            // mudança mesmo que a pessoa feche o card sem salvar.
            onLabelsChanged={() => { void loadPipelineData(true); }}
            loading={isEditingItem}
          />
        </Suspense>
      )}

      {/* Iniciar conversa — só monta para lead que ainda não tem conversa */}
      {startConversationModal}

      {/* Edit Stage Modal */}
      <Suspense fallback={null}>
        <EditStageModal
          open={showEditStageModal}
          onOpenChange={setShowEditStageModal}
          stage={stageToEdit}
          onSubmit={handleUpdateStage}
          loading={isEditingStage}
        />
      </Suspense>

      {/* Delete Stage Modal */}
      <Suspense fallback={null}>
        <DeleteStageModal
          open={showDeleteStageModal}
          onOpenChange={setShowDeleteStageModal}
          stage={stageToDelete}
          itemCount={stageToDelete?.item_count || 0}
          onConfirm={handleConfirmDeleteStage}
          loading={isDeletingStage}
        />
      </Suspense>

      {/* Delete Pipeline Modal */}
      {pipeline && (
        <Suspense fallback={null}>
          <DeletePipelineModal
            open={showDeletePipelineModal}
            onOpenChange={setShowDeletePipelineModal}
            pipeline={pipeline}
            onConfirm={handleConfirmDeletePipeline}
            loading={isDeletingPipeline}
          />
        </Suspense>
      )}

      {/* Reorder Stages Modal */}
      <Suspense fallback={null}>
        <ReorderStagesModal
          open={showReorderStagesModal}
          onOpenChange={setShowReorderStagesModal}
          stages={stages}
          onSubmit={handleUpdateStageOrder}
          loading={isReorderingStages}
        />
      </Suspense>
    </div>
  );
}
