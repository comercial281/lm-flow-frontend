// src/features/cardDoLead/useCardDoLead.ts
// O card do lead SEM a moldura (E4, spec do funil 2026-10-07 §5.2). Tudo o que
// a janela do quadro fazia por dentro mora aqui: etapa, responsável, roletas,
// ofertas, etiquetas, histórico, origem escrita à mão, correção de telefone e
// e-mail, juntar contatos e agendar envio. A janela (EditItemModal) e a página
// (CardCompletoPage) só posicionam os blocos de ./blocos.
//
// ⚠️ Inicializa quando `aberto` vira true e quando muda o `item.id`, como a
// janela sempre fez. Quem troca de card sem trocar de id (card sem funil tem id
// '') precisa de `key` no componente (diário: "card do lead abre de Contatos").
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAccountUsers } from '@/hooks/useAccountUsers';
import { useFeature } from '@/contexts/TenantFeaturesContext';
import { useOpenLeadConversation } from '@/hooks/useOpenLeadConversation';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useCorretorLogado } from '@/features/contatos/useCorretorLogado';
import { readManualOrigin } from '@/constants/manualLeadOrigin';
import { telefone } from '@/lib/formato';
import { isPhoneLikeName } from '@/lib/nomeDoContato';
import { conversationAPI } from '@/services/conversations/conversationService';
import { contactEventsService } from '@/services/contacts/contactEventsService';
import { labelsService } from '@/services/contacts/labelsService';
import { contactsService } from '@/services/contacts/contactsService';
import { pipelinesService } from '@/services/pipelines/pipelinesService';
import { roletaConfigService, roletaLabel, type RoletaConfig } from '@/services/roletaConfig/roletaConfigService';
import { brokerAssignmentsService, type BrokerAssignmentDetail } from '@/services/roletaConfig/brokerAssignmentsService';
import { textoDaOferta } from '@/components/roleta/textosDaRoleta';
import { serverRefusalMessageOf } from '@/services/core/forbidden';
import { apiErrorMessage } from '@/utils/apiHelpers';
import type { PipelineItem, PipelineStage } from '@/types/analytics';
import type { ContactEvent } from '@/types/notifications/contact-events';
import type { Label as LabelType } from '@/types/settings';
import { cardFechado, ehColunaDeGanho, mensagemDaRecusa } from '@/features/pipelines/situacao/situacao';
import { contatoDoCard, origemCurta, podeCorrigirContato, semFunil } from './cardDoLead';

// Do contato vêm {name}, da conversa {title}.
const nomesDasEtiquetas = (raw: unknown): string[] =>
  Array.isArray(raw)
    ? (raw as Array<string | { title?: string; name?: string }>)
        .map(l => (typeof l === 'string' ? l : (l?.title ?? l?.name ?? '')))
        .filter(Boolean)
    : [];

// Qual card está na tela: o id do card e o do contato (card sem funil tem id '').
const chaveDoCard = (item: PipelineItem | null | undefined): string =>
  `${item?.id ?? ''}|${contatoDoCard(item)?.id ?? ''}`;

export interface OpcoesDoCard {
  /** A janela está aberta (a página passa sempre true). */
  aberto: boolean;
  stages: PipelineStage[];
  /** Move otimista no quadro (sem recarregar) quando a etapa muda pelo card. */
  onItemStageMoved?: (itemId: string, toStageId: string) => void;
  /** Etiqueta aplicada/removida grava na hora: o quadro refaz o selo. */
  onLabelsChanged?: () => void;
  /**
   * A Etapa escolhida foi a coluna Concluído e marcou Ganho (ajuste de 08/10):
   * quem abriu o card (quadro, página) atualiza com o card ganho.
   * O `situacao.aoMudar` (rodapé) NÃO chama isto: quem liga o rodapé avisa.
   */
  onItemStatusChanged?: (item: PipelineItem) => void;
}

export function useCardDoLead(
  item: PipelineItem | null,
  { aberto, stages, onItemStageMoved, onLabelsChanged, onItemStatusChanged }: OpcoesDoCard,
) {
  const { users } = useAccountUsers();
  // Juntar contatos: só gestor (corretor isolado não vê a base pra escolher o outro).
  const corretor = useCorretorLogado();
  const { can } = useUserPermissions();
  const podeJuntar = !corretor && can('contacts', 'update');
  const [juntando, setJuntando] = useState(false);
  const { openLeadConversation, startConversationModal, opening: openingConversation } = useOpenLeadConversation();

  // Feature flags do cliente (ausente/ligada = true).
  const canNotes = useFeature('card_notes');
  const canProperties = useFeature('card_property_interests');
  const canScheduleAction = useFeature('card_schedule_action');

  // Etapa: muda na hora (mesmo movimento do quadro).
  const [etapaId, setEtapaId] = useState<string | null>(null);
  const [movendoEtapa, setMovendoEtapa] = useState(false);

  // Situação do card (Ganho · Perdido · Reabrir — Parte 3), separada da etapa.
  // Quem grava é o rodapé (CardResultFooter); aqui o card acompanha para o selo
  // e para travar a Etapa. Card fechado não muda de etapa: reabrir antes.
  const [itemDaSituacao, setItemDaSituacao] = useState<PipelineItem | null>(item);
  useEffect(() => {
    setItemDaSituacao(item);
  }, [item?.id, item?.status]); // eslint-disable-line react-hooks/exhaustive-deps
  const fechado = cardFechado(itemDaSituacao);
  // O rodapé está gravando Ganho/Perdido/Reabrir: a Etapa espera (e vice-versa).
  const [rodapeSalvando, setRodapeSalvando] = useState(false);

  // Telefone/e-mail exibidos: começam do contato e mudam depois de uma correção.
  const [telefoneDoLead, setTelefoneDoLead] = useState('');
  const [emailDoLead, setEmailDoLead] = useState('');
  const [corrigindoContato, setCorrigindoContato] = useState(false);

  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string | null>(null);
  const [assigningUser, setAssigningUser] = useState(false);

  // As roletas LIGADAS, para o "⋯ → Mandar pra roleta". `null` = leitura recusada.
  const [roletas, setRoletas] = useState<RoletaConfig[] | null>([]);
  const [assigningRoleta, setAssigningRoleta] = useState(false);

  // Ofertas EM ABERTO deste lead: só aí faz sentido "Tirar da roleta".
  const [ofertasAbertas, setOfertasAbertas] = useState<BrokerAssignmentDetail[]>([]);
  const [tirandoDaRoleta, setTirandoDaRoleta] = useState(false);

  const [availableLabels, setAvailableLabels] = useState<LabelType[]>([]);
  const [activeLabels, setActiveLabels] = useState<string[]>([]);
  const [labelPopoverOpen, setLabelPopoverOpen] = useState(false);
  const [labelSearch, setLabelSearch] = useState('');
  const [savingLabel, setSavingLabel] = useState(false);
  const [creatingLabel, setCreatingLabel] = useState(false);

  const [historyEvents, setHistoryEvents] = useState<ContactEvent[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Origem escrita à mão ("Indicação"): o ÚNICO campo da aba Origem que se corrige.
  const [manualOrigin, setManualOrigin] = useState('');
  const [savedManualOrigin, setSavedManualOrigin] = useState('');
  const [savingManualOrigin, setSavingManualOrigin] = useState(false);

  // Agendar envio (a partir da caixa da conversa). null = fechado.
  const [agendandoEnvio, setAgendandoEnvio] = useState<string | null>(null);

  // Resposta velha não pinta o card errado: só vale a leitura mais nova, e só
  // se o card na tela ainda é o mesmo de quando ela saiu.
  const cardNaTela = useRef(chaveDoCard(item));
  cardNaTela.current = chaveDoCard(item);
  const leituraDoHistorico = useRef(0);

  const loadHistory = useCallback(async (target?: PipelineItem | null) => {
    const alvo = target ?? item;
    const contato = contatoDoCard(alvo);
    if (!contato?.id) return;
    const chave = chaveDoCard(alvo);
    const leitura = ++leituraDoHistorico.current;
    const valeAinda = () => leitura === leituraDoHistorico.current && cardNaTela.current === chave;
    setHistoryLoading(true);
    try {
      // Sem paginação neste painel: um lead de roleta gasta duas linhas por oferta.
      const res = await contactEventsService.getContactEvents(String(contato.id), { limit: 100 });
      if (valeAinda()) setHistoryEvents(Array.isArray(res.data) ? res.data : []);
    } catch {
      if (valeAinda()) setHistoryEvents([]);
    } finally {
      if (leitura === leituraDoHistorico.current) setHistoryLoading(false);
    }
  }, [item]);

  // Ganho leva o card para Concluído e Reabrir o devolve (ajuste de 08/10): a
  // Etapa acompanha o `stage_id` que a situação trouxe. O Histórico recarrega
  // (como a janela sempre fez quando o rodapé grava).
  const aoMudarSituacao = useCallback((novo: PipelineItem) => {
    setItemDaSituacao(novo);
    if (novo.stage_id) setEtapaId(String(novo.stage_id));
    void loadHistory();
  }, [loadHistory]);

  // Inicializa quando o card abre.
  useEffect(() => {
    let cancelled = false;
    if (aberto && item) {
      setEtapaId(item.stage_id);

      const c = contatoDoCard(item);
      setTelefoneDoLead(c?.phone_number || '');
      setEmailDoLead(c?.email || '');

      // `item.assignee` já vem resolvido: assignee da conversa OU default_assignee do contato.
      const currentAssigneeId = item.assignee?.id ?? item.conversation?.assignee?.id;
      setSelectedAssigneeId(currentAssigneeId ? String(currentAssigneeId) : null);

      const writtenOrigin =
        readManualOrigin(item.lead_origin)
        || readManualOrigin((c?.additional_attributes as { lead_origin?: unknown } | undefined)?.lead_origin);
      setManualOrigin(writtenOrigin);
      setSavedManualOrigin(writtenOrigin);

      roletaConfigService.getAll()
        .then(list => { if (!cancelled) setRoletas((list || []).filter(r => r.is_active)); })
        .catch(() => { if (!cancelled) setRoletas(null); });

      if (c?.id) {
        brokerAssignmentsService.listForLead(String(c.id))
          .then(list => { if (!cancelled) setOfertasAbertas(list); })
          .catch(() => { if (!cancelled) setOfertasAbertas([]); });
      } else {
        setOfertasAbertas([]);
      }

      // Etiquetas ativas: a UNIÃO das do contato e das da conversa.
      setActiveLabels([...new Set([
        ...nomesDasEtiquetas((item.contact as any)?.labels),
        ...nomesDasEtiquetas((item.conversation as any)?.labels),
      ])]);

      labelsService.getLabels()
        .then(res => {
          if (!cancelled) setAvailableLabels(Array.isArray(res.data) ? res.data as LabelType[] : []);
        })
        .catch(() => { if (!cancelled) setAvailableLabels([]); });

      loadHistory(item);

      // Etiqueta "meta" automática para lead de Facebook/Meta.
      const convId = item.conversation?.id ? String(item.conversation.id) : null;
      const existingLabels = nomesDasEtiquetas((item.conversation as any)?.labels);
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
  }, [aberto, item?.id]);

  const moverEtapa = useCallback(async (toStageId: string) => {
    if (!item || !etapaId || toStageId === etapaId || fechado || rodapeSalvando) return;
    const anterior = etapaId;
    setEtapaId(toStageId);
    setMovendoEtapa(true);
    try {
      // Concluído é a coluna do Ganho (ajuste de 08/10, P3-T5): escolher ela na
      // Etapa marca Ganho pela mesma rota do botão.
      if (ehColunaDeGanho(stages.find(s => String(s.id) === String(toStageId)))) {
        const ganho = await pipelinesService.setItemStatus(item.pipeline_id, item.id, { status: 'won' });
        const junto = { ...(itemDaSituacao ?? item), ...ganho } as PipelineItem;
        aoMudarSituacao(junto);
        onItemStatusChanged?.(junto);
        toast.success('Lead marcado como ganho.');
      } else {
        await pipelinesService.moveItem({
          item_id: item.id,
          pipeline_id: item.pipeline_id,
          from_stage_id: anterior,
          to_stage_id: toStageId,
        });
        onItemStageMoved?.(item.id, toStageId);
        loadHistory();
      }
    } catch (erro) {
      setEtapaId(anterior);
      toast.error(mensagemDaRecusa(erro, 'Não consegui mudar a etapa'));
    } finally {
      setMovendoEtapa(false);
    }
  }, [item, etapaId, onItemStageMoved, loadHistory, fechado, rodapeSalvando, stages, itemDaSituacao, aoMudarSituacao, onItemStatusChanged]);

  // Com conversa, atribui a conversa (o servidor espelha no contato); sem, grava no contato.
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
      brokerAssignmentsService.listForLead(String(contactId))
        .then(setOfertasAbertas)
        .catch(() => { /* leitura de fundo não grita */ });
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Não consegui mandar pra roleta.'));
    } finally {
      setAssigningRoleta(false);
    }
  }, [item, loadHistory, roletas]);

  const labelTargetConvId = item?.conversation?.id ? String(item.conversation.id) : null;
  const labelTargetContactId = contatoDoCard(item)?.id ?? null;

  // Contato = lista inteira (fonte do selo do card). Conversa = só o diff.
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

  // ── Derivados ─────────────────────────────────────────────────────────────
  const contato = contatoDoCard(item);
  const nomeExibido = (() => {
    if (!item) return 'Lead sem nome';
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
  const dadosDaOrigem = (item?.lead_origin as Record<string, unknown> | null | undefined)
    ?? ((contato?.additional_attributes as { lead_origin?: Record<string, unknown> } | undefined)?.lead_origin ?? null);
  const origem = origemCurta(dadosDaOrigem);
  const etapaAtual = stages.find(s => s.id.toString() === etapaId);
  // Card aberto de Contatos pra quem não está em funil (spec 2026-10-02-fase-4-card-do-contato).
  const foraDoFunil = semFunil(item);

  const handleSaveManualOrigin = async () => {
    if (!item || !contato?.id) {
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

  // Cor de cada etiqueta: a lista da conta primeiro, os labels crus do card depois.
  const labelColorMap: Record<string, string> = {};
  [
    ...(Array.isArray((item?.contact as any)?.labels) ? (item?.contact as any).labels : []),
    ...(Array.isArray((item?.conversation as any)?.labels) ? (item?.conversation as any).labels : []),
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

  const roletaDoLead = item?.roleta
    ? `${roletaLabel(item.roleta)}${roletas && roletas.length > 0 && !roletas.some(r => r.id === item.roleta!.id) ? ' (desativada)' : ''}`
    : null;

  const recarregarHistorico = () => { void loadHistory(); };

  return {
    item,
    contato,
    nomeExibido,
    avatarContact,
    corrigivel,
    dadosDaOrigem,
    origem,
    foraDoFunil,
    roletaDoLead,
    recursos: { notas: canNotes, imoveis: canProperties, agendarEnvio: canScheduleAction },
    conversa: { abrir: openLeadConversation, abrindo: openingConversation, janelaDeInicio: startConversationModal },
    etapa: { id: etapaId, atual: etapaAtual, opcoes: stages, movendo: movendoEtapa, mover: moverEtapa },
    situacao: {
      item: itemDaSituacao,
      fechado,
      aoMudar: aoMudarSituacao,
      // Liga no `onSalvando` do CardResultFooter; a Etapa fica desabilitada enquanto true.
      rodapeSalvando,
      setRodapeSalvando,
    },
    responsavel: { id: selectedAssigneeId, salvando: assigningUser, usuarios: users, trocar: handleAssigneeChange },
    roleta: {
      ligadas: roletas,
      mandando: assigningRoleta,
      mandar: handleAssignViaRoleta,
      ofertasAbertas,
      setOfertasAbertas,
      tirando: tirandoDaRoleta,
      setTirando: setTirandoDaRoleta,
    },
    // A oferta que esperava o PRÓPRIO usuário foi aceita aqui.
    aoAceitarOferta: () => { onLabelsChanged?.(); recarregarHistorico(); },
    etiquetas: {
      ativas: activeLabels,
      filtradas: filteredLabels,
      busca: labelSearch,
      setBusca: setLabelSearch,
      buscaLimpa: trimmedLabelSearch,
      podeCriar: canCreateLabel,
      popoverAberto: labelPopoverOpen,
      setPopoverAberto: setLabelPopoverOpen,
      salvando: savingLabel,
      criando: creatingLabel,
      alternar: toggleLabel,
      criarEAplicar: createAndApplyLabel,
      estilo: labelStyle,
      podeEtiquetar: !!(labelTargetConvId || labelTargetContactId),
    },
    historico: { eventos: historyEvents, carregando: historyLoading, recarregar: recarregarHistorico },
    origemManual: {
      texto: manualOrigin,
      setTexto: setManualOrigin,
      salvo: savedManualOrigin,
      salvando: savingManualOrigin,
      salvar: handleSaveManualOrigin,
    },
    identidade: {
      telefone: telefoneDoLead,
      email: emailDoLead,
      corrigindo: corrigindoContato,
      setCorrigindo: setCorrigindoContato,
      aoCorrigir: ({ phone_number, email }: { phone_number: string; email: string }) => {
        setTelefoneDoLead(phone_number);
        setEmailDoLead(email);
        recarregarHistorico();
      },
    },
    juntar: { pode: podeJuntar, juntando, setJuntando },
    envio: { agendando: agendandoEnvio, setAgendando: setAgendandoEnvio },
  };
}

export type CardDoLead = ReturnType<typeof useCardDoLead>;
