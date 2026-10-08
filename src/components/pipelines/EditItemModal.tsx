// Card do lead em tela única (spec 2026-10-02-fase-4-card-do-lead).
//
// Duas colunas dentro de uma janela quase tela cheia por cima do funil:
//   - ESQUERDA, fixa e sem rolagem: quem é, situação (etapa, responsável,
//     origem), os três botões (visita, conversa, IA), etiquetas, follow-up numa
//     linha, conversão Meta numa linha e Ganho | Perdido no rodapé;
//   - DIREITA, abas: Detalhes · Conversa · Visitas e propostas · Origem.
// Tudo grava na hora (não existe mais "Salvar alterações"). Nome, telefone e
// e-mail não se editam aqui: o lápis de telefone/e-mail só aparece quando o
// servidor diz (`identity_correctable` — gestor, lead cadastrado à mão).
import { useState, useEffect, useCallback, Suspense, type ReactNode } from 'react';
import { useAccountUsers } from '@/hooks/useAccountUsers';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Badge,
} from '@/components/ui/ds';
import { Plus, Check, Loader2, X, Pencil, Phone, Mail, Shuffle, ClipboardList, MessageSquare, Megaphone, CalendarCheck, ListTodo } from 'lucide-react';
import Abas from '@/components/base/Abas';
import { PipelineItem, PipelineStage, Pipeline } from '@/types/analytics';
import { lazyWithRetry } from '@/utils/chunkReload';
import { rotuloDaAbaTarefas } from '@/features/tarefas/abaDoCard';
import CapiConversionPanel from '@/components/capi/CapiConversionPanel';
import FollowupTimeline from './FollowupTimeline';
import { useFeature } from '@/contexts/TenantFeaturesContext';
import { useOpenLeadConversation } from '@/hooks/useOpenLeadConversation';
import ContactAvatar from '@/components/chat/contact/ContactAvatar';
import { readManualOrigin } from '@/constants/manualLeadOrigin';
import { telefone } from '@/lib/formato';
import { conversationAPI } from '@/services/conversations/conversationService';
import { contactEventsService } from '@/services/contacts/contactEventsService';
import { labelsService } from '@/services/contacts/labelsService';
import { contactsService } from '@/services/contacts/contactsService';
import { pipelinesService } from '@/services/pipelines/pipelinesService';
import { roletaConfigService, roletaLabel, type RoletaConfig } from '@/services/roletaConfig/roletaConfigService';
import { brokerAssignmentsService, type BrokerAssignmentDetail } from '@/services/roletaConfig/brokerAssignmentsService';
import OfferActions from '@/components/roleta/OfferActions';
import { textoDaOferta } from '@/components/roleta/textosDaRoleta';
import { isPhoneLikeName } from '@/lib/nomeDoContato';
import { classeDaOrigem, contatoDoCard, conversaDoCard, origemCurta, podeCorrigirContato, semFunil } from '@/features/cardDoLead/cardDoLead';
import { useCorretorLogado } from '@/features/contatos/useCorretorLogado';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import type { Contact } from '@/types/contacts';
import LeadQuickActions from './card/LeadQuickActions';
import LeadDetailsTab from './card/LeadDetailsTab';
import CardResultFooter from './card/CardResultFooter';
import CardMoreMenu from './card/CardMoreMenu';
import CardOriginTab from './card/CardOriginTab';
import ColocarNoFunil from './card/ColocarNoFunil';
import { CampoEtapa, CampoResponsavel } from './card/CamposDaSituacao';
import { toast } from 'sonner';
import { serverRefusalMessageOf } from '@/services/core/forbidden';
import { apiErrorMessage } from '@/utils/apiHelpers';
import type { ContactEvent } from '@/types/notifications/contact-events';
import type { Label as LabelType } from '@/types/settings';
import { avisarAgendadosMudaram } from '@/features/conversas/agendados';

const CardConversationTab = lazyWithRetry(() => import('./CardConversationTab'));
const TarefasDoLead = lazyWithRetry(() => import('@/features/tarefas/TarefasDoLead'));
const VisitsProposalsTab = lazyWithRetry(() => import('./card/VisitsProposalsTab'));
const RemoveFromRoletaDialog = lazyWithRetry(() => import('@/components/roleta/RemoveFromRoletaDialog'));
const CorrigirContatoDialog = lazyWithRetry(() => import('./card/CorrigirContatoDialog'));
const JuntarContato = lazyWithRetry(() => import('./card/JuntarContato'));
const ScheduleActionModal = lazyWithRetry(() =>
  import('@/components/scheduledActions/ScheduleActionModal').then(m => ({ default: m.ScheduleActionModal })),
);

interface EditItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: PipelineItem | null;
  stages: PipelineStage[];
  pipeline?: Pipeline | null;
  /**
   * Não é mais chamado: o card grava cada mudança na hora e não tem botão
   * Salvar. Fica opcional para quem ainda passa (quadro, conversa, contato).
   */
  onSubmit?: (data: never) => void;
  // Move otimista no board (sem reload) quando a etapa muda pelo card.
  onItemStageMoved?: (itemId: string, toStageId: string) => void;
  // Tag aplicada/removida grava na hora: avisa o quadro para o selo do card
  // refletir sem esperar o próximo reload.
  onLabelsChanged?: () => void;
  loading?: boolean;
  /**
   * Faixa centralizada acima do card. De Contatos: as abinhas dos atendimentos
   * quando a pessoa está em mais de um funil.
   */
  cabecalho?: ReactNode;
  /** Card sem funil (aberto de Contatos): o contato entrou num funil pelo card. */
  onColocadoNoFunil?: () => void;
  /** Juntou com outro contato: o aberto pode ter sumido. */
  onContatoJuntado?: () => void;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function EditItemModal({
  open,
  onOpenChange,
  item,
  stages,
  onItemStageMoved,
  onLabelsChanged,
  cabecalho,
  onColocadoNoFunil,
  onContatoJuntado,
}: EditItemModalProps) {
  const { users } = useAccountUsers();
  // Juntar contatos: só gestor (corretor isolado não vê a base pra escolher o outro).
  const corretor = useCorretorLogado();
  const { can } = useUserPermissions();
  const podeJuntar = !corretor && can('contacts', 'update');
  const [juntando, setJuntando] = useState(false);
  const {
    openLeadConversation,
    startConversationModal,
    opening: openingConversation,
  } = useOpenLeadConversation();

  // Feature flags do tenant (ausente/ligada = true → preserva comportamento atual).
  const canNotes = useFeature('card_notes');
  const canProperties = useFeature('card_property_interests');
  const canScheduleAction = useFeature('card_schedule_action');

  const [activeTab, setActiveTab] = useState('overview');
  const [resumoTarefas, setResumoTarefas] = useState<{ abertas: number; atrasadas: number } | null>(null);

  // Etapa: muda na hora (mesmo movimento do quadro), não espera Salvar.
  const [etapaId, setEtapaId] = useState<string | null>(null);
  const [movendoEtapa, setMovendoEtapa] = useState(false);

  // Telefone/e-mail exibidos: começam do contato e mudam depois de uma correção.
  const [telefoneDoLead, setTelefoneDoLead] = useState('');
  const [emailDoLead, setEmailDoLead] = useState('');
  const [corrigindoContato, setCorrigindoContato] = useState(false);

  // Responsável
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string | null>(null);
  const [assigningUser, setAssigningUser] = useState(false);

  // As roletas LIGADAS, para o "⋯ → Mandar pra roleta". `null` = leitura recusada
  // (cargo sem acesso às roletas): o item fica desabilitado, sem mandar a pessoa
  // pra uma página que ela não abre.
  const [roletas, setRoletas] = useState<RoletaConfig[] | null>([]);
  const [assigningRoleta, setAssigningRoleta] = useState(false);

  // Ofertas EM ABERTO deste lead: só nesse caso há prazo correndo e faz sentido
  // "Tirar da roleta".
  const [ofertasAbertas, setOfertasAbertas] = useState<BrokerAssignmentDetail[]>([]);
  const [tirandoDaRoleta, setTirandoDaRoleta] = useState(false);

  // Etiquetas
  const [availableLabels, setAvailableLabels] = useState<LabelType[]>([]);
  const [activeLabels, setActiveLabels] = useState<string[]>([]);
  const [labelPopoverOpen, setLabelPopoverOpen] = useState(false);
  const [labelSearch, setLabelSearch] = useState('');
  const [savingLabel, setSavingLabel] = useState(false);
  const [creatingLabel, setCreatingLabel] = useState(false);

  // Histórico
  const [historyEvents, setHistoryEvents] = useState<ContactEvent[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Origem escrita à mão ("Indicação", "Cliente de carteira"...). É o ÚNICO campo
  // da aba Origem que pode ser corrigido depois — anúncio/campanha é write-once.
  const [manualOrigin, setManualOrigin] = useState('');
  const [savedManualOrigin, setSavedManualOrigin] = useState('');
  const [savingManualOrigin, setSavingManualOrigin] = useState(false);

  // Agendar envio (a partir da caixa da conversa). null = fechado.
  const [agendandoEnvio, setAgendandoEnvio] = useState<string | null>(null);

  const loadHistory = useCallback(async (target?: PipelineItem | null) => {
    const contato = contatoDoCard(target ?? item);
    if (!contato?.id) return;
    setHistoryLoading(true);
    try {
      // Sem paginação neste painel: o que não vier aqui não tem como ser buscado
      // depois. Um lead de roleta gasta duas linhas por oferta.
      const res = await contactEventsService.getContactEvents(String(contato.id), { limit: 100 });
      setHistoryEvents(Array.isArray(res.data) ? res.data : []);
    } catch {
      setHistoryEvents([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [item]);

  // Inicializa quando o card abre.
  useEffect(() => {
    let cancelled = false;
    if (open && item) {
      setEtapaId(item.stage_id);
      setActiveTab('overview');
      setResumoTarefas(null);

      const c = contatoDoCard(item);
      setTelefoneDoLead(c?.phone_number || '');
      setEmailDoLead(c?.email || '');

      // Responsável: `item.assignee` (topo) já vem resolvido pelo backend —
      // assignee da conversa OU default_assignee do contato.
      const currentAssigneeId = item.assignee?.id ?? item.conversation?.assignee?.id;
      setSelectedAssigneeId(currentAssigneeId ? String(currentAssigneeId) : null);

      // Origem escrita: o card já traz o espelho, mas leads antigos podem só ter
      // no contato — por isso os fallbacks.
      const writtenOrigin =
        readManualOrigin(item.lead_origin)
        || readManualOrigin((c?.additional_attributes as { lead_origin?: unknown } | undefined)?.lead_origin);
      setManualOrigin(writtenOrigin);
      setSavedManualOrigin(writtenOrigin);

      roletaConfigService.getAll()
        .then(list => { if (!cancelled) setRoletas((list || []).filter(r => r.is_active)); })
        .catch(() => { if (!cancelled) setRoletas(null); });

      // Oferta correndo agora? Falha aqui só esconde o "Tirar da roleta" — quem
      // não pode mexer na roleta recebe 403 e não deve ver o botão mesmo.
      if (c?.id) {
        brokerAssignmentsService.listForLead(String(c.id))
          .then(list => { if (!cancelled) setOfertasAbertas(list); })
          .catch(() => { if (!cancelled) setOfertasAbertas([]); });
      } else {
        setOfertasAbertas([]);
      }

      // Tags ativas: a UNIÃO das do contato e das da conversa. O selo do card lê
      // as do CONTATO (é onde as automações escrevem) e o chat espelha na
      // CONVERSA; escolher só uma escondia tag. Do contato vêm {name}, da
      // conversa {title}.
      const labelNames = (raw: unknown): string[] =>
        Array.isArray(raw)
          ? (raw as Array<string | { title?: string; name?: string }>)
              .map(l => (typeof l === 'string' ? l : (l?.title ?? l?.name ?? '')))
              .filter(Boolean)
          : [];
      setActiveLabels([...new Set([
        ...labelNames((item.contact as any)?.labels),
        ...labelNames((item.conversation as any)?.labels),
      ])]);

      labelsService.getLabels()
        .then(res => {
          if (!cancelled) setAvailableLabels(Array.isArray(res.data) ? res.data as LabelType[] : []);
        })
        .catch(() => { if (!cancelled) setAvailableLabels([]); });

      loadHistory(item);

      // Etiqueta "meta" automática para lead de Facebook/Meta.
      const convId = item.conversation?.id ? String(item.conversation.id) : null;
      const existingLabels = labelNames((item.conversation as any)?.labels);
      const allAttrs = {
        ...((item.conversation as any)?.additional_attributes ?? {}),
        ...((item.contact as any)?.additional_attributes ?? {}),
      };
      const isMeta = ['campaign_source', 'utm_source', 'lead_source'].some(k =>
        String(allAttrs[k] ?? '').toLowerCase().includes('meta') ||
        String(allAttrs[k] ?? '').toLowerCase().includes('facebook')
      ) || String(allAttrs['campaign_medium'] ?? '').toLowerCase() === 'cpc';
      if (isMeta && convId && !existingLabels.includes('meta')) {
        conversationAPI.addLabels(convId, ['meta']).catch(() => {});
      }
    }
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.id]);

  const moverEtapa = useCallback(async (toStageId: string) => {
    if (!item || !etapaId || toStageId === etapaId) return;
    const anterior = etapaId;
    setEtapaId(toStageId);
    setMovendoEtapa(true);
    try {
      await pipelinesService.moveItem({
        item_id: item.id,
        pipeline_id: item.pipeline_id,
        from_stage_id: anterior,
        to_stage_id: toStageId,
      });
      onItemStageMoved?.(item.id, toStageId);
      loadHistory();
    } catch {
      setEtapaId(anterior);
      toast.error('Não consegui mudar a etapa');
    } finally {
      setMovendoEtapa(false);
    }
  }, [item, etapaId, onItemStageMoved, loadHistory]);

  // Responsável sem depender de conversa: lead de formulário/anúncio entra sem
  // conversa e precisa de dono. Com conversa, atribui a conversa (o backend
  // espelha no contato); sem, grava direto no contato.
  const handleAssigneeChange = useCallback(async (userId: string) => {
    const nextId = userId === 'unassigned' ? null : userId;
    const contactId = contatoDoCard(item)?.id;
    if (!item?.conversation?.id && !contactId) return;

    setSelectedAssigneeId(nextId);
    setAssigningUser(true);
    try {
      if (item?.conversation?.id) {
        await conversationAPI.assignConversation(item.conversation.id, nextId);
      } else {
        await contactsService.updateContact(String(contactId), { default_assignee_id: nextId });
      }
    } catch (error) {
      if (serverRefusalMessageOf(error)) return; // o aviso global já mostrou a frase
      toast.error('Erro ao definir o responsável');
    } finally {
      setAssigningUser(false);
    }
  }, [item]);

  const handleAssignViaRoleta = useCallback(async (roletaId: string) => {
    const contactId = contatoDoCard(item)?.id;
    if (!contactId) { toast.error('Lead sem contato'); return; }
    setAssigningRoleta(true);
    try {
      const a = await roletaConfigService.assign(roletaId, {
        contact_id: String(contactId),
        conversation_id: item?.conversation?.id ? String(item.conversation.id) : undefined,
        pipeline_item_id: item?.id ? String(item.id) : undefined,
      });
      toast.success(textoDaOferta(a?.assigned_user?.name, roletas?.find(r => r.id === roletaId)));
      loadHistory();
      // A oferta nova aparece no card na hora (e com ela o "Tirar da roleta").
      brokerAssignmentsService.listForLead(String(contactId))
        .then(setOfertasAbertas)
        .catch(() => { /* leitura de fundo não grita */ });
    } catch (e) {
      // O servidor diz o motivo real (fora do horário, desligada, ninguém ativo,
      // já esperando aceite).
      toast.error(apiErrorMessage(e, 'Não consegui mandar pra roleta.'));
    } finally {
      setAssigningRoleta(false);
    }
  }, [item, loadHistory, roletas]);

  const labelTargetConvId = item?.conversation?.id ? String(item.conversation.id) : null;
  const labelTargetContactId = contatoDoCard(item)?.id ?? null;

  // Contato = lista inteira (fonte do selo do card). Conversa = só o diff, que
  // o endpoint dela só soma/subtrai.
  const persistLabels = useCallback(
    async (nextLabels: string[], change: { added?: string; removed?: string }) => {
      if (labelTargetContactId) {
        await contactsService.updateContact(String(labelTargetContactId), { labels: nextLabels });
      }
      if (labelTargetConvId) {
        if (change.added) await conversationAPI.addLabels(labelTargetConvId, [change.added]);
        if (change.removed) await conversationAPI.removeLabels(labelTargetConvId, [change.removed]);
      }
    },
    [labelTargetConvId, labelTargetContactId],
  );

  const toggleLabel = useCallback(async (labelTitle: string) => {
    if (!labelTargetConvId && !labelTargetContactId) return;
    setSavingLabel(true);
    const has = activeLabels.includes(labelTitle);
    try {
      const next = has ? activeLabels.filter(l => l !== labelTitle) : [...activeLabels, labelTitle];
      await persistLabels(next, has ? { removed: labelTitle } : { added: labelTitle });
      setActiveLabels(next);
      onLabelsChanged?.();
    } catch {
      toast.error(has ? 'Não foi possível remover a etiqueta' : 'Não foi possível aplicar a etiqueta');
    } finally {
      setSavingLabel(false);
    }
  }, [activeLabels, persistLabels, labelTargetConvId, labelTargetContactId, onLabelsChanged]);

  const createAndApplyLabel = useCallback(async (rawTitle: string) => {
    const title = rawTitle.trim();
    if (!title || (!labelTargetConvId && !labelTargetContactId)) return;
    setCreatingLabel(true);
    try {
      const created = await labelsService.createLabel({ title, color: '#7C3AED', show_on_sidebar: true });
      const canonical = (created as any)?.title ?? title.toLowerCase();
      setAvailableLabels(prev =>
        prev.some(l => l.title === canonical) ? prev : [...prev, created as unknown as LabelType]
      );
      if (!activeLabels.includes(canonical)) {
        const next = [...activeLabels, canonical];
        await persistLabels(next, { added: canonical });
        setActiveLabels(next);
        onLabelsChanged?.();
      }
    } catch {
      toast.error('Não foi possível criar a etiqueta');
    } finally {
      setCreatingLabel(false);
      setLabelPopoverOpen(false);
      setLabelSearch('');
    }
  }, [activeLabels, persistLabels, labelTargetConvId, labelTargetContactId, onLabelsChanged]);

  if (!item) return null;

  const contato = contatoDoCard(item);
  const nomeExibido = (() => {
    const candidatos = [item.contact?.name, (item.conversation as any)?.contact?.name];
    const bom = candidatos.find(c => c && !isPhoneLikeName(c));
    if (bom) return bom as string;
    return telefoneDoLead ? telefone(telefoneDoLead) : (candidatos[0] || 'Lead sem nome');
  })();
  const avatarContact = contato
    ? {
        id: contato.id != null ? String(contato.id) : undefined,
        name: nomeExibido,
        avatar_url: (contato as any).avatar_url ?? null,
        thumbnail: (contato as any).thumbnail ?? null,
      }
    : null;
  const corrigivel = podeCorrigirContato(contato);
  const dadosDaOrigem = (item.lead_origin as Record<string, unknown> | null)
    ?? ((contato?.additional_attributes as { lead_origin?: Record<string, unknown> } | undefined)?.lead_origin ?? null);
  const origem = origemCurta(dadosDaOrigem);
  // Card aberto de Contatos pra quem não está em funil: sem etapa, sem
  // Ganho/Perdido, sem Conversão Meta (spec 2026-10-02-fase-4-card-do-contato).
  const foraDoFunil = semFunil(item);

  const handleSaveManualOrigin = async () => {
    if (!contato?.id) {
      toast.error('Este card não tem contato — não dá pra gravar a origem.');
      return;
    }
    const text = manualOrigin.trim();
    setSavingManualOrigin(true);
    try {
      await contactsService.updateContact(String(contato.id), { lead_origin_note: text });
      setManualOrigin(text);
      setSavedManualOrigin(text);
      // Espelho local para o card não voltar a mostrar a origem antiga.
      item.lead_origin = { ...(item.lead_origin ?? {}), manual_origin: text };
      toast.success(text ? 'Origem do lead salva.' : 'Origem do lead limpa.');
    } catch (error) {
      console.error('Error saving lead origin:', error);
      toast.error('Não consegui salvar a origem do lead.');
    } finally {
      setSavingManualOrigin(false);
    }
  };

  const filteredLabels = availableLabels.filter(l =>
    l.title.toLowerCase().includes(labelSearch.toLowerCase())
  );
  const trimmedLabelSearch = labelSearch.trim();
  const exactLabelExists = availableLabels.some(
    l => l.title.toLowerCase() === trimmedLabelSearch.toLowerCase()
  );
  const canCreateLabel = trimmedLabelSearch.length > 0 && !exactLabelExists;

  // Cor de cada tag: prioriza a lista de labels da conta e cai nos labels crus
  // do contato/conversa (que já trazem color).
  const labelColorMap: Record<string, string> = {};
  [
    ...(Array.isArray((item.contact as any)?.labels) ? (item.contact as any).labels : []),
    ...(Array.isArray((item.conversation as any)?.labels) ? (item.conversation as any).labels : []),
  ].forEach((l: any) => {
    const key = typeof l === 'string' ? l : (l?.title ?? l?.name);
    if (key && l?.color) labelColorMap[String(key).toLowerCase()] = l.color;
  });
  availableLabels.forEach(l => {
    if (l.color) labelColorMap[l.title.toLowerCase()] = l.color;
  });
  const labelStyle = (title: string) => {
    const color = labelColorMap[title.toLowerCase()] || '#7c3aed';
    return /^#[0-9a-f]{6}$/i.test(color)
      ? { backgroundColor: `${color}22`, color }
      : { backgroundColor: color, color: '#fff' };
  };

  const roletaDoLead = item.roleta
    ? `${roletaLabel(item.roleta)}${roletas && roletas.length > 0 && !roletas.some(r => r.id === item.roleta!.id) ? ' (desativada)' : ''}`
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1280px] w-[96vw] h-[92vh] max-h-[92vh] p-0 gap-0 overflow-hidden flex flex-col">
        <DialogTitle className="sr-only">{nomeExibido}</DialogTitle>
        <DialogDescription className="sr-only">Card do lead</DialogDescription>

        {cabecalho && (
          <div className="flex shrink-0 justify-center border-b border-border px-12 py-2.5">{cabecalho}</div>
        )}

        <div className="flex-1 min-h-0 flex flex-col md:grid md:grid-cols-[380px_minmax(0,1fr)] overflow-y-auto md:overflow-hidden">
          {/* ESQUERDA — fixa, nunca rola */}
          <aside className="flex flex-col gap-4 border-b md:border-b-0 md:border-r border-border p-5 md:min-h-0">
            {/* Quem é */}
            <div className="flex items-start gap-3 pr-6">
              {avatarContact && (
                <ContactAvatar contact={avatarContact} size="md" showColoredFallback className="shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xl font-semibold leading-tight lm-redact" title={nomeExibido}>{nomeExibido}</p>
                {telefoneDoLead && (
                  <p className="mt-1 text-sm text-muted-foreground flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" /> {telefone(telefoneDoLead)}
                  </p>
                )}
                {emailDoLead && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5 truncate" title={emailDoLead}>
                    <Mail className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{emailDoLead}</span>
                  </p>
                )}
                {/* Origem como selo, junto de quem é o lead — solta no meio da
                    situação parecia um subtítulo sem dono. */}
                {origem && (
                  <span
                    className={`mt-2 inline-flex max-w-full items-center rounded-full px-2.5 py-1 text-xs font-medium ${classeDaOrigem(dadosDaOrigem)}`}
                    title={origem}
                  >
                    <span className="truncate">{origem}</span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                {corrigivel && contato?.id != null && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    aria-label="Corrigir telefone ou e-mail"
                    title="Corrigir telefone ou e-mail"
                    onClick={() => setCorrigindoContato(true)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
                <CardMoreMenu
                  item={item}
                  roletas={roletas}
                  trocandoRoleta={assigningRoleta}
                  onTrocarRoleta={handleAssignViaRoleta}
                  onTirarDaRoleta={ofertasAbertas.length > 0 ? () => setTirandoDaRoleta(true) : undefined}
                  onRemovido={() => onOpenChange(false)}
                  onJuntar={podeJuntar && contato?.id != null ? () => setJuntando(true) : undefined}
                />
              </div>
            </div>

            {/* Situação */}
            <div className="space-y-2">
              {/* Etapa e Responsável lado a lado: economiza altura na coluna fixa. */}
              <div className="grid grid-cols-2 gap-3">
              {foraDoFunil ? (
                contato?.id != null && onColocadoNoFunil ? (
                  <ColocarNoFunil contactId={String(contato.id)} conversationId={conversaDoCard(item)} onColocado={onColocadoNoFunil} />
                ) : <div />
              ) : (
              <CampoEtapa stages={stages} etapaId={etapaId} onMover={moverEtapa} disabled={movendoEtapa} />
              )}

              {/* Responsável — sem gate de conversa: lead de formulário/anúncio
                  não tem conversa e mesmo assim precisa de dono. */}
              {(item.conversation?.id || contato?.id) && (
                <CampoResponsavel
                  users={users}
                  responsavelId={selectedAssigneeId}
                  onTrocar={handleAssigneeChange}
                  carregando={assigningUser}
                />
              )}
              </div>
              {roletaDoLead && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Shuffle className="h-3.5 w-3.5" /> veio pela {roletaDoLead}
                </span>
              )}

              {/* A oferta que espera o PRÓPRIO usuário — o corretor aceita daqui. */}
              <OfferActions
                contactId={contato?.id != null ? String(contato.id) : undefined}
                conversationId={item.conversation?.id}
                onAccepted={() => { onLabelsChanged?.(); loadHistory(); }}
              />
              {ofertasAbertas.length > 0 && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 dark:border-amber-900 dark:bg-amber-950/30">
                  <p className="text-[11px] text-amber-800 dark:text-amber-300">
                    No sorteio agora, esperando o aceite de{' '}
                    <strong>{ofertasAbertas.map(o => o.corretor ?? 'corretor').join(', ')}</strong>.
                  </p>
                  <Button variant="outline" size="sm" className="mt-1.5 h-7 text-xs" onClick={() => setTirandoDaRoleta(true)}>
                    Tirar da roleta
                  </Button>
                </div>
              )}
            </div>

            <LeadQuickActions
              item={item}
              nomeExibido={nomeExibido}
              abrindoConversa={openingConversation}
              onAbrirConversa={() => openLeadConversation(item)}
              onVisitaCriada={() => loadHistory()}
            />

            {/* Etiquetas */}
            <div className="flex flex-wrap items-center gap-1.5">
              {activeLabels.map(l => (
                <Badge key={l} variant="secondary" className="gap-1 text-sm h-7 px-2.5 border-0 font-medium" style={labelStyle(l)}>
                  {l}
                  <button onClick={() => toggleLabel(l)} aria-label="Remover etiqueta" title="Remover etiqueta" className="hover:opacity-60">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </Badge>
              ))}
              {(labelTargetConvId || labelTargetContactId) && (
                <Popover open={labelPopoverOpen} onOpenChange={setLabelPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 px-3 text-sm gap-1.5 border-dashed">
                      {(savingLabel || creatingLabel) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                      Adicionar etiqueta
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-52 p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar ou criar etiqueta..." value={labelSearch} onValueChange={setLabelSearch} />
                      {/* onWheel stopPropagation: sem isso a roda do mouse não
                          rolava a lista dentro do popover/modal. */}
                      <CommandList className="max-h-56 overflow-y-auto overscroll-contain" onWheel={e => e.stopPropagation()}>
                        <CommandEmpty>Digite o nome e clique em "Criar etiqueta".</CommandEmpty>
                        <CommandGroup heading="Nova etiqueta">
                          <CommandItem
                            value={`__create__${trimmedLabelSearch}`}
                            disabled={!canCreateLabel || creatingLabel}
                            onSelect={() => canCreateLabel && createAndApplyLabel(trimmedLabelSearch)}
                          >
                            {creatingLabel ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-2 h-3.5 w-3.5" />}
                            {trimmedLabelSearch ? `Criar etiqueta "${trimmedLabelSearch}"` : 'Digite acima pra criar uma nova etiqueta'}
                          </CommandItem>
                        </CommandGroup>
                        <CommandGroup heading="Etiquetas existentes">
                          {filteredLabels.map(l => (
                            <CommandItem key={l.id} value={l.title} onSelect={() => { toggleLabel(l.title); setLabelPopoverOpen(false); setLabelSearch(''); }}>
                              <Check className={`mr-2 h-3.5 w-3.5 ${activeLabels.includes(l.title) ? 'opacity-100' : 'opacity-0'}`} />
                              <span className="w-2.5 h-2.5 rounded-full mr-2 shrink-0 inline-block" style={{ backgroundColor: l.color }} />
                              {l.title}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              )}
            </div>

            {/* Follow-up numa linha (a lista abre numa janelinha) */}
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Follow-up</span>
              <FollowupTimeline
                contactId={contato?.id != null ? String(contato.id) : null}
                conversationId={conversaDoCard(item)}
                leadName={contato?.name ?? null}
                compacto
              />
            </div>

            {!foraDoFunil && (
              <>
                <CapiConversionPanel contactId={contato?.id ?? null} pipelineItemId={item.id} variante="compacto" />

                {/* Rodapé fixo da coluna */}
                <div className="mt-auto pt-2 border-t border-border">
                  <CardResultFooter stages={stages} etapaAtualId={etapaId} movendo={movendoEtapa} onMover={moverEtapa} />
                </div>
              </>
            )}
          </aside>

          {/* DIREITA — abas da casa (sublinhado com ícone), a faixa inteira no topo */}
          <section className="flex flex-col min-h-0 px-5 pt-3 pb-4">
            <Abas
              rotulo="Seções do card do lead"
              abas={[
                { chave: 'overview', rotulo: 'Detalhes', icone: ClipboardList },
                { chave: 'conversation', rotulo: 'Conversa', icone: MessageSquare },
                { chave: 'tasks', icone: ListTodo, ...rotuloDaAbaTarefas(resumoTarefas, item.tasks_info) },
                { chave: 'visits', rotulo: 'Visitas e propostas', icone: CalendarCheck },
                { chave: 'origin', rotulo: 'Origem', icone: Megaphone },
              ]}
              ativa={activeTab}
              aoTrocar={setActiveTab}
              className="shrink-0 pr-8"
            />

            <div className="flex-1 min-h-0 overflow-y-auto pt-4">
              {activeTab === 'overview' && (
                <LeadDetailsTab
                  item={item}
                  mostrarImoveis={canProperties}
                  mostrarObservacoes={canNotes}
                  historico={historyEvents}
                  carregandoHistorico={historyLoading}
                  onRecarregarHistorico={() => loadHistory()}
                />
              )}

              {activeTab === 'conversation' && (
                <Suspense fallback={null}>
                  <CardConversationTab
                    item={item}
                    onAgendarEnvio={canScheduleAction && contato?.id != null ? texto => setAgendandoEnvio(texto) : undefined}
                  />
                </Suspense>
              )}

              {activeTab === 'tasks' && (
                foraDoFunil ? (
                  <p className="text-sm text-muted-foreground">Pra criar tarefa, coloque o lead no funil.</p>
                ) : (
                  <Suspense fallback={null}>
                    <TarefasDoLead pipelineItemIds={[String(item.id)]} criarNoCard={String(item.id)} aoContar={setResumoTarefas} />
                  </Suspense>
                )
              )}

              {activeTab === 'visits' && (
                <Suspense fallback={null}>
                  <VisitsProposalsTab item={item} nomeExibido={nomeExibido} />
                </Suspense>
              )}

              {activeTab === 'origin' && (
                <CardOriginTab
                  item={item}
                  manualOrigin={manualOrigin}
                  onManualOriginChange={setManualOrigin}
                  savedManualOrigin={savedManualOrigin}
                  savingManualOrigin={savingManualOrigin}
                  onSaveManualOrigin={handleSaveManualOrigin}
                />
              )}
            </div>
          </section>
        </div>
      </DialogContent>

      {corrigindoContato && contato?.id != null && (
        <Suspense fallback={null}>
          <CorrigirContatoDialog
            open={corrigindoContato}
            onOpenChange={setCorrigindoContato}
            contactId={String(contato.id)}
            telefoneAtual={telefoneDoLead}
            emailAtual={emailDoLead}
            onCorrigido={({ phone_number, email }) => {
              setTelefoneDoLead(phone_number);
              setEmailDoLead(email);
              loadHistory();
            }}
          />
        </Suspense>
      )}

      {agendandoEnvio !== null && contato?.id != null && (
        <Suspense fallback={null}>
          <ScheduleActionModal
            open
            onClose={() => {
              setAgendandoEnvio(null);
              // O painel do lead ao lado da conversa relê a seção Agendados.
              avisarAgendadosMudaram(contato.id);
            }}
            contactId={String(contato.id)}
            mensagemInicial={agendandoEnvio}
          />
        </Suspense>
      )}

      {/* Tirar da roleta — o destino do lead é escolhido no diálogo. */}
      {tirandoDaRoleta && contato?.id != null && (
        <Suspense fallback={null}>
          <RemoveFromRoletaDialog
            open
            onOpenChange={setTirandoDaRoleta}
            contactId={String(contato.id)}
            leadName={contato.name ?? undefined}
            offers={ofertasAbertas}
            onDone={() => setOfertasAbertas([])}
          />
        </Suspense>
      )}

      {juntando && contato?.id != null && (
        <Suspense fallback={null}>
          <JuntarContato
            contato={contato as unknown as Contact}
            onFechar={() => setJuntando(false)}
            onJuntado={() => {
              setJuntando(false);
              onOpenChange(false);
              onContatoJuntado?.();
            }}
          />
        </Suspense>
      )}

      {/* Iniciar conversa — só monta para lead que ainda não tem conversa */}
      {startConversationModal}
    </Dialog>
  );
}
