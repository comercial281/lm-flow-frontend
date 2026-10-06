// IA Vendedora — a casca (entrega 1 da refatoração, 05/10/2026).
//
// Barra de topo (`IaBarra`) com o seletor da IA, o selo do veredito e os menus
// Painel ▾ · Configurar · Ensinar · Testar · Diagnóstico, no modelo do Meu site.
// O endereço diz a IA e a tela (`?ia=<id>&tela=<id>`), com `replace`: o Voltar
// do navegador sai da página em vez de percorrer as telas. Cada tela mora em
// `telas/`; a configuração de sempre mora em `configuracao/legado/` até a
// entrega 2. Spec: LM FLOW/specs/2026-10-05-ia-vendedora-refatoracao-design.md.
//
// ⚠️ Nada aqui muda o atendimento: os campos e a gravação (`saveAgent`) são os
// de antes, linha por linha.
import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/ds';
import { toast } from 'sonner';
import { Loader2, Plus } from 'lucide-react';
import DuplicateAgentDialog from '@/components/salesAgents/DuplicateAgentDialog';
import { salesAgentsService, type HealthReport, type SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { useClientToggle } from '@/contexts/TenantFeaturesContext';
import { useIsSuperAdmin } from '@/hooks/useIsSuperAdmin';
import NoAccessState from '@/components/permissions/NoAccessState';
import { classifyLoadFailure, type LoadFailure } from '@/services/core/forbidden';
import { useCan } from '@/hooks/useCan';
import inboxesService from '@/services/channels/inboxesService';
import { formIdsDropped } from '@/features/salesAgents/formTrigger';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import {
  iaDaUrl, iaInicial, paramsDaIa, telaDaUrl, telaInfo, trilhaDe, type TelaId,
} from '@/features/salesAgents/iaMenu';
import { situacaoDaIa } from '@/features/salesAgents/situacao';
import { type InboxOption } from './configuracao/comum';
import IaBarra from './IaBarra';
import TelaVisaoGeral from './telas/TelaVisaoGeral';
import TelaSugestoes from './telas/TelaSugestoes';
import TelaRelatorioSemanal from './telas/TelaRelatorioSemanal';
import TelaConfigurar from './telas/TelaConfigurar';
import TelaEnsinar from './telas/TelaEnsinar';
import TelaTestar from './telas/TelaTestar';
import TelaDiagnostico from './telas/TelaDiagnostico';

// A última IA aberta neste navegador: com várias IAs, `/ia-vendedora` abre nela.
// Conveniência, não dado: storage bloqueado (aba anônima) só faz abrir a primeira.
const ULTIMA_IA = 'lmflow:ia-vendedora:ultima';
const lerUltimaIa = (): string | null => {
  try { return localStorage.getItem(ULTIMA_IA); } catch { return null; }
};
const gravarUltimaIa = (id: string) => {
  try { localStorage.setItem(ULTIMA_IA, id); } catch { /* storage bloqueado: segue sem lembrar */ }
};

export default function SalesAgents() {
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const [agents, setAgents] = useState<SalesAgent[]>([]);
  const [selected, setSelected] = useState<SalesAgent | null>(null);
  const [inboxes, setInboxes] = useState<InboxOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [duplicating, setDuplicating] = useState<SalesAgent | null>(null);
  const [loadFailure, setLoadFailure] = useState<LoadFailure | null>(null);
  const [diagnostico, setDiagnostico] = useState<{ id: string; report: HealthReport } | null>(null);
  const [conferindo, setConferindo] = useState(false);
  // Id da IA cuja leitura do Diagnóstico falhou (502, perfil sem a permissão…).
  const [diagnosticoFalhou, setDiagnosticoFalhou] = useState<string | null>(null);
  const pode = useCan();
  // ⚠️ A chave vai LITERAL aqui. Os dois scanners do catálogo de funcionalidades
  // (sync e audit) leem o código por regex: trocar o literal por uma constante
  // tira a chave do catálogo no deploy seguinte, o painel de Funções deixa de
  // oferecer o botão de liberar, e ninguém é avisado.
  // `isSuper ||`: a Leal Mídia sempre vê, como a aba de Landings.
  const isSuper = useIsSuperAdmin();
  const insightsToggle = useClientToggle('ia_insights');
  const insightsLiberado = isSuper || insightsToggle;

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // Sugestões e Relatório semanal sem a chave caem na Visão geral (`telaDaUrl`):
  // o gate fica no menu e no endereço, como as Páginas de anúncio do Meu site.
  const tela = telaDaUrl(searchParams, { insights: insightsLiberado });
  const iaPedida = iaDaUrl(searchParams);

  const loadAgents = useCallback(async () => {
    setLoading(true);
    setLoadFailure(null);
    try {
      const list = await salesAgentsService.list();
      setAgents(list);
      setSelected((prev) => (prev ? list.find((a) => a.id === prev.id) ?? null : null));
    } catch (e) {
      const kind = classifyLoadFailure(e);
      setLoadFailure(kind);
      if (kind === 'failed') toast.error('Erro ao carregar os agentes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAgents();
    inboxesService
      .list()
      .then((res) => {
        const data = ((res as unknown as { data?: InboxOption[] }).data) ?? [];
        setInboxes(data.map((i) => ({ id: i.id, name: i.name })));
      })
      .catch(() => setInboxes([]));
  }, [loadAgents]);

  // Endereço → IA aberta. Resolve a IA (a do endereço, a última usada ou a
  // primeira), reescreve o endereço no formato certo (inclusive o `?agent=` que o
  // assistente ainda usa pra devolver) e lembra a escolha.
  useEffect(() => {
    if (loading) return;
    const alvo = iaInicial(agents.map((a) => a.id), iaPedida, lerUltimaIa());
    // O passo do passo a passo atravessa a normalização (só vale em Configurar).
    const certo = paramsDaIa(alvo, tela, searchParams.get('passo'));
    if (searchParams.toString() !== new URLSearchParams(certo).toString()) setSearchParams(certo, { replace: true });
    if (alvo) gravarUltimaIa(alvo);
    setSelected((prev) => (prev?.id === alvo ? prev : agents.find((a) => a.id === alvo) ?? null));
  }, [loading, agents, iaPedida, tela, searchParams, setSearchParams]);

  // O Diagnóstico da IA aberta alimenta o selo e as pendências. Relido quando a
  // IA muda ou é salva (`updated_at`), nunca a cada tecla. Falha não grita: o
  // selo cai no que a própria configuração diz.
  const selId = selected?.id;
  const selUpdatedAt = selected?.updated_at;
  useEffect(() => {
    if (!selId) {
      setDiagnostico(null);
      return;
    }
    let vivo = true;
    setConferindo(true);
    setDiagnosticoFalhou(null);
    salesAgentsService
      .diagnostics(selId)
      .then((d) => { if (vivo) setDiagnostico({ id: selId, report: d }); })
      .catch(() => { if (vivo) { setDiagnostico(null); setDiagnosticoFalhou(selId); } })
      .finally(() => { if (vivo) setConferindo(false); });
    return () => { vivo = false; };
  }, [selId, selUpdatedAt]);

  const irPara = useCallback((t: TelaId, passo?: number) => {
    setSearchParams(paramsDaIa(selected?.id ?? null, t, passo), { replace: true });
  }, [selected?.id, setSearchParams]);

  // O que um passo (ou o Ensinar) salvou: atualiza a IA aberta E a lista do seletor.
  const aoSalvo = useCallback((a: SalesAgent) => {
    setSelected(a);
    setAgents((prev) => prev.map((x) => (x.id === a.id ? a : x)));
  }, []);

  const trocarIa = useCallback((id: string) => {
    setSearchParams(paramsDaIa(id, tela), { replace: true });
  }, [tela, setSearchParams]);

  // Cria a IA (desligada) e abre o assistente em tela cheia. Quem preferir
  // configurar na mão sai por "Configurar depois" lá dentro e volta para cá com a
  // IA nova selecionada (`?agent=`) — a IA existe nos dois caminhos.
  const createAgent = async () => {
    try {
      const agent = await salesAgentsService.create({
        name: 'Nova IA Vendedora',
        mode: 'seller',
        enabled: false,
        qualification_questions: ['Orçamento', 'Prazo de compra', 'Região de interesse', 'Precisa de financiamento'],
      });
      navigate(`/ia-vendedora/${agent.id}/assistente`);
    } catch {
      toast.error('Erro ao criar o agente');
    }
  };

  const saveAgent = async (patch: Partial<SalesAgent>) => {
    if (!selected) return;
    setSaving(true);
    try {
      const updated = await salesAgentsService.update(selected.id, {
        name: patch.name ?? selected.name,
        enabled: patch.enabled ?? selected.enabled,
        mode: patch.mode ?? selected.mode,
        persona_role: patch.persona_role ?? selected.persona_role,
        persona_goal: patch.persona_goal ?? selected.persona_goal,
        instructions: patch.instructions ?? selected.instructions,
        greeting: patch.greeting ?? selected.greeting,
        handoff_message: patch.handoff_message ?? selected.handoff_message,
        qualification_questions: patch.qualification_questions ?? selected.qualification_questions,
        inbox_id: patch.inbox_id ?? selected.inbox_id,
        trigger_keyword: patch.trigger_keyword ?? selected.trigger_keyword,
        triggers: patch.triggers ?? selected.triggers,
        trigger_match_mode: patch.trigger_match_mode ?? selected.trigger_match_mode,
        bant_config: patch.bant_config ?? selected.bant_config,
        usage_limits: patch.usage_limits ?? selected.usage_limits,
        model: patch.model ?? selected.model,
        temperature: patch.temperature ?? selected.temperature,
        max_context_tokens: patch.max_context_tokens ?? selected.max_context_tokens,
        active_hours: patch.active_hours ?? selected.active_hours,
        followup_enabled: patch.followup_enabled ?? selected.followup_enabled,
        followup_only: patch.followup_only ?? selected.followup_only,
        followup_min_days: patch.followup_min_days ?? selected.followup_min_days,
        followup_max_days: patch.followup_max_days ?? selected.followup_max_days,
        followup_max_attempts: patch.followup_max_attempts ?? selected.followup_max_attempts,
        // As colunas e o funil entram com `in`, e não com `??`: limpar a escolha
        // manda `null`, e o `??` trocaria o null pelo valor antigo — a tela
        // mostraria "não escolhido" e o servidor continuaria com a coluna velha.
        followup_action: patch.followup_action ?? selected.followup_action,
        followup_stage_id: 'followup_stage_id' in patch ? patch.followup_stage_id : selected.followup_stage_id,
        followup_return_stage_id:
          'followup_return_stage_id' in patch ? patch.followup_return_stage_id : selected.followup_return_stage_id,
        followup_sequence_slug:
          'followup_sequence_slug' in patch ? patch.followup_sequence_slug : selected.followup_sequence_slug,
        // Sprint 3: o fluxo de follow-up. `in` pelo mesmo motivo (limpar manda null).
        followup_flow_id: 'followup_flow_id' in patch ? patch.followup_flow_id : selected.followup_flow_id,
        followup_drip_enabled: patch.followup_drip_enabled ?? selected.followup_drip_enabled,
        followup_drip_min_leads: patch.followup_drip_min_leads ?? selected.followup_drip_min_leads,
        followup_drip_max_leads: patch.followup_drip_max_leads ?? selected.followup_drip_max_leads,
        followup_drip_min_minutes: patch.followup_drip_min_minutes ?? selected.followup_drip_min_minutes,
        followup_drip_max_minutes: patch.followup_drip_max_minutes ?? selected.followup_drip_max_minutes,
        // DE QUAIS leads ela vai atrás. Entra com `??` e não com `in`: lista vazia
        // não é null — é a escolha "todos os leads que ela atendeu", que o `??`
        // preserva. (Diferente das colunas do bloco de cima, onde `null` significa
        // "não escolhi coluna nenhuma".)
        followup_pipeline_ids: patch.followup_pipeline_ids ?? selected.followup_pipeline_ids,
        // Reengajamento. Com `??`: nenhum dos três é limpável (a chave é booleana e
        // as horas voltam sempre resolvidas do servidor). Fora desta lista, a tela
        // diria "Salvo" e o servidor nunca receberia — armadilha nº 1 do follow-up.
        reengagement_enabled: patch.reengagement_enabled ?? selected.reengagement_enabled,
        reengagement_first_hours: patch.reengagement_first_hours ?? selected.reengagement_first_hours,
        reengagement_second_hours: patch.reengagement_second_hours ?? selected.reengagement_second_hours,
        // PARA ONDE ela entrega o lead. O modo entra com `??` (ele nunca é
        // limpável — o servidor devolve sempre um dos três); os dois ALVOS
        // entram com `in`, porque `null` ali é escolha legítima: voltar para "a
        // roleta do número" limpa o alvo do modo anterior, e o `??` devolveria a
        // roleta velha por baixo — a tela mostrando uma coisa e o servidor
        // entregando o lead noutra.
        handoff_target: patch.handoff_target ?? selected.handoff_target,
        handoff_roleta_config_id:
          'handoff_roleta_config_id' in patch ? patch.handoff_roleta_config_id : selected.handoff_roleta_config_id,
        handoff_user_id: 'handoff_user_id' in patch ? patch.handoff_user_id : selected.handoff_user_id,
        // O horário próprio do follow-up. Entra com `??` e não com `in`: ele nunca
        // é limpável — o servidor devolve sempre resolvido e o editor garante ao
        // menos uma janela. Vazio aqui não é escolha, é o padrão de fábrica.
        followup_hours: patch.followup_hours ?? selected.followup_hours,
        audio_enabled: patch.audio_enabled ?? selected.audio_enabled,
        audio_mode: patch.audio_mode ?? selected.audio_mode,
        audio_voice_id: patch.audio_voice_id ?? selected.audio_voice_id,
        sales_method: patch.sales_method ?? selected.sales_method,
        social_proof: patch.social_proof ?? selected.social_proof,
        booking_enabled: patch.booking_enabled ?? selected.booking_enabled,
        visit_duration_minutes: patch.visit_duration_minutes ?? selected.visit_duration_minutes,
        example_conversations: patch.example_conversations ?? selected.example_conversations,
        locacao_enabled: patch.locacao_enabled ?? selected.locacao_enabled,
        escalate_on_frustration: patch.escalate_on_frustration ?? selected.escalate_on_frustration,
        escalate_on_human_request: patch.escalate_on_human_request ?? selected.escalate_on_human_request,
        escalate_on_ai_detected: patch.escalate_on_ai_detected ?? selected.escalate_on_ai_detected,
        ai_limits: patch.ai_limits ?? selected.ai_limits,
        crm_policy: patch.crm_policy ?? selected.crm_policy,
        transfer_config: patch.transfer_config ?? selected.transfer_config,
        ask_google_review: patch.ask_google_review ?? selected.ask_google_review,
        google_review_link: patch.google_review_link ?? selected.google_review_link,
        cross_sell_enabled: patch.cross_sell_enabled ?? selected.cross_sell_enabled,
        rich_media_enabled: patch.rich_media_enabled ?? selected.rich_media_enabled,
        visit_config: patch.visit_config ?? selected.visit_config,
        default_property_code: patch.default_property_code ?? selected.default_property_code,
        reply_delay_seconds: patch.reply_delay_seconds ?? selected.reply_delay_seconds,
        default_origin: patch.default_origin ?? selected.default_origin,
        intent_question: patch.intent_question ?? selected.intent_question,
        // ⚠️ Entra com `in`, NÃO com `??`: apagar um bloco do roteiro manda `{}`
        // (ou o objeto sem aquela chave), e o `??` só troca `null`/`undefined` —
        // mas um objeto vazio é escolha LEGÍTIMA aqui: significa "voltei tudo pro
        // padrão de fábrica". Com `??` funcionaria por acaso hoje e quebraria no
        // dia em que alguém mandasse `null` pra limpar. Mesmo cuidado do
        // `pipeline_stage_map` e das colunas do follow-up.
        playbook: 'playbook' in patch ? patch.playbook : selected.playbook,
        opening_image_url: patch.opening_image_url ?? selected.opening_image_url,
        opening_audio_url: patch.opening_audio_url ?? selected.opening_audio_url,
        openings: patch.openings ?? selected.openings,
        priority: patch.priority ?? selected.priority,
        out_of_hours_reply: patch.out_of_hours_reply ?? selected.out_of_hours_reply,
        catalog_search_enabled: patch.catalog_search_enabled ?? selected.catalog_search_enabled,
        // ⚠️ Campo novo PRECISA entrar nesta lista. Ela monta o PATCH campo a
        // campo, e o que não estiver aqui é descartado sem erro nenhum: a tela
        // mostra o valor, o toast diz "Salvo", e nada foi salvo.
        message_split_enabled: patch.message_split_enabled ?? selected.message_split_enabled,
        message_split_max_parts: patch.message_split_max_parts ?? selected.message_split_max_parts,
        pipeline_move_enabled: patch.pipeline_move_enabled ?? selected.pipeline_move_enabled,
        pipeline_id: patch.pipeline_id ?? selected.pipeline_id,
        // A curtida ESTREOU sem estas três linhas, e foi exatamente o defeito que o
        // aviso acima descreve: a chave ficava imóvel na tela e o toast dizia "Salvo".
        // `??` serve para as três — lista vazia e zero não são nulos, então
        // "desmarquei todos os emojis" e "teto zero" chegam ao servidor como escolha.
        reaction_enabled: patch.reaction_enabled ?? selected.reaction_enabled,
        reaction_emojis: patch.reaction_emojis ?? selected.reaction_emojis,
        reaction_max_per_conversation: patch.reaction_max_per_conversation ?? selected.reaction_max_per_conversation,
        // `in` e não `??`: o mapa vazio ({}) é uma escolha legítima ("tirei todas
        // as colunas"), e `??` só trata null/undefined — mas a etapa REMOVIDA some
        // do objeto, então mandar o mapa antigo aqui ressuscitaria a coluna que o
        // gestor acabou de tirar.
        pipeline_stage_map: 'pipeline_stage_map' in patch ? patch.pipeline_stage_map : selected.pipeline_stage_map,
        // `in` e não `??`: aqui null quer dizer "apagar o texto e voltar pro
        // automático", e `??` trataria isso como "não mexeu", tornando o campo
        // impossível de limpar depois de preenchido uma vez.
        out_of_hours_message: 'out_of_hours_message' in patch ? patch.out_of_hours_message : selected.out_of_hours_message,
      });
      setSelected(updated);
      setAgents((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      if (patch.triggers && formIdsDropped(patch.triggers, updated.triggers)) {
        toast.error('O servidor não guardou os formulários marcados — ele ainda está numa versão sem este gatilho. Avise o suporte.');
        return;
      }
      toast.success('Salvo');
    } catch (e) {
      // O servidor sabe explicar (ex.: bloco do roteiro com marcador que ele não
      // recebe). Os dois formatos de erro da API, e o de validação do modelo.
      const r = (e as { response?: { data?: { error?: unknown; message?: string; errors?: unknown } } }).response?.data;
      const detalhe =
        (typeof r?.error === 'object' && (r.error as { message?: string })?.message) ||
        (typeof r?.error === 'string' ? r.error : null) ||
        (Array.isArray(r?.errors) ? (r.errors as unknown[]).map(String).join(' ') : null) ||
        r?.message;
      toast.error(detalhe ? `Não salvou: ${detalhe}` : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const deleteAgent = async (agent: SalesAgent) => {
    if (!(await confirmar({
      titulo: 'Excluir IA',
      descricao: <>Excluir a IA <strong>{agent.name}</strong>?</>,
      rotuloDaAcao: 'Excluir',
      destrutivo: true,
    }))) return;
    try {
      await salesAgentsService.destroy(agent.id);
      toast.success('Excluído');
      if (selected?.id === agent.id) setSelected(null);
      await loadAgents();
    } catch {
      toast.error('Erro ao excluir');
    }
  };

  // Recusa do servidor NÃO é "nenhuma IA criada" — era assim que o gestor sem
  // a permissão criava uma IA duplicada.
  if (loadFailure === 'forbidden') return <NoAccessState />;

  const podeCriar = pode('sales_agents', 'create');
  // ⚠️ O relatório é de UMA IA: ao trocar A→B, o de A não vale pra B (o selo
  // mentiria até o de B chegar). Só relido por `updated_at` mantém, sem piscar.
  const diagnosticoDaIa = selected && diagnostico?.id === selected.id ? diagnostico.report : null;
  const situacao = selected ? situacaoDaIa(selected, diagnosticoDaIa) : null;
  const info = telaInfo(tela);
  const trilha = trilhaDe(tela);

  return (
    <>
      <div className="flex min-h-full flex-col">
        <IaBarra
          agents={agents}
          selecionada={selected}
          situacao={situacao}
          tela={tela}
          insights={insightsLiberado}
          podeCriar={podeCriar}
          podeExcluir={pode('sales_agents', 'delete')}
          aoIr={irPara}
          aoTrocarIa={trocarIa}
          aoCriar={createAgent}
          aoDuplicar={() => selected && setDuplicating(selected)}
          aoExcluir={() => selected && void deleteAgent(selected)}
        />
        <div className="w-full space-y-5 px-6 py-6">
          {loading && agents.length === 0 ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : !selected || !situacao ? (
            <div className="flex flex-col items-start gap-3 rounded-lg border border-sidebar-border bg-sidebar p-6">
              <p className="text-sm text-muted-foreground">Nenhuma IA Vendedora criada ainda.</p>
              {podeCriar && (
                <Button onClick={createAgent}>
                  <Plus className="mr-1 h-4 w-4" aria-hidden /> Nova IA
                </Button>
              )}
            </div>
          ) : (
            // ⚠️ `key` = id da IA: trocar de IA remonta a tela inteira. Sem isso o
            // Testar levava a conversa da IA anterior (e a próxima mensagem iria
            // pra nova com o histórico da outra), a Visão geral mostrava os
            // números dela e Sugestões seguia lendo a análise dela.
            <div key={selected.id} className={tela === 'visao-geral' ? 'max-w-5xl space-y-5' : 'max-w-3xl space-y-5'}>
              <div className="space-y-1">
                {trilha && <p className="text-xs font-medium text-muted-foreground">{trilha}</p>}
                <h1 className="text-2xl font-semibold">{info.titulo}</h1>
                <p className="text-sm text-muted-foreground">{info.frase}</p>
              </div>
              {tela === 'visao-geral' && (
                <TelaVisaoGeral
                  agent={selected}
                  situacao={situacao}
                  diagnostico={diagnosticoDaIa}
                  conferindo={conferindo}
                  falhou={diagnosticoFalhou === selected.id}
                  mostrarSugestoes={insightsLiberado}
                  aoIr={irPara}
                />
              )}
              {tela === 'sugestoes' && insightsLiberado && <TelaSugestoes agent={selected} />}
              {tela === 'relatorio-semanal' && insightsLiberado && <TelaRelatorioSemanal />}
              {tela === 'configurar' && (
                <TelaConfigurar agent={selected} inboxes={inboxes} aoSalvo={aoSalvo} />
              )}
              {tela === 'ensinar' && <TelaEnsinar agent={selected} onCountChange={loadAgents} />}
              {tela === 'testar' && <TelaTestar agent={selected} />}
              {tela === 'diagnostico' && <TelaDiagnostico agent={selected} />}
            </div>
          )}
        </div>
      </div>
      {dialogoDeConfirmacao}
      {duplicating && (
        <DuplicateAgentDialog
          agent={duplicating}
          inboxes={inboxes}
          onClose={() => setDuplicating(null)}
          onDuplicated={(copy) => {
            // A cópia vira a IA aberta, em Configurar: é lá que se confere antes
            // de ligar.
            // ⚠️ A cópia entra na lista ANTES de o endereço apontar pra ela: sem
            // isso a resolução do endereço não acha o id e volta pra IA original.
            setDuplicating(null);
            // ...e vira a `selected` já: `loadAgents` abaixo liga o loading e a
            // resolução do endereço fica parada — sem isto, Configurar mostraria
            // (e salvaria em) a IA ORIGINAL enquanto o endereço aponta pra cópia.
            setAgents((prev) => [...prev.filter((a) => a.id !== copy.id), copy]);
            setSelected(copy);
            setSearchParams(paramsDaIa(copy.id, 'configurar'), { replace: true });
            loadAgents();
          }}
        />
      )}
    </>
  );
}
