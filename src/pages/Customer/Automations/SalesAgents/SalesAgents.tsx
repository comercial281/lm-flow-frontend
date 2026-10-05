import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Input } from '@/components/ui/ds';
import { toast } from 'sonner';
import { Bot, Plus, Trash2, Loader2, Copy, AlertTriangle } from 'lucide-react';
import DuplicateAgentDialog from '@/components/salesAgents/DuplicateAgentDialog';
import { salesAgentsService, type SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { useClientToggle } from '@/contexts/TenantFeaturesContext';
import { useIsSuperAdmin } from '@/hooks/useIsSuperAdmin';
import NoAccessState from '@/components/permissions/NoAccessState';
import { classifyLoadFailure, type LoadFailure } from '@/services/core/forbidden';
import { useCan } from '@/hooks/useCan';
import inboxesService from '@/services/channels/inboxesService';
import { formIdsDropped } from '@/features/salesAgents/formTrigger';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { type InboxOption } from './configuracao/comum';
import ConfigLegado, { MODE_LABELS } from './configuracao/legado/ConfigLegado';
import { KnowledgeTab } from './telas/ensinar/BaseDeConhecimento';
import { LearningTab } from './telas/ensinar/Aprendizado';
import { TestTab } from './telas/TelaTestar';
import TelaSugestoes from './telas/TelaSugestoes';
import TelaRelatorioSemanal from './telas/TelaRelatorioSemanal';
import TelaDiagnostico from './telas/TelaDiagnostico';
import { ResultsTab } from './telas/TelaVisaoGeral';
type Tab = 'config' | 'resultados' | 'sugestoes' | 'relatorios' | 'knowledge' | 'learning' | 'test' | 'diagnostico';

export default function SalesAgents() {
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const [agents, setAgents] = useState<SalesAgent[]>([]);
  const [selected, setSelected] = useState<SalesAgent | null>(null);
  const [inboxes, setInboxes] = useState<InboxOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<Tab>('config');
  const [duplicating, setDuplicating] = useState<SalesAgent | null>(null);
  const [loadFailure, setLoadFailure] = useState<LoadFailure | null>(null);
  const pode = useCan();
  // ⚠️ A chave vai LITERAL aqui. Os dois scanners do catálogo de funcionalidades
  // (sync e audit) leem o código por regex: trocar o literal por uma constante
  // tira a chave do catálogo no deploy seguinte, o painel de Funções deixa de
  // oferecer o botão de liberar, e ninguém é avisado.
  // `isSuper ||`: a Leal Mídia sempre vê, como a aba de Landings. Sem isso a chave
  // escondia as abas até de quem libera — o comentário dizia o contrário do código.
  const isSuper = useIsSuperAdmin();
  const insightsToggle = useClientToggle('ia_insights');
  const insightsLiberado = isSuper || insightsToggle;

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const loadAgents = useCallback(async () => {
    setLoading(true);
    setLoadFailure(null);
    try {
      const list = await salesAgentsService.list();
      setAgents(list);
      // `?agent=<id>` é como o assistente (tela cheia, rota própria) devolve a
      // pessoa para a IA certa: as abas daqui são estado local, sem endereço.
      // Lido uma vez e apagado da URL, senão o Voltar do navegador reabre a IA.
      const wanted = searchParams.get('agent');
      setSelected((prev) => {
        if (wanted) return list.find((a) => a.id === wanted) ?? prev ?? null;
        return prev ? list.find((a) => a.id === prev.id) ?? null : null;
      });
      if (wanted) setSearchParams({}, { replace: true });
    } catch (e) {
      const kind = classifyLoadFailure(e);
      setLoadFailure(kind);
      if (kind === 'failed') toast.error('Erro ao carregar os agentes');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- searchParams é lido só no mount
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

  // Cria a IA (desligada) e abre o assistente em tela cheia. Quem preferir
  // configurar na mão sai por "Configurar depois" lá dentro e volta para cá com a
  // IA nova selecionada — a IA existe nos dois caminhos.
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

  return (
    <>
    <div className="flex h-full">
      {/* Lista */}
      <aside className="w-72 shrink-0 border-r border-sidebar-border p-4 overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div
              className="w-1 h-6 rounded-full shrink-0"
              style={{ background: 'linear-gradient(to bottom, #7c3aed, #9333ea)' }}
            />
            <h2 className="text-base font-bold flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" /> IA Vendedora
            </h2>
          </div>
          {pode('sales_agents', 'create') && (
            <Button size="sm" onClick={createAgent} aria-label="Criar IA Vendedora" title="Criar IA Vendedora">
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : agents.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma IA criada. Clique em + para começar.</p>
        ) : (
          <ul className="space-y-1">
            {agents.map((a) => (
              <li key={a.id}>
                <button
                  onClick={() => { setSelected(a); setTab('config'); }}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    selected?.id === a.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-sidebar-accent'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate">{a.name}</span>
                    <span className={`ml-2 h-2 w-2 rounded-full shrink-0 ${a.enabled ? 'bg-green-500' : 'bg-gray-300'}`} />
                  </div>
                  <span className="text-xs text-muted-foreground">{MODE_LABELS[a.mode]}</span>
                  {/* Ligada e sem canal = nunca responde. A seleção do agente filtra
                      por inbox, então agente sem inbox_id não é candidato a nada.
                      Antes isso era silencioso: a IA parecia configurada e não era. */}
                  {a.enabled && !a.inbox_id && (
                    <span className="mt-1 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-500">
                      <AlertTriangle className="h-3 w-3 shrink-0" /> sem canal
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      {/* Editor */}
      <main className="flex-1 min-w-0 overflow-auto p-6">
        {!selected ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            Selecione ou crie uma IA Vendedora.
          </div>
        ) : (
          <div className="max-w-3xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Input
                  value={selected.name}
                  onChange={(e) => setSelected({ ...selected, name: e.target.value })}
                  onBlur={() => saveAgent({ name: selected.name })}
                  className="text-lg font-semibold w-64"
                />
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.enabled}
                    onChange={(e) => saveAgent({ enabled: e.target.checked })}
                  />
                  {selected.enabled ? 'Ativa' : 'Desativada'}
                </label>
              </div>
              <div className="flex items-center gap-1">
                {pode('sales_agents', 'create') && (
                  <Button variant="ghost" size="sm" onClick={() => setDuplicating(selected)} title="Duplicar esta IA">
                    <Copy className="h-4 w-4 mr-1" /> Duplicar
                  </Button>
                )}
                {pode('sales_agents', 'delete') && (
                  <Button variant="ghost" size="sm" onClick={() => deleteAgent(selected)} aria-label="Excluir IA Vendedora" title="Excluir IA Vendedora">
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                )}
              </div>
            </div>

            {/* Abas */}
            <div className="flex gap-1 border-b border-sidebar-border mb-4">
              {(([
                ['config', 'Configuração'],
                ['resultados', 'Resultados'],
                // As duas abaixo são liberadas imobiliária por imobiliária. O gate
                // fica na ABA, nunca na rota — quem digitar o endereço chega na
                // tela, que é o padrão da casa (ver /bolsao e as Landings).
                ...(insightsLiberado ? ([['sugestoes', 'Sugestões'], ['relatorios', 'Relatórios']] as [Tab, string][]) : []),
                ['knowledge', 'Base de Conhecimento'],
                ['learning', 'Aprendizado'],
                ['test', 'Testar'],
                ['diagnostico', 'Diagnóstico'],
              ] as [Tab, string][])).map(
                ([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    className={`px-4 py-2 text-sm border-b-2 -mb-px transition-colors ${
                      tab === key ? 'border-primary text-primary font-medium' : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {label}
                  </button>
                ),
              )}
            </div>

            {tab === 'config' && (
              <ConfigLegado agent={selected} inboxes={inboxes} saving={saving} onChange={setSelected} onSave={saveAgent} />
            )}
            {tab === 'resultados' && <ResultsTab agent={selected} />}
            {tab === 'sugestoes' && insightsLiberado && <TelaSugestoes agent={selected} />}
            {tab === 'relatorios' && insightsLiberado && <TelaRelatorioSemanal />}
            {tab === 'knowledge' && <KnowledgeTab agent={selected} onCountChange={loadAgents} />}
            {tab === 'learning' && <LearningTab agent={selected} />}
            {tab === 'test' && <TestTab agent={selected} />}
            {tab === 'diagnostico' && <TelaDiagnostico agent={selected} />}
          </div>
        )}
      </main>
    </div>
      {dialogoDeConfirmacao}
      {duplicating && (
        <DuplicateAgentDialog
          agent={duplicating}
          inboxes={inboxes}
          onClose={() => setDuplicating(null)}
          onDuplicated={(copy) => {
            // A cópia vira a IA selecionada, na aba de configuração: é lá que se
            // confere antes de ligar. O loadAgents mantém a seleção pelo id.
            setDuplicating(null);
            setSelected(copy);
            setTab('config');
            loadAgents();
          }}
        />
      )}
    </>
  );
}
