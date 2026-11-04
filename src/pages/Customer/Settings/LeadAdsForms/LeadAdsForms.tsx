import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { toast } from 'sonner';
import { plural } from '@/lib/formato';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label as UILabel,
} from '@/components/ui/ds';
import {
  RefreshCw, Download, Stethoscope, Check, X, Copy, Eye, EyeOff, Trash2, Loader2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Pagina, BaseHeader } from '@/components/base';
import EmptyState from '@/components/base/EmptyState';
import Carregando from '@/components/base/Carregando';
import Aviso from '@/components/base/Aviso';
import IconActionButton from '@/components/base/IconActionButton';
import {
  leadAdsFormsService,
  LeadAdsFormConfig,
  LeadAdsFormConfigFormData,
  MetaForm,
  MetaFormsPageError,
  IgnoredLeadForm,
  MetaTokenDebug,
} from '@/services/leadAds/leadAdsFormsService';
import { metaPagesService, type MetaPage } from '@/services/integrations/metaPagesService';
import { useIsSuperAdmin } from '@/hooks/useIsSuperAdmin';
import { useAutomationResources } from '@/features/flowAutomations/editores/LeadAutomationsEditors';
import { roletaConfigService, roletaLabel, type RoletaConfig } from '@/services/roletaConfig/roletaConfigService';
import { type QuemAssume } from '@/components/roleta/CampoQuemAssume';
import { regraQuePega } from './regraPorPalavra';
import JanelaDaCampanha from '../Campanhas/JanelaDaCampanha';
import EntradaDoLead, { ComplementoDaEntrada } from '../Campanhas/EntradaDoLead';
import PraResolver from '../Campanhas/PraResolver';
import TabelaDeFormularios, { OutrosFormularios } from '../Campanhas/TabelaDeFormularios';
import ImportarLeadsRecentes from '../Campanhas/ImportarLeadsRecentes';
import { itemDaFicha, itemEmBranco } from '@/features/campanhas/itensDeCampanha';
import type { ItemDeCampanha, OpcaoDeIa } from '@/services/campanhas/campanhasService';
import { useCan } from '@/hooks/useCan';

import { useConfirmacao } from '@/hooks/useConfirmacao';
import { connectedPagesFrom } from './connectedPages';
// Etiqueta de marketing padrão de todo lead de formulário (igual ao backend).
const PAID_TAG = 'tráfego pago';

interface FormState {
  form_id: string;
  form_name: string;
  // De qual página do Facebook é o formulário. Vem do próprio formulário
  // sincronizado; '' = vale pra qualquer página (comportamento antigo).
  meta_page_id: string;
  pipeline_id: string;
  pipeline_stage_id: string;
  label_ids: string[];
  // Quem assume: corretor fixo OU roleta (no máximo um dos dois).
  quem: QuemAssume;
  is_active: boolean;
}

const emptyFormState = (form_id = '', form_name = '', meta_page_id = ''): FormState => ({
  form_id,
  form_name,
  meta_page_id,
  pipeline_id: '',
  pipeline_stage_id: '',
  label_ids: [],
  quem: { default_assignee_id: null, roleta_config_id: null },
  is_active: true,
});

// O que está gravado → o campo "Quem assume". Gravado com os dois, vale o corretor
// (é ele que o servidor usa); salvar grava só ele.
const quemDe = (cfg: { default_assignee_id?: string | null; roleta_config_id?: string | null }): QuemAssume =>
  cfg.default_assignee_id
    ? { default_assignee_id: cfg.default_assignee_id, roleta_config_id: null }
    : { default_assignee_id: null, roleta_config_id: cfg.roleta_config_id ?? null };

/**
 * Desde a Tarefa 77 (01/11/2026) esta é a parte "Formulários do Meta" da tela Campanhas. Sozinha (sem
 * `campanhas`) segue funcionando como a página de antes; dentro de Campanhas recebe o título, o aviso do
 * topo, a parte de anúncios de WhatsApp (`depois`) e a lista do servidor (`campanhas`).
 */
export interface LeadAdsFormsProps {
  titulo?: string;
  subtitulo?: string;
  /** Depois dos formulários (os anúncios de WhatsApp). */
  depois?: ReactNode;
  /** Botões a mais no cabeçalho. */
  cabecalhoExtra?: ReactNode;
  campanhas?: {
    itens: ItemDeCampanha[];
    /** A lista do servidor chegou. Sem ela o cartão não afirma "0 leads" nem "Nenhuma IA". */
    listaPronta?: boolean;
    listaFalhou?: boolean;
    opcoesDeIa?: OpcaoDeIa[];
    nomes?: Record<string, string>;
    /** Mudou algo que a lista de Campanhas mostra: recarregar. */
    aoMudar: () => void;
  };
}

export default function LeadAdsForms({ titulo = 'Formulários', subtitulo = 'Pra onde cada formulário dos anúncios do Facebook manda os leads.', depois, cabecalhoExtra, campanhas }: LeadAdsFormsProps = {}) {
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const can = useCan();
  const resources = useAutomationResources(true);

  const [configs, setConfigs] = useState<LeadAdsFormConfig[]>([]);
  const [loading, setLoading] = useState(false);
  // Falha na leitura não vira "Nenhum formulário configurado" (o gestor recadastraria).
  const [erro, setErro] = useState(false);

  const [metaForms, setMetaForms] = useState<MetaForm[]>([]);
  const [metaError, setMetaError] = useState<string | null>(null);
  // Erro POR PÁGINA: com várias páginas conectadas, uma com token ruim não pode
  // esconder os formulários das outras (era o comportamento do `error` único).
  const [metaPageErrors, setMetaPageErrors] = useState<MetaFormsPageError[]>([]);
  // Filtro por página, só aparece quando há mais de uma.
  const [pageFilter, setPageFilter] = useState<string>('');
  const [syncing, setSyncing] = useState(false);
  const [syncedOnce, setSyncedOnce] = useState(false);
  // Formulários que estão BARRANDO lead por não estarem cadastrados aqui. Desde
  // 24/08/2026 lead de formulário não cadastrado não entra; sem esta lista, um
  // formulário certo esquecido no cadastro barraria leads em silêncio.
  const [ignoredLeads, setIgnoredLeads] = useState<IgnoredLeadForm[]>([]);
  // Páginas conectadas — só pra chave "receber leads de qualquer formulário
  // desta página". Editar página é de super-admin, então falha em silêncio.
  const [metaPages, setMetaPages] = useState<MetaPage[]>([]);
  const [pageBusy, setPageBusy] = useState<string | null>(null);
  const isSuperAdmin = useIsSuperAdmin();
  const podeCriarFicha = can('lead_ads_form_configs', 'create');
  const [cleanupBusy, setCleanupBusy] = useState(false);

  // Diagnóstico do token da Meta (super-admin): app, permissões, página e o token salvo.
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugBusy, setDebugBusy] = useState(false);
  const [debug, setDebug] = useState<MetaTokenDebug | null>(null);
  // Diagnóstico de TODAS as páginas conectadas; `debug` é a que está na tela.
  const [debugPages, setDebugPages] = useState<MetaTokenDebug[]>([]);
  const [debugError, setDebugError] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);

  const runTokenDebug = async () => {
    setDebugOpen(true);
    setDebugBusy(true);
    setDebug(null);
    setDebugPages([]);
    setDebugError(null);
    setShowToken(false);
    try {
      const result = await leadAdsFormsService.debugMetaToken();
      setDebugPages(result.pages);
      setDebug(result.data ?? result.pages[0] ?? null);
    } catch (e) {
      setDebugError(apiErrorMessage(e, 'Não foi possível diagnosticar a conexão com o Meta'));
    } finally {
      setDebugBusy(false);
    }
  };

  const copyToken = async () => {
    if (!debug?.access_token) return;
    try {
      await navigator.clipboard.writeText(debug.access_token);
      toast.success('Chave copiada');
    } catch {
      toast.error('Não foi possível copiar');
    }
  };

  const copyText = async (value: string | undefined, label: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copiado`);
    } catch {
      toast.error('Não foi possível copiar');
    }
  };

  const [subscribing, setSubscribing] = useState(false);
  // Ativa o recebimento da página que está sendo diagnosticada — com várias
  // conectadas, inscrever "a conexão" sem dizer qual não faria sentido.
  const subscribeWebhook = async () => {
    setSubscribing(true);
    const pageId = debug?.page_id;
    try {
      await leadAdsFormsService.subscribeWebhook(pageId);
      toast.success('Recebimento em tempo real ativado');
      // Recarrega o diagnóstico, mantendo a página em foco.
      const result = await leadAdsFormsService.debugMetaToken(pageId);
      setDebugPages(prev => {
        if (!pageId || prev.length <= 1) return result.pages;
        return prev.map(p => (p.page_id === pageId ? result.data : p));
      });
      setDebug(result.data ?? result.pages[0] ?? null);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Não foi possível ativar o recebimento em tempo real'));
    } finally {
      setSubscribing(false);
    }
  };

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<LeadAdsFormConfig | null>(null);
  // Abriu pelo Plugar de uma ficha que estava desligada: a janela já vem com Ativo marcado e avisa que Salvar liga.
  const [plugandoDesligada, setPlugandoDesligada] = useState(false);
  const [form, setForm] = useState<FormState>(emptyFormState());

  // Importar leads recentes que não entraram (backfill): a janela mora em ImportarLeadsRecentes.
  const [backfillOpen, setBackfillOpen] = useState(false);

  // Roletas pra escolher no roteamento de entrada. TODAS as roletas
  // (não só as ligadas): a escolhida que foi desligada continua na lista, com
  // "(desligada)" — sem ela a caixa abria em "Ninguém" e salvar apagava a
  // escolha calado (inventário da roleta §4.7). `null` = cargo sem acesso.
  // O imóvel não tem lista pré-carregada: o campo busca no servidor (CampoDeImovel).
  const [roletas, setRoletas] = useState<RoletaConfig[] | null>(null);
  useEffect(() => {
    roletaConfigService.getAll()
      .then(list => setRoletas(list || []))
      .catch(() => setRoletas(null));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setConfigs(await leadAdsFormsService.getAll());
      setErro(false);
    } catch {
      setErro(true);
      toast.error('Erro ao carregar formulários');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // `silent` = sincronização automática ao abrir a tela: sem toast e sem barulho
  // de erro. Ela existe para o quadro "Leads ignorados" aparecer sozinho — quem
  // está barrando lead não vai clicar em Sincronizar pra descobrir que está.
  const handleSync = async (silent = false) => {
    setSyncing(true);
    try {
      const result = await leadAdsFormsService.syncMetaForms();
      setMetaForms(result.data);
      setMetaPageErrors(result.errors);
      setIgnoredLeads(result.ignored_leads);
      setMetaError(result.data.length === 0 ? (result.error ?? null) : null);
      setSyncedOnce(true);
      if (silent) {
        return;
      }
      if (result.data.length === 0 && result.error) {
        toast.error(result.error);
      } else {
        const pages = new Set(result.data.map(f => f.page_id).filter(Boolean));
        const sufixo = pages.size > 1 ? ` em ${pages.size} páginas` : '';
        toast.success(`${plural(result.data.length, 'formulário encontrado', 'formulários encontrados')}${sufixo}`);
      }
    } catch {
      if (!silent) toast.error('Erro ao sincronizar formulários');
    } finally {
      setSyncing(false);
    }
  };

  // Sincroniza sozinho ao abrir, uma vez: é o que traz o quadro "Leads
  // ignorados" e a lista de formulários disponíveis sem exigir um clique.
  useEffect(() => { handleSync(true); }, []);

  // Páginas conectadas (pra chave da página). Só o super-admin edita, então um
  // erro aqui não vira aviso na tela — o quadro simplesmente não mostra a chave.
  const loadMetaPages = useCallback(async () => {
    try {
      setMetaPages(await metaPagesService.getAll());
    } catch {
      setMetaPages([]);
    }
  }, []);

  useEffect(() => { loadMetaPages(); }, [loadMetaPages]);

  // Liga/desliga "receber leads de qualquer formulário desta página".
  const toggleAcceptUnconfigured = async (page: MetaPage) => {
    const turningOn = !page.accept_unconfigured_forms;
    if (turningOn) {
      const ok = await confirmar({
        titulo: 'Aceitar qualquer formulário',
        descricao: (
          <>
            A página <strong>{page.page_name}</strong> vai voltar a aceitar lead de{' '}
            <strong>qualquer</strong> formulário, inclusive dos que não estão cadastrados aqui.
          </>
        ),
        rotuloDaAcao: 'Aceitar todos',
        destrutivo: true,
      });
      if (!ok) return;
    }

    setPageBusy(page.id);
    try {
      await metaPagesService.update(page.id, { accept_unconfigured_forms: turningOn });
      await loadMetaPages();
      await handleSync(true);
      toast.success(
        turningOn
          ? 'Esta página passa a aceitar qualquer formulário'
          : 'Só entram leads dos formulários cadastrados',
      );
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Não foi possível mudar essa chave'));
    } finally {
      setPageBusy(null);
    }
  };

  // Limpeza das etiquetas de imóvel criadas pela derivação automática antiga.
  // Pré-visualiza (dry-run), confirma a lista com o usuário e então apaga.
  const handleCleanupLabels = async () => {
    setCleanupBusy(true);
    try {
      const preview = await leadAdsFormsService.cleanupFormLabels(false);
      if (preview.count === 0) {
        toast.success('Nenhuma etiqueta antiga pra limpar 🎉');
        return;
      }
      // A lista vai como JSX: no window.confirm ela era uma parede de texto com
      // `\n`, e com dezenas de etiquetas a caixinha do navegador cortava o fim.
      const ok = await confirmar({
        titulo: `Excluir ${plural(preview.count, 'etiqueta', 'etiquetas')}`,
        descricao: (
          <>
            Estas etiquetas foram criadas automaticamente e serão excluídas. Não dá pra desfazer.
            <span className="mt-2 block max-h-48 overflow-auto text-xs">
              {preview.labels.map(l => (
                <span key={l.title} className="block">• {l.title}</span>
              ))}
            </span>
          </>
        ),
        rotuloDaAcao: 'Excluir',
        destrutivo: true,
      });
      if (!ok) return;

      const result = await leadAdsFormsService.cleanupFormLabels(true);
      resources.reloadLabels();
      await load();
      toast.success(plural(result.count, 'etiqueta removida', 'etiquetas removidas'));
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Erro ao limpar etiquetas'));
    } finally {
      setCleanupBusy(false);
    }
  };

  const configByFormId = (formId: string) => configs.find(c => c.form_id === formId);

  const openCreate = (mf: MetaForm) => {
    setEditing(null);
    setPlugandoDesligada(false);
    // Todo form já entra com "tráfego pago" por padrão (o backend garante isso na
    // entrada do lead de qualquer forma); a etiqueta do imóvel é adicionada à mão.
    const paid = resources.labels.find(l => l.title?.toLowerCase() === PAID_TAG);
    setForm({
      ...emptyFormState(mf.id, mf.name, mf.meta_page_id ?? ''),
      label_ids: paid ? [paid.id] : [],
    });
    setModalOpen(true);
  };

  const openEdit = (cfg: LeadAdsFormConfig) => {
    setEditing(cfg);
    setPlugandoDesligada(false);
    setForm({
      form_id:           cfg.form_id,
      form_name:         cfg.form_name,
      meta_page_id:      cfg.meta_page_id ?? '',
      pipeline_id:       cfg.pipeline_id ?? '',
      pipeline_stage_id: cfg.pipeline_stage_id ?? '',
      label_ids:         cfg.label_ids ?? [],
      quem:              quemDe(cfg),
      is_active:         cfg.is_active,
    });
    setModalOpen(true);
  };

  // A entrada do lead (funil, etapa, quem assume, etiquetas): confere e devolve o que a ficha grava.
  // Quem grava é a janela da campanha, junto com o que a campanha vende (Tarefa 77).
  const montarEntrada = (): LeadAdsFormConfigFormData | null => {
    // Falta algo: avisa e leva o foco ao campo (a janela rola até ele, sem a pessoa caçar o que faltou).
    if (!form.pipeline_id) { toast.error('Selecione um funil'); document.getElementById('destino_funil')?.focus(); return null; }
    if (!form.pipeline_stage_id) { toast.error('Selecione uma etapa'); document.getElementById('destino_etapa')?.focus(); return null; }

    const assign = form.quem;
    // Roleta nova (06/10/2026, D8): o horário e a mensagem de fora do horário
    // são da roleta. `after_hours_message` não viaja: o texto gravado fica onde
    // está (foi de onde a migração dos clientes o copiou).
    return {
      form_id:             form.form_id,
      form_name:           form.form_name,
      meta_page_id:        form.meta_page_id || null,
      pipeline_id:         form.pipeline_id,
      pipeline_stage_id:   form.pipeline_stage_id,
      is_active:           form.is_active,
      label_ids:           form.label_ids,
      default_assignee_id: assign.default_assignee_id,
      roleta_config_id:    assign.roleta_config_id,
      property_id:         editing?.property_id ?? null,
    };
  };

  // Copiar de outra ficha: só a entrada do lead. A identidade do formulário novo (id, nome, página) fica como está.
  const copiarEntrada = (o: LeadAdsFormConfig) => setForm(f => ({
    ...f, pipeline_id: o.pipeline_id ?? '', pipeline_stage_id: o.pipeline_stage_id ?? '', label_ids: o.label_ids ?? [], quem: quemDe(o),
  }));

  // O rodapé da janela resume pra onde o lead vai (nomes, não ids).
  const resumoDaEntrada = (): string => {
    const funil = resources.pipelines.find(p => p.id === form.pipeline_id)?.name;
    if (!funil) return 'Funil ainda não escolhido';
    const etapa = (resources.stagesByPipeline[form.pipeline_id] ?? []).find(e => e.id === form.pipeline_stage_id)?.name;
    return etapa ? `${funil} > ${etapa}` : `${funil} (falta a etapa)`;
  };

  const aposSalvarJanela = ({ config }: { config?: LeadAdsFormConfig }) => {
    if (!config) return;
    setConfigs(prev => (prev.some(c => c.id === config.id) ? prev.map(c => c.id === config.id ? config : c) : [...prev, config]));
    campanhas?.aoMudar();
  };

  const excluirFicha = async () => {
    if (!editing) return;
    const ok = await confirmar({
      titulo: 'Excluir a ficha do formulário',
      descricao: <>Os próximos leads de <strong>{form.form_name}</strong> deixam de entrar por esta ficha. Os leads que já chegaram ficam. Não dá pra desfazer.</>,
      rotuloDaAcao: 'Excluir ficha',
      destrutivo: true,
    });
    if (!ok) return;
    try {
      await leadAdsFormsService.delete(editing.id);
      setConfigs(prev => prev.filter(c => c.id !== editing.id));
      setModalOpen(false);
      toast.success('Ficha excluída');
      campanhas?.aoMudar();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Não foi possível excluir a ficha'));
    }
  };

  // A chave "Ativo" da tabela (`Chave` da casa): vale na hora; se o servidor recusar, a chave volta e avisa sozinha.
  const alternarAtivo = async (cfg: LeadAdsFormConfig, ligada: boolean) => {
    const updated = await leadAdsFormsService.update(cfg.id, {
      form_id:             cfg.form_id,
      form_name:           cfg.form_name,
      pipeline_id:         cfg.pipeline_id,
      pipeline_stage_id:   cfg.pipeline_stage_id,
      is_active:           ligada,
      label_ids:           cfg.label_ids ?? [],
      default_assignee_id: cfg.default_assignee_id ?? null,
      roleta_config_id:    cfg.roleta_config_id ?? null,
      property_id:         cfg.property_id ?? null,
    });
    setConfigs(prev => prev.map(c => c.id === updated.id ? updated : c));
    campanhas?.aoMudar();
  };

  // Quem assume, em palavras (a tabela mostra o nome, não o id).
  const quemAssumeEmTexto = (cfg: LeadAdsFormConfig): string => {
    if (cfg.default_assignee_id) {
      const corretor = resources.users.find(u => String(u.id) === cfg.default_assignee_id);
      return `Assume: ${corretor?.name ?? 'o corretor escolhido'}`;
    }
    if (cfg.roleta_config_id) {
      const roleta = roletas?.find(r => r.id === cfg.roleta_config_id);
      return `Assume: ${roleta ? `Roleta ${roletaLabel(roleta)}` : 'uma roleta'}`;
    }
    return 'Ninguém assume';
  };

  // Resumo do destino (pipeline -> etapa) de uma config salva.
  const destinationSummary = (cfg: LeadAdsFormConfig): string => {
    const pipeline = resources.pipelines.find(p => p.id === cfg.pipeline_id);
    const stage = cfg.pipeline_id
      ? (resources.stagesByPipeline[cfg.pipeline_id] ?? []).find(s => s.id === cfg.pipeline_stage_id)
      : undefined;
    if (!pipeline) return 'Destino não definido';
    return `${pipeline.name} → ${stage?.name ?? '(etapa)'}`;
  };

  // Nome exibido de uma config salva. Quando o Facebook devolve o formulário SEM
  // `name` (token da página sem permissão de Lead Ads / leads_retrieval), o config
  // era salvo com form_name vazio e o card ficava sem título nenhum. Aqui caímos
  // pro nome ao vivo do Facebook (casando pelo form_id, caso um novo sync já tenha
  // trazido o nome) e, em último caso, mostramos o próprio ID — nunca card em branco.
  const configDisplayName = (cfg: LeadAdsFormConfig): string => {
    const saved = cfg.form_name?.trim();
    if (saved) return saved;
    const live = metaForms.find(m => m.id === cfg.form_id)?.name?.trim();
    if (live) return live;
    return `Formulário ${cfg.form_id}`;
  };

  // Páginas conectadas (ativas) — a base do filtro. Vêm da lista de páginas, não
  // dos formulários sincronizados: página sem formulário ou com token falhando
  // continua aparecendo, em vez de sumir como se não estivesse conectada.
  const syncedPages = connectedPagesFrom(metaPages, metaForms);

  const matchesPageFilter = (mf: MetaForm) => !pageFilter || mf.meta_page_id === pageFilter;

  // Config sem página definida vale pra qualquer uma, então continua visível em
  // qualquer filtro — é o comportamento que ela tem no roteamento.
  const visibleConfigs = configs.filter(
    c => !pageFilter || !c.meta_page_id || c.meta_page_id === pageFilter,
  );

  // Forms do Meta que ainda não têm config salva.
  const unconfiguredForms = metaForms.filter(mf => !configByFormId(mf.id) && matchesPageFilter(mf));

  // Nome da página de um formulário/config, quando há mais de uma conectada.
  const pageNameOf = (metaPageId?: string | null, fallback?: string | null): string | null => {
    if (!metaPageId) return fallback ?? null;
    return syncedPages.find(p => p.id === metaPageId)?.name ?? fallback ?? null;
  };

  // --- Leads ignorados (formulário não cadastrado) ---

  // O quadro segue o filtro de página, como o resto da tela.
  // Formulário que acabou de ganhar ficha ATIVA sai daqui na hora, sem esperar outra sincronização. Espelha o LeadRouter
  // (`candidate_configs`): só vale a ficha ativa da página do lead ou sem página. Ficha de outra página não destrava o lead,
  // e ficha desligada também não.
  const fichaDestrava = (f: IgnoredLeadForm) => configs.some((c) => {
    if (c.form_id !== f.form_id || !c.is_active) return false;
    if (!c.meta_page_id || !f.page_id) return true;
    const paginaDaFicha = metaPages.find(p => p.id === c.meta_page_id);
    return !paginaDaFicha || paginaDaFicha.page_id === f.page_id;
  });
  const visibleIgnored = ignoredLeads.filter(
    f => !fichaDestrava(f) && (!pageFilter || metaPages.find(p => p.id === pageFilter)?.page_id === f.page_id),
  );

  // O nome da página vem do page_id do Facebook (é o que o relatório devolve),
  // e só aparece quando há mais de uma conectada.
  const pageNameOfIgnored = (f: IgnoredLeadForm): string | null => {
    if (syncedPages.length <= 1) return null;
    return metaPages.find(p => p.page_id === f.page_id)?.page_name ?? null;
  };

  // Páginas que estão barrando algo — são as que ganham a chave de escape.
  const ignoredPages = metaPages.filter(p => visibleIgnored.some(f => f.page_id === p.page_id));

  // Cadastrar um formulário direto do quadro: reaproveita o mesmo modal da lista
  // "Disponíveis no Facebook". Se o formulário não veio na sincronização (foi
  // apagado no Facebook, ou é de página que falhou), monta o mínimo pelo que o
  // relatório trouxe — senão o botão não teria o que abrir.
  const openCreateFromIgnored = (f: IgnoredLeadForm) => {
    const known = metaForms.find(mf => mf.id === f.form_id);
    openCreate(
      known ?? {
        id:           f.form_id,
        name:         f.form_name,
        status:       'ACTIVE',
        leads_count:  f.lead_count,
        page_id:      f.page_id,
        meta_page_id: metaPages.find(p => p.page_id === f.page_id)?.id ?? null,
      },
    );
  };

  // Plugar um formulário que barrou lead. Se ele já tem ficha (desligada), abre ESSA ficha: criar outra duplicaria.
  const plugarBarrado = (f: IgnoredLeadForm) => {
    const existente = configs.find(c => c.form_id === f.form_id);
    if (!existente) { openCreateFromIgnored(f); return; }
    openEdit(existente);
    // Quem clica em Plugar quer o lead entrando: a ficha desligada já abre ligada, e a janela avisa. Editar pela linha não faz isso.
    if (!existente.is_active) {
      setForm(fs => ({ ...fs, is_active: true }));
      setPlugandoDesligada(true);
    }
  };

  // Os que barraram lead estão em Pra resolver; aqui ficam só os sem ficha e sem lead.
  const idsBarrados = new Set(ignoredLeads.map(f => f.form_id));
  const outrosFormularios = unconfiguredForms.filter(mf => !idsBarrados.has(mf.id));

  // Formulário sem ficha própria que uma regra "nome contém" com roleta já pega: o lead dele NÃO fica parado, cai na roleta.
  const notaDaRegra = (mf: MetaForm): ReactNode => {
    const regra = regraQuePega(mf.name ?? '', mf.meta_page_id, configs);
    if (!regra) return null;
    const palavra = regra.match_keyword?.trim() || regra.form_name;
    // Corretor fixo vence a roleta no servidor (LeadRouter): a frase diz pra quem o lead vai de verdade.
    if (regra.default_assignee_id) {
      const corretor = resources.users.find(u => String(u.id) === regra.default_assignee_id);
      return <p className="mt-1 text-xs text-muted-foreground">Vai pra {corretor?.name ?? 'o corretor escolhido'} pela regra "{palavra}"</p>;
    }
    if (!regra.roleta_config_id) return null;
    const roleta = roletas?.find(r => r.id === regra.roleta_config_id);
    return <p className="mt-1 text-xs text-muted-foreground">Cai na {roleta ? `Roleta ${roletaLabel(roleta)}` : 'roleta'} pela regra "{palavra}"</p>;
  };

  return (
    <>
    <Pagina
      cabecalho={
        <BaseHeader
          title={titulo}
          subtitle={subtitulo}
          aDireita={
            <>
          {cabecalhoExtra}
          {/* Os três só funcionam pro super-admin (o servidor responde 403 pro resto): botão que só dá erro é pior que botão nenhum. */}
          {isSuperAdmin && (
            <>
          <IconActionButton
            label="Diagnosticar conexão"
            icon={<Stethoscope className="h-4 w-4" />}
            onClick={runTokenDebug}
          />
          <IconActionButton
            label="Importar leads recentes"
            icon={<Download className="h-4 w-4" />}
            onClick={() => setBackfillOpen(true)}
          />
          <IconActionButton
            label="Limpar etiquetas antigas — remove as etiquetas criadas automaticamente pelo nome do formulário"
            icon={cleanupBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            onClick={handleCleanupLabels}
            disabled={cleanupBusy}
          />
            </>
          )}
            </>
          }
          primaryAction={{
            label: syncing ? 'Sincronizando...' : 'Sincronizar formulários',
            icon: <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />,
            onClick: () => handleSync(),
            disabled: syncing,
          }}
        />
      }
    >
      <ImportarLeadsRecentes aberto={backfillOpen} aoMudarAberto={setBackfillOpen} aoImportou={load} />

      {/* Modal: diagnóstico do token da Meta (app, permissões, página e o token salvo) */}
      <Dialog open={debugOpen} onOpenChange={setDebugOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Diagnóstico da conexão com o Meta</DialogTitle>
            <DialogDescription>
              O que o Facebook diz sobre a conexão deste cliente — app, permissões
              e se ele enxerga a página.
            </DialogDescription>
          </DialogHeader>

          {debugBusy ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Consultando o Facebook...</div>
          ) : debugError ? (
            <Aviso tom="erro">{debugError}</Aviso>
          ) : debug ? (
            // Cap explícito de altura no CORPO (não no DialogContent): o componente
            // base do design-system sobrescreve o max-h externo, então garantimos o
            // scroll aqui dentro. Footer (Fechar/Atualizar) fica fixo fora deste div.
            <div className="space-y-3 text-sm max-h-[65vh] overflow-y-auto pr-1">
              {/* Seletor de página: com mais de uma conectada, o diagnóstico de
                  uma não diz nada sobre as outras. */}
              {debugPages.length > 1 && (
                <div className="flex flex-wrap gap-1.5">
                  {debugPages.map((d, i) => {
                    const active = d === debug;
                    const label = d.page_name || d.page_id || `Página ${i + 1}`;
                    const bad = !!d.token_error || d.page_token_ok === false;
                    return (
                      <button
                        key={`${d.page_id ?? i}`}
                        type="button"
                        onClick={() => { setDebug(d); setShowToken(false); }}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                          active
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                        }`}
                      >
                        {bad ? '⚠ ' : ''}{label}
                      </button>
                    );
                  })}
                </div>
              )}
              {debug.token_error && (
                <Aviso tom="erro" titulo="O Facebook recusou esta conexão">
                  <p>{debug.token_error}</p>
                </Aviso>
              )}
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">App</span>
                  <span className="font-medium text-right truncate">
                    {debug.app_name || '—'}{debug.app_id ? ` (${debug.app_id})` : ''}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Tipo de acesso</span>
                  <span className="font-medium">{debug.token_type || '—'}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Válido</span>
                  <span className={debug.is_valid ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                    {debug.is_valid ? 'Sim' : 'Não'}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Expira</span>
                  <span className="font-medium">
                    {debug.expires_at === 0 ? 'Nunca (permanente)'
                      : debug.expires_at ? new Date(debug.expires_at * 1000).toLocaleString('pt-BR')
                      : '—'}
                  </span>
                </div>
              </div>

              {/* Página: o teste que revela o #100 (token não enxerga a página) */}
              <Aviso tom={debug.page_ok ? 'sucesso' : 'atencao'} icone={debug.page_ok ? Check : X}>
                {debug.page_ok ? (
                  <p>A conexão <strong>enxerga a página</strong>: {debug.page_name} ({debug.page_id})</p>
                ) : (
                  <>
                    <p className="font-medium">A conexão NÃO enxerga a página {debug.page_id}</p>
                    {debug.page_error && <p>{debug.page_error}</p>}
                  </>
                )}
              </Aviso>

              {/* Token de página derivável = a página está atribuída ao System User
                  para Leads. É o sinal REAL: sem isso, os formulários não carregam
                  mesmo com token válido e página "vista". */}
              {typeof debug.page_token_ok === 'boolean' && (
                <Aviso tom={debug.page_token_ok ? 'sucesso' : 'atencao'} icone={debug.page_token_ok ? Check : X}>
                  {debug.page_token_ok ? (
                    <p>Página <strong>atribuída ao Usuário do Sistema</strong> para Leads (acesso à página OK) — os formulários devem carregar.</p>
                  ) : (
                    <>
                      <p className="font-medium">A página não está atribuída ao Usuário do Sistema para Leads</p>
                      {debug.page_token_error && <p>{debug.page_token_error}</p>}
                    </>
                  )}
                </Aviso>
              )}

              {/* Recebimento em tempo real: a página está inscrita no app p/ leadgen?
                  É isso que faz o Facebook ENVIAR os leads pro webhook — sem isso, o
                  lead cai no Gerenciador de Leads mas nunca chega no LM Flow. */}
              {typeof debug.webhook_subscribed === 'boolean' && (
                <Aviso
                  tom={debug.webhook_subscribed ? 'sucesso' : 'atencao'}
                  icone={debug.webhook_subscribed ? Check : X}
                  acao={debug.webhook_subscribed ? undefined : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={subscribeWebhook}
                      disabled={subscribing}
                    >
                      {subscribing ? 'Ativando…' : 'Ativar recebimento em tempo real'}
                    </Button>
                  )}
                >
                  {debug.webhook_subscribed ? (
                    <p><strong>Recebimento em tempo real ativo</strong> — a página está inscrita no app para leads. Novos leads caem sozinhos.</p>
                  ) : (
                    <>
                      <p className="font-medium">Recebimento em tempo real NÃO está ativo</p>
                      {debug.webhook_error && <p>{debug.webhook_error}</p>}
                    </>
                  )}
                </Aviso>
              )}

              {/* Diagnóstico de roteamento em linguagem simples: os leads recentes
                  estão entrando? Se algum ficou de fora, diz de qual formulário
                  (pelo nome) e o que fazer. Sem ids/números.
                  Desde 24/08/2026 o lead de formulário não cadastrado NÃO entra, então
                  o texto muda conforme a trava esteja valendo nesta página ou não —
                  dizer "entrou sem etiqueta" quando o lead nem entrou seria mentira. */}
              {typeof debug.total_recent_leads === 'number' && (
                debug.total_recent_leads === 0 ? (
                  <EmptyState
                    tamanho="compacto"
                    title="Nenhum lead recebido por esta página ainda — quando chegar, este quadro mostra se ele entrou."
                  />
                ) : debug.routing_ok ? (
                  <Aviso tom="sucesso" icone={Check} titulo="Tudo certo.">
                    Os últimos leads vieram de formulários cadastrados e entraram com as etiquetas deles.
                  </Aviso>
                ) : (
                  <Aviso
                    tom="atencao"
                    titulo={debug.unmatched_blocked
                      ? <>{debug.unmatched_leads} lead{(debug.unmatched_leads ?? 0) > 1 ? 's' : ''} não {(debug.unmatched_leads ?? 0) > 1 ? 'entraram' : 'entrou'}</>
                      : <>{debug.unmatched_leads} lead{(debug.unmatched_leads ?? 0) > 1 ? 's' : ''} entr{(debug.unmatched_leads ?? 0) > 1 ? 'aram' : 'ou'} sem a etiqueta do imóvel</>}
                  >
                    <p className="text-xs">
                      {debug.unmatched_blocked ? 'Vieram de' : 'Vieram de'} formulário{(debug.unmatched_forms?.length ?? 0) > 1 ? 's' : ''} que <strong>não</strong> {(debug.unmatched_forms?.length ?? 0) > 1 ? 'estão' : 'está'} cadastrado{(debug.unmatched_forms?.length ?? 0) > 1 ? 's' : ''} aqui:
                    </p>
                    <ul className="mt-2 space-y-1">
                      {(debug.unmatched_forms ?? []).map((f, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-current flex-shrink-0" />
                          <span className="font-medium">{f.name}</span>
                          <span className="text-xs">
                            ({f.lead_count} lead{f.lead_count > 1 ? 's' : ''})
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs mt-2">
                      👉 {debug.unmatched_blocked
                        ? <>Se {(debug.unmatched_forms?.length ?? 0) > 1 ? 'esses formulários são seus' : 'esse formulário é seu'}, cadastre {(debug.unmatched_forms?.length ?? 0) > 1 ? 'eles' : 'ele'} no quadro <strong>Pra resolver</strong> desta tela. A partir daí os leads entram.</>
                        : <>Ache {(debug.unmatched_forms?.length ?? 0) > 1 ? 'esses formulários' : 'esse formulário'} na lista e configure a etiqueta do imóvel. A partir daí os leads dele entram certos.</>}
                    </p>
                  </Aviso>
                )
              )}

              {/* Configuração do webhook no App Meta — fonte ÚNICA de verdade. Mostra a
                  URL de callback e o verify token que o SERVIDOR realmente valida, pra
                  copiar direto no painel do App (Developers → Webhooks → Page). Acaba com
                  a confusão de copiar o valor de outro campo que o handshake não usa. */}
              {(debug.webhook_callback_url || debug.webhook_verify_token) && (
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    Configuração do webhook (App Meta → Webhooks → Página)
                  </p>
                  <p className="text-xs text-muted-foreground mb-3">
                    Cole EXATAMENTE estes valores no painel do App em developers.facebook.com. É o que o servidor valida — ignore outros campos de "verify token".
                  </p>
                  {debug.webhook_callback_url && (
                    <div className="mb-2">
                      <UILabel className="text-xs">URL de callback</UILabel>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="flex-1 text-xs break-all bg-muted rounded px-2 py-1">{debug.webhook_callback_url}</code>
                        <Button size="sm" variant="outline" onClick={() => copyText(debug.webhook_callback_url, 'URL')} aria-label="Copiar URL de callback" title="Copiar URL de callback">
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                  {debug.webhook_verify_token && (
                    <div>
                      <UILabel className="text-xs">Verify Token</UILabel>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="flex-1 text-xs break-all bg-muted rounded px-2 py-1">{debug.webhook_verify_token}</code>
                        <Button size="sm" variant="outline" onClick={() => copyText(debug.webhook_verify_token, 'Verify Token')} aria-label="Copiar o valor do Verify Token" title="Copiar o valor do Verify Token">
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Permissões exigidas para Lead Ads */}
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Permissões de Lead Ads
                </p>
                <div className="space-y-1">
                  {['leads_retrieval', 'pages_show_list', 'pages_read_engagement'].map(scope => {
                    const has = !debug.missing_scopes.includes(scope);
                    return (
                      <div key={scope} className="flex items-center gap-2">
                        {has
                          ? <Check className="h-4 w-4 text-green-600" />
                          : <X className="h-4 w-4 text-red-600" />}
                        <code className="text-xs">{scope}</code>
                      </div>
                    );
                  })}
                </div>
                {debug.missing_scopes.length > 0 && (
                  <p className="text-xs text-amber-600 mt-2">
                    Faltam permissões — refaça a conexão com o Facebook autorizando essas permissões.
                  </p>
                )}
              </div>

              {/* Token salvo (super-admin): ver/copiar o que já está gerado */}
              {debug.access_token && (
                <div className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Chave de acesso salva{typeof debug.token_length === 'number' ? ` (${debug.token_length} caracteres)` : ''}
                    </p>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => setShowToken(s => !s)}
                        title={showToken ? 'Ocultar' : 'Mostrar'}>
                        {showToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="size-8" onClick={copyToken} title="Copiar">
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <code className="block text-xs break-all bg-muted/50 rounded p-2">
                    {showToken ? debug.access_token : `${debug.access_token.slice(0, 12)}${'•'.repeat(16)}`}
                  </code>
                </div>
              )}
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDebugOpen(false)}>Fechar</Button>
            <Button onClick={runTokenDebug} disabled={debugBusy}>
              <RefreshCw className={`h-4 w-4 mr-2 ${debugBusy ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Uma linha por PÁGINA com problema. Antes vinha um erro único: com duas
          páginas conectadas, a que estava boa ficava sem aparecer. */}
      {metaPageErrors.length > 0 && metaForms.length > 0 && (
        <div className="mb-6 space-y-2">
          {metaPageErrors.map((pe, i) => (
            <Aviso
              key={`${pe.page_id ?? 'page'}-${i}`}
              tom="atencao"
              titulo={`${pe.page_name || pe.page_id || 'Página'}: não foi possível carregar os formulários`}
            >
              <p>{pe.error}</p>
            </Aviso>
          ))}
        </div>
      )}

      {/* Aviso: mostra o MOTIVO real que o backend devolveu (token expirado, sem
          permissão de leadgen, page_id que não bate...) em vez de um texto fixo,
          pra dar pro cliente o que corrigir na conexão da página. */}
      {metaError && (
        <Aviso tom="atencao" titulo="Não foi possível carregar os formulários da Meta" className="mb-6">
          <p>{metaError}</p>
          <p className="mt-2">
            Revise a conexão da página em{' '}
            <Link to="/settings/facebook" className="text-primary underline">
              Integrações → Facebook
            </Link>{' '}
            e sincronize de novo.
          </p>
        </Aviso>
      )}

      {/* Filtro por página — só faz sentido com mais de uma conectada. */}
      {syncedPages.length > 1 && (
        <div className="mb-6 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground mr-1">Página:</span>
          <button
            type="button"
            onClick={() => setPageFilter('')}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              pageFilter === ''
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            Todas
          </button>
          {syncedPages.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPageFilter(p.id)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                pageFilter === p.id
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      <PraResolver
        formularios={visibleIgnored}
        fichaDesligada={(formId) => configs.some(c => c.form_id === formId && !c.is_active)}
        nomeDaPagina={pageNameOfIgnored}
        aoPlugar={plugarBarrado}
        podePlugar={podeCriarFicha}
        pedeSuporte={!isSuperAdmin}
        paginasDaChave={isSuperAdmin ? ignoredPages : []}
        paginaOcupada={pageBusy}
        aoAlternarPagina={toggleAcceptUnconfigured}
      />

      {/* Formulários do Meta, em tabela. A tabela não espera o Facebook: Pra resolver e os outros formulários chegam depois. */}
      <section className="mb-2" aria-labelledby="formularios-do-meta">
        <h2 id="formularios-do-meta" className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          {campanhas ? 'Formulários do Meta' : 'Formulários configurados'}
        </h2>
        {loading ? (
          <Carregando linhas={3} />
        ) : erro && configs.length === 0 ? (
          <EmptyState tipo="erro" aoTentarDeNovo={() => void load()} />
        ) : visibleConfigs.length === 0 ? (
          <EmptyState
            tamanho="compacto"
            title={configs.length === 0 ? 'Nenhum formulário plugado' : 'Nenhum formulário desta página'}
            description={
              configs.length === 0
                ? 'Quando um formulário do Facebook trouxer lead, ele aparece em Pra resolver com o botão Plugar.'
                : 'Nenhuma ficha salva para a página selecionada.'
            }
          />
        ) : (
          <TabelaDeFormularios
            fichas={visibleConfigs}
            itens={campanhas?.itens}
            listaPronta={campanhas?.listaPronta === true}
            nomes={campanhas?.nomes}
            nomeDaFicha={configDisplayName}
            destino={destinationSummary}
            quemAssume={quemAssumeEmTexto}
            nomeDaPagina={(cfg) => (syncedPages.length > 1 ? pageNameOf(cfg.meta_page_id, cfg.page_name) : null)}
            podeEditar={can('lead_ads_form_configs', 'update')}
            podeLigar={can('lead_ads_form_configs', 'update')}
            aoAbrir={openEdit}
            aoLigar={alternarAtivo}
          />
        )}
        {campanhas?.listaFalhou && visibleConfigs.length > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">Não deu pra carregar o resumo das campanhas. Recarregue a página.</p>
        )}
        {syncedOnce && !metaError && (
          <OutrosFormularios
            formularios={outrosFormularios}
            mostrarPagina={syncedPages.length > 1}
            aoPlugar={openCreate}
            podePlugar={podeCriarFicha}
            nota={notaDaRegra}
          />
        )}
      </section>

      {depois}

      {/* A janela da campanha: o que vende, a condição, pra quem é, qual IA atende e a entrada do lead de sempre. */}
      {modalOpen && (
        <JanelaDaCampanha
          key={editing?.id ?? `novo:${form.form_id}`}
          tipo="form"
          config={editing}
          item={editing
            ? itemDaFicha(editing, configDisplayName(editing), campanhas?.itens.find(i => i.form_config_id === editing.id))
            : itemEmBranco({ key: `form:${form.form_id}`, kind: 'form', label: form.form_name })}
          opcoesDeIa={campanhas?.listaPronta === false ? undefined : campanhas?.opcoesDeIa}
          montarEntrada={montarEntrada}
          fichas={configs}
          itensDaLista={campanhas?.itens}
          listaCarregando={campanhas?.listaPronta === false}
          listaFalhou={!!campanhas?.listaFalhou}
          aoCopiarEntrada={copiarEntrada}
          aoFechar={() => setModalOpen(false)}
          aoSalvar={aposSalvarJanela}
          aoMudarIa={() => campanhas?.aoMudar()}
          aoApagar={excluirFicha}
          resumoDaEntrada={resumoDaEntrada()}
          avisoDoTopo={plugandoDesligada && form.is_active ? 'Esta ficha estava desligada. Ao salvar, ela liga de novo.' : null}
          complemento={(
            <ComplementoDaEntrada
              valor={form}
              aoMudar={parcial => setForm(f => ({ ...f, ...parcial }))}
              recursos={resources}
            />
          )}
          entrada={(
            <EntradaDoLead
              valor={form}
              aoMudar={parcial => setForm(f => ({ ...f, ...parcial }))}
              recursos={resources}
              roletas={roletas}
            />
          )}
        />
      )}
    </Pagina>
      {dialogoDeConfirmacao}
    </>
  );
}
