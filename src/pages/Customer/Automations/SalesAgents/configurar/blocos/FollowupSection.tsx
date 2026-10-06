import { useEffect, useState } from 'react';
import { type SalesAgent, type SalesAgentFollowupChoice } from '@/services/salesAgents/salesAgentsService';
import { WeeklyWindowsEditor } from '@/components/schedule/WeeklyWindowsEditor';
import { type ScheduleWindow } from '@/components/schedule/scheduleWindows';
import { DEFAULT_FOLLOWUP_WINDOW, janelaDoFollowup } from '@/features/salesAgents/followupHours';
import { pipelinesService } from '@/services/pipelines/pipelinesService';
import { flowAutomationsService } from '@/services/flowAutomations/flowAutomationsService';
import { followupFlowOptions, legacySequenceNotice, type FollowupFlowOption } from '@/features/flowAutomations/followupOptions';
import { Seletor } from '@/components/base/Seletor';
import { type PipelineOpt, type StageOpt } from '../../configuracao/comum';

// Blocos do follow-up reaproveitados pelo passo 7 (configurar/passos/Passo7VoltarAChamar.tsx). Recebem o rascunho do passo: "onSave" aqui só muda o rascunho; quem grava é o Salvar do passo.

/**
 * DE QUAIS leads a IA vai atrás.
 *
 * O público é fixo e decidido pelo servidor (29/09/2026): só lead que ELA atendeu
 * e que ainda não foi para a roleta. É isso que faz o gatilho de ativação (o de
 * formulário, por exemplo) valer também no follow-up. Aqui a tela só DIZ isso;
 * o recorte que se escolhe é o por funil, por cima desse público.
 *
 * ⚠️ Nenhum funil marcado = TODOS os leads que ela atendeu. Por isso o aviso em
 * âmbar quando a pessoa escolhe "só destes funis" e não marca nenhum: sem ele,
 * ela sai da tela achando que recortou e a IA vai atrás de todo mundo, calada.
 */
export function FollowupPipelinesRow({
  agent, onSave,
}: {
  agent: SalesAgent;
  onSave: (patch: Partial<SalesAgent>) => void;
}) {
  const [pipelines, setPipelines] = useState<PipelineOpt[]>([]);
  const escolhidos = agent.followup_pipeline_ids ?? [];
  // O modo é derivado da lista, com estado local só para o instante entre marcar
  // "só destes funis" e marcar o primeiro funil — sem ele a lista de funis nem
  // chegaria a aparecer.
  const [abrindo, setAbrindo] = useState(false);
  const recortado = escolhidos.length > 0 || abrindo;

  useEffect(() => { setAbrindo(false); }, [agent.id]);

  useEffect(() => {
    pipelinesService.getPipelines()
      .then((res: unknown) => {
        const raw = (res as { data?: PipelineOpt[] }).data ?? (Array.isArray(res) ? (res as PipelineOpt[]) : []);
        setPipelines(raw.map((p) => ({ id: String(p.id), name: p.name })));
      })
      .catch(() => setPipelines([]));
  }, []);

  const marcar = (id: string, marcado: boolean) => {
    const proximo = marcado ? [...escolhidos, id] : escolhidos.filter((x) => x !== id);
    onSave({ followup_pipeline_ids: proximo });
  };

  const irParaTodos = () => { setAbrindo(false); if (escolhidos.length) onSave({ followup_pipeline_ids: [] }); };

  return (
    <div className="rounded-md border border-sidebar-border p-3">
      <div className="text-sm font-medium">De quais leads ela vai atrás</div>
      <div className="text-xs text-muted-foreground">
        Ela só vai atrás de quem ela mesma atendeu e que ainda não foi para a roleta.
        Lead de campanha que não ativa a IA (outro formulário, por exemplo) e lead já
        entregue a um corretor ficam de fora — e também aquele em que o corretor
        desligou a IA.
      </div>
      <div className="text-xs text-muted-foreground mt-1">
        Abaixo, dá para recortar ainda mais: ligar o follow-up só no funil que você
        quer — o de lançamento, por exemplo — e deixar os outros quietos.
      </div>

      <div className="mt-2 space-y-1">
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="radio"
            className="mt-1"
            name={`followup_escopo_${agent.id}`}
            checked={!recortado}
            onChange={irParaTodos}
          />
          <div>
            <div className="text-sm">Todos os leads que ela atendeu</div>
            <div className="text-xs text-muted-foreground">
              Qualquer lead que ela atendeu, que respondeu e sumiu, tendo card ou não.
            </div>
          </div>
        </label>

        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="radio"
            className="mt-1"
            name={`followup_escopo_${agent.id}`}
            checked={recortado}
            onChange={() => setAbrindo(true)}
          />
          <div>
            <div className="text-sm">Só os leads que estão nestes funis</div>
            <div className="text-xs text-muted-foreground">
              Lead sem card, ou com card em outro funil, fica de fora.
            </div>
          </div>
        </label>
      </div>

      {recortado && (
        <div className="mt-2 pl-6 space-y-1">
          {pipelines.length === 0 && (
            <div className="text-xs text-muted-foreground">Nenhum funil encontrado neste CRM.</div>
          )}
          {pipelines.map((p) => (
            <label key={p.id} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={escolhidos.includes(p.id)}
                onChange={(e) => marcar(p.id, e.target.checked)}
              />
              <span className="text-sm">{p.name}</span>
            </label>
          ))}

          {escolhidos.length === 0 && (
            <div className="rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-1 text-xs">
              Marque ao menos um funil. Sem nenhum marcado, ela continua indo atrás de
              todos os leads que ela atendeu.
            </div>
          )}

          {/* Card arquivado saiu do quadro por decisão de gente; o follow-up
              continuar por causa dele seria o card arquivado mandando mensagem. */}
          {escolhidos.length > 0 && (
            <div className="text-xs text-muted-foreground pt-1">
              Vale o funil em que o card do lead está hoje. Card arquivado não conta.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Quando a IA pode ir atrás de quem sumiu.
 *
 * NÃO tem chave de liga/desliga, de propósito: a faixa sempre existe. Um toggle
 * criaria um terceiro estado ("desligado = 24h? = padrão?") que é justamente o
 * que esta tela veio matar — antes o horário era fixo no servidor, ninguém
 * escolhia e ninguém via.
 */
export function FollowupHoursRow({
  agent, onSave,
}: {
  agent: SalesAgent;
  onSave: (patch: Partial<SalesAgent>) => void;
}) {
  const windows = janelaDoFollowup(agent);

  // `tz` sempre explícito: em branco, servidor e tela discordariam no dia em que
  // o padrão de um dos dois mudasse.
  const gravar = (next: ScheduleWindow[]) =>
    onSave({ followup_hours: { mode: 'custom', tz: 'America/Sao_Paulo', windows: next } });

  return (
    <div className="rounded-md border border-sidebar-border p-3">
      <div className="text-sm font-medium">Quando o follow-up pode sair</div>
      <div className="text-xs text-muted-foreground">
        É diferente do <em>Horário de atuação</em>, ali em cima: aquele é quando a IA responde
        quem escreve, este é quando ela vai atrás de quem sumiu. Responder de madrugada tudo bem —
        cutucar de madrugada, não.
      </div>

      <div className="mt-2">
        <button
          type="button"
          className="text-xs text-primary hover:underline"
          onClick={() => gravar([{ ...DEFAULT_FOLLOWUP_WINDOW }])}
        >
          Aplicar o padrão (09h às 17h, seg a sáb)
        </button>
      </div>

      {/* Mesmo editor do Horário de atuação e da Roleta — duas cópias da regra de
          dias e de janela que vira a meia-noite divergiriam em silêncio.
          ⚠️ idPrefix DIFERENTE de "ia_win": as duas seções vivem na mesma aba, e
          prefixo repetido faz o rótulo de uma focar o campo da outra. */}
      <WeeklyWindowsEditor value={windows} idPrefix="fu_win" onChange={gravar} />

      {/* Desde 06/10/2026 a IA só entrega o lead (não escreve mais o follow-up):
          este horário vale pra retomada e pra entrega, e as mensagens dali em
          diante seguem o horário do follow-up que recebe o lead. */}
      <p className="mt-2 text-xs text-muted-foreground">
        O horário acima decide <strong>quando a IA entrega o lead</strong>. As mensagens dali em
        diante saem no horário do <em>follow-up</em> que recebe o lead (a caixa <em>Só em horário
        comercial</em>, nas configurações dele em Automações → Follow-up).
      </p>
    </div>
  );
}

// As duas saídas do follow-up. Nas duas a IA só ENTREGA o lead: quem escreve as
// mensagens é o follow-up, com texto pronto.
//
// "A IA escreve a mensagem" ('ai') saiu em 06/10/2026 (decisão do dono do produto,
// spec 2026-10-06-follow-up-padrao): o problema era a qualidade do texto, não o
// custo. IA que ainda está em 'ai' não tem opção marcada e vê o aviso abaixo.
const FOLLOWUP_ACTIONS: [SalesAgentFollowupChoice, string, string][] = [
  ['pipeline', 'Mover o card para uma coluna',
   'A IA leva o card para a coluna que você escolher e sai de cena. Quem manda a mensagem é o follow-up que começa quando o card entra nessa coluna.'],
  ['sequence', 'Entregar pro follow-up',
   'A IA coloca o lead no follow-up escolhido, sem mexer no card. Todo cliente já tem o Follow-up padrão: 6 mensagens em 30 dias.'],
];

export function FollowupActionPicker({
  agent, onSave,
}: {
  agent: SalesAgent;
  onSave: (patch: Partial<SalesAgent>) => void;
}) {
  const [stages, setStages] = useState<StageOpt[]>([]);
  const [followups, setFollowups] = useState<FollowupFlowOption[]>([]);
  // Sem padrão de reserva: IA antiga em 'ai' (ou sem valor) fica sem opção marcada.
  const acao = agent.followup_action ?? null;
  const pipeline = agent.pipeline_id ?? '';

  // As colunas são as do funil já escolhido em "Mover o card no funil", logo
  // acima: um segundo seletor de funil aqui criaria duas verdades sobre onde a IA
  // age no quadro, e trocar uma sem a outra deixaria o card num funil e a coluna
  // no outro.
  useEffect(() => {
    if (acao !== 'pipeline' || !pipeline) { setStages([]); return; }
    pipelinesService.getPipelineStages(pipeline)
      .then((res: unknown) => {
        const raw = (res as { data?: StageOpt[] }).data ?? (Array.isArray(res) ? (res as StageOpt[]) : []);
        setStages(raw.map((st) => ({ id: String(st.id), name: st.name })));
      })
      .catch(() => setStages([]));
  }, [acao, pipeline]);

  // Sprint 3: a IA entrega pra um FLUXO de follow-up (aba Follow-up), não mais
  // pra um funil antigo.
  useEffect(() => {
    if (acao !== 'sequence') { setFollowups([]); return; }
    flowAutomationsService.list({ kind: 'followup' })
      .then((lista) => setFollowups(followupFlowOptions(lista)))
      .catch(() => setFollowups([]));
  }, [acao]);
  const avisoFunilAntigo = legacySequenceNotice(agent);

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium">Quando o lead sumir</div>
      {acao === 'ai' && (
        <p className="text-xs text-amber-600">Escolha como o follow-up continua: a IA não escreve mais o follow-up.</p>
      )}
      {FOLLOWUP_ACTIONS.map(([valor, titulo, ajuda]) => (
        <label key={valor} className="flex items-start gap-3 cursor-pointer">
          <input
            type="radio"
            className="mt-1"
            name={`followup_action_${agent.id}`}
            checked={acao === valor}
            onChange={() => onSave({ followup_action: valor })}
          />
          <div>
            <div className="text-sm">{titulo}</div>
            <div className="text-xs text-muted-foreground">{ajuda}</div>
          </div>
        </label>
      ))}

      {acao === 'pipeline' && (
        <div className="mt-2 space-y-2 pl-7">
          {!pipeline ? (
            <p className="text-xs text-amber-600">
              Escolha antes o funil em <strong>Mover o card no funil</strong>, logo acima — é dele que
              saem as colunas.
            </p>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div className="flex-1 text-sm">Coluna para o lead que sumiu</div>
                <Seletor
                  value={agent.followup_stage_id ?? ''}
                  onChange={(e) => onSave({ followup_stage_id: e.target.value || null })}
                  className="w-52 shrink-0 rounded-md border border-sidebar-border bg-background px-2 py-1 text-sm"
                >
                  <option value="">— escolha a coluna —</option>
                  {stages.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
                </Seletor>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 text-sm">Quando ele voltar a responder, o card vai para</div>
                <Seletor
                  value={agent.followup_return_stage_id ?? ''}
                  onChange={(e) => onSave({ followup_return_stage_id: e.target.value || null })}
                  className="w-52 shrink-0 rounded-md border border-sidebar-border bg-background px-2 py-1 text-sm"
                >
                  <option value="">Primeira coluna do funil (Novo)</option>
                  {stages.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
                </Seletor>
              </div>
              <p className="text-xs text-muted-foreground">
                Quem manda a mensagem é o follow-up que começa nessa coluna — em Automações →
                Follow-up, ele precisa ter o gatilho <em>Etapa alterada</em> pra essa coluna, senão o
                card muda de lugar e ninguém fala com o lead. A IA só empurra o card para a frente: card que o
                corretor já levou para uma coluna adiantada ela não puxa de volta.
              </p>
            </>
          )}
        </div>
      )}

      {acao === 'sequence' && (
        <div className="mt-2 space-y-2 pl-7">
          <div className="flex items-center gap-3">
            <div className="flex-1 text-sm">Qual follow-up</div>
            <Seletor
              value={agent.followup_flow_id ?? ''}
              onChange={(e) => onSave({ followup_flow_id: e.target.value || null })}
              className="w-52 shrink-0 rounded-md border border-sidebar-border bg-background px-2 py-1 text-sm"
              aria-label="Qual follow-up"
            >
              <option value="">— escolha o follow-up —</option>
              {agent.followup_flow_id && !followups.some((f) => f.value === agent.followup_flow_id) && (
                <option value={agent.followup_flow_id}>Follow-up que não existe mais</option>
              )}
              {followups.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </Seletor>
          </div>
          {avisoFunilAntigo && <p className="text-xs text-amber-600">{avisoFunilAntigo}</p>}
          <p className="text-xs text-muted-foreground">
            Os follow-ups ficam em Automações → Follow-up. Desligado, ele não recebe o lead. O card
            não é movido neste modo — se você usa o quadro, prefira a opção de cima, que também
            deixa o lead sumido visível numa coluna.
          </p>
        </div>
      )}
    </div>
  );
}
