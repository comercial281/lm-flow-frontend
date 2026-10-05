import { useEffect, useState } from 'react';
import { Input, Label } from '@/components/ui/ds';
import { REENGAGEMENT_DEFAULT_FIRST_HOURS, REENGAGEMENT_DEFAULT_SECOND_HOURS, clampReengagementHours } from '../../reengagementHours';
import { type SalesAgent, type SalesAgentFollowupAction } from '@/services/salesAgents/salesAgentsService';
import { WeeklyWindowsEditor } from '@/components/schedule/WeeklyWindowsEditor';
import { type ScheduleWindow } from '@/components/schedule/scheduleWindows';
import { DEFAULT_FOLLOWUP_WINDOW, estimativaPorDia, janelaDoFollowup, minutosPorDia, resumoDaJanela } from '@/features/salesAgents/followupHours';
import { pipelinesService } from '@/services/pipelines/pipelinesService';
import { flowAutomationsService } from '@/services/flowAutomations/flowAutomationsService';
import { followupFlowOptions, legacySequenceNotice, type FollowupFlowOption } from '@/features/flowAutomations/followupOptions';
import { Seletor } from '@/components/base/Seletor';
import { type PipelineOpt, type StageOpt, Toggle } from '../comum';

// ---------------- Follow-up automático ----------------

export function FollowupSection({
  agent, onChange, onSave,
}: {
  agent: SalesAgent;
  onChange: (a: SalesAgent) => void;
  onSave: (patch: Partial<SalesAgent>) => void;
}) {
  const on = agent.followup_enabled;
  return (
    <div className="pt-2 border-t border-sidebar-border">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Follow-up automático</div>
          <div className="text-xs text-muted-foreground">
            Se o lead sumir, a IA volta sozinha na cadência que você definir. Infinito por padrão. Desligado = não dispara nada.
          </div>
          {/* Os dois follow-ups do produto NÃO se sobrepõem, e a diferença nunca
              esteve escrita em lugar nenhum: aqui só entra quem já respondeu
              alguma vez (sem mensagem do lead não há o que reengajar); quem nunca
              respondeu é do Robô Sem Resposta, em Automações. */}
          <div className="text-xs text-muted-foreground mt-1">
            Pega <strong>quem já respondeu alguma vez e depois sumiu</strong>. Quem nunca
            respondeu nenhuma vez é do <em>Robô Sem Resposta</em>, em Automações.
          </div>
        </div>
        <Toggle on={!!on} onChange={(v) => onSave({ followup_enabled: v })} rotulo="follow-up automático" />
      </div>

      {on && (
        <div className="mt-3 space-y-3 pl-7">
          {/* Ordem de leitura: primeiro DE QUEM ela vai atrás, depois o que faz com
              o lead, depois quando pode fazer, e só então o ritmo. */}
          <FollowupPipelinesRow agent={agent} onSave={onSave} />

          {/* Antes do "o que fazer quando o lead sumir": é a ordem em que as coisas
              acontecem com o lead. */}
          <ReengagementRow agent={agent} onChange={onChange} onSave={onSave} />

          <FollowupActionPicker agent={agent} onSave={onSave} />

          <FollowupHoursRow agent={agent} onSave={onSave} />

          <FollowupDripRow agent={agent} onChange={onChange} onSave={onSave} />

          <div className="flex items-end gap-3">
            <div>
              <Label htmlFor="fu_min" className="text-xs">A cada (mín. dias)</Label>
              <Input id="fu_min" type="number" min={1} max={365} value={agent.followup_min_days ?? 2} className="mt-1 w-24"
                onChange={(e) => onChange({ ...agent, followup_min_days: Number(e.target.value) })}
                onBlur={() => onSave({ followup_min_days: Math.max(1, Number(agent.followup_min_days) || 2) })} />
            </div>
            <div>
              <Label htmlFor="fu_max" className="text-xs">até (máx. dias)</Label>
              <Input id="fu_max" type="number" min={1} max={365} value={agent.followup_max_days ?? 3} className="mt-1 w-24"
                onChange={(e) => onChange({ ...agent, followup_max_days: Number(e.target.value) })}
                onBlur={() => onSave({ followup_max_days: Math.max(Number(agent.followup_min_days) || 1, Number(agent.followup_max_days) || 3) })} />
            </div>
            <p className="text-xs text-muted-foreground pb-2">
              {agent.followup_action === 'ai'
                ? 'A IA espera um tempo aleatório nessa faixa entre cada follow-up.'
                : 'Quanto tempo de silêncio até a IA entregar o lead ao funil.'}
            </p>
          </div>

          {/* O teto de cutucadas só faz sentido quando é a IA que cutuca. Entregando
              ao funil ela age UMA vez e sai de cena — quem manda dali em diante é o
              funil, com o número de mensagens que ele tem. */}
          {agent.followup_action === 'ai' && (
            <div>
              <Label htmlFor="fu_max_att" className="text-xs">Máximo de follow-ups (0 = infinito, para sempre)</Label>
              <Input id="fu_max_att" type="number" min={0} value={agent.followup_max_attempts ?? 0} className="mt-1 w-40"
                onChange={(e) => onChange({ ...agent, followup_max_attempts: Number(e.target.value) })}
                onBlur={() => onSave({ followup_max_attempts: Math.max(0, Number(agent.followup_max_attempts) || 0) })} />
            </div>
          )}

          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" className="mt-1" checked={agent.followup_only} onChange={(e) => onSave({ followup_only: e.target.checked })} />
            <div>
              <div className="text-sm font-medium">Só follow-up (não responde ao vivo)</div>
              <div className="text-xs text-muted-foreground">
                A IA não conversa com o lead — apenas faz os follow-ups de reengajamento. O atendimento ao vivo fica com o corretor.
              </div>
            </div>
          </label>
        </div>
      )}
    </div>
  );
}

/**
 * Reengajamento: antes do follow-up, a IA retoma a pergunta que ficou no ar.
 *
 * Só pra quem conversou e parou NO MEIO (quem nunca respondeu é do Robô Sem
 * Resposta). Mora dentro do follow-up porque é uma etapa dele: mesmo horário
 * ("Quando o follow-up pode sair"), mesmo gotejamento e mesmo público. Um horário
 * próprio aqui seriam duas verdades sobre quando a IA toma a iniciativa.
 */
function ReengagementRow({
  agent, onChange, onSave,
}: {
  agent: SalesAgent;
  onChange: (a: SalesAgent) => void;
  onSave: (patch: Partial<SalesAgent>) => void;
}) {
  const on = !!agent.reengagement_enabled;
  return (
    <div className="rounded-md border border-sidebar-border p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Antes do follow-up: reengajamento</div>
          <div className="text-xs text-muted-foreground">
            Quando a IA pergunta e o lead para de responder no meio da conversa, ela retoma a pergunta duas
            vezes. Sem resposta, o lead segue pro follow-up abaixo. Segue o horário de{' '}
            <strong>Quando o follow-up pode sair</strong>.
          </div>
        </div>
        <Toggle on={on} onChange={(v) => onSave({ reengagement_enabled: v })} rotulo="reengajamento" />
      </div>

      {/* Em "Só follow-up" a IA não responde ao vivo: não existe pergunta dela pra
          retomar, e o servidor não manda nada. Dizer isso evita "liguei e não sai". */}
      {on && agent.followup_only && (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
          Com &quot;Só follow-up&quot; marcado a IA não responde ao vivo, então não há pergunta pra retomar: o
          reengajamento não age.
        </p>
      )}

      {on && (
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="re_first" className="text-xs">1ª mensagem depois de</Label>
            <div className="mt-1 flex items-center gap-2">
              <Input id="re_first" type="number" min={1} max={48} className="w-20"
                value={agent.reengagement_first_hours ?? REENGAGEMENT_DEFAULT_FIRST_HOURS}
                onChange={(e) => onChange({ ...agent, reengagement_first_hours: Number(e.target.value) })}
                onBlur={() => onSave({
                  reengagement_first_hours: clampReengagementHours(agent.reengagement_first_hours, REENGAGEMENT_DEFAULT_FIRST_HOURS),
                })} />
              <span className="text-xs text-muted-foreground">h sem resposta</span>
            </div>
          </div>
          <div>
            <Label htmlFor="re_second" className="text-xs">2ª mensagem</Label>
            <div className="mt-1 flex items-center gap-2">
              <Input id="re_second" type="number" min={1} max={48} className="w-20"
                value={agent.reengagement_second_hours ?? REENGAGEMENT_DEFAULT_SECOND_HOURS}
                onChange={(e) => onChange({ ...agent, reengagement_second_hours: Number(e.target.value) })}
                onBlur={() => onSave({
                  reengagement_second_hours: clampReengagementHours(agent.reengagement_second_hours, REENGAGEMENT_DEFAULT_SECOND_HOURS),
                })} />
              <span className="text-xs text-muted-foreground">h depois da 1ª</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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
function FollowupPipelinesRow({
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
function FollowupHoursRow({
  agent, onSave,
}: {
  agent: SalesAgent;
  onSave: (patch: Partial<SalesAgent>) => void;
}) {
  const windows = janelaDoFollowup(agent);
  const entregaAoFunil = agent.followup_action === 'pipeline' || agent.followup_action === 'sequence';

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

      {entregaAoFunil && (
        <p className="mt-2 text-xs text-muted-foreground">
          Neste modo o horário acima decide <strong>quando a IA entrega o lead</strong>. As
          mensagens dali em diante saem no horário do <em>funil</em>, que tem o relógio dele
          (a chave <em>Só enviar em horário comercial</em>, em Automações → Follow-up).
        </p>
      )}
    </div>
  );
}

function FollowupDripRow({
  agent, onChange, onSave,
}: {
  agent: SalesAgent;
  onChange: (a: SalesAgent) => void;
  onSave: (patch: Partial<SalesAgent>) => void;
}) {
  const on = agent.followup_drip_enabled !== false;
  const num = (v: number | undefined, padrao: number) => (v === undefined || v === null ? padrao : v);

  return (
    <div className="rounded-md border border-sidebar-border p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Ir aos poucos, como gente</div>
          <div className="text-xs text-muted-foreground">
            Em vez de mandar todo mundo de uma vez, a IA pega um punhado de leads, espera, pega
            outro punhado. O tempo de espera muda a cada vez — ritmo certinho denuncia robô tanto
            quanto rajada.
          </div>
        </div>
        <Toggle on={on} onChange={(v) => onSave({ followup_drip_enabled: v })} rotulo="ir aos poucos, como gente" />
      </div>

      {on ? (
        <div className="mt-3 space-y-2 pl-1">
          <div className="flex flex-wrap items-end gap-2">
            <span className="text-sm pb-2">Pega de</span>
            <Input type="number" min={1} max={20} aria-label="mínimo de leads por vez"
              className="w-16" value={num(agent.followup_drip_min_leads, 2)}
              onChange={(e) => onChange({ ...agent, followup_drip_min_leads: Number(e.target.value) })}
              onBlur={() => onSave({ followup_drip_min_leads: Math.min(20, Math.max(1, Number(agent.followup_drip_min_leads) || 2)) })} />
            <span className="text-sm pb-2">a</span>
            <Input type="number" min={1} max={20} aria-label="máximo de leads por vez"
              className="w-16" value={num(agent.followup_drip_max_leads, 3)}
              onChange={(e) => onChange({ ...agent, followup_drip_max_leads: Number(e.target.value) })}
              onBlur={() => onSave({ followup_drip_max_leads: Math.min(20, Math.max(Number(agent.followup_drip_min_leads) || 1, Number(agent.followup_drip_max_leads) || 3)) })} />
            <span className="text-sm pb-2">leads por vez, esperando de</span>
            <Input type="number" min={1} max={240} aria-label="pausa mínima em minutos"
              className="w-16" value={num(agent.followup_drip_min_minutes, 3)}
              onChange={(e) => onChange({ ...agent, followup_drip_min_minutes: Number(e.target.value) })}
              onBlur={() => onSave({ followup_drip_min_minutes: Math.min(240, Math.max(1, Number(agent.followup_drip_min_minutes) || 3)) })} />
            <span className="text-sm pb-2">a</span>
            <Input type="number" min={1} max={240} aria-label="pausa máxima em minutos"
              className="w-16" value={num(agent.followup_drip_max_minutes, 5)}
              onChange={(e) => onChange({ ...agent, followup_drip_max_minutes: Number(e.target.value) })}
              onBlur={() => onSave({ followup_drip_max_minutes: Math.min(240, Math.max(Number(agent.followup_drip_min_minutes) || 1, Number(agent.followup_drip_max_minutes) || 5)) })} />
            <span className="text-sm pb-2">minutos entre um e outro.</span>
          </div>
          {minutosPorDia(janelaDoFollowup(agent)) > 0 ? (
            <p className="text-xs text-muted-foreground">
              Dá cerca de <strong>{estimativaPorDia(agent)} leads por dia</strong>,{' '}
              {resumoDaJanela(janelaDoFollowup(agent))}. Aumente a espera para ir mais devagar —
              número novo, ou primeira vez ligando num cliente com muito lead parado, pede calma.
            </p>
          ) : (
            /* Janela de duração zero (início igual ao fim) fecha o dia inteiro no
               servidor. Sem este aviso, "configurei e o follow-up parou" vira
               chamado de suporte com a configuração parecendo certa. */
            <p className="text-xs text-amber-600">
              O horário logo acima não tem duração nenhuma, então nada sai. Para valer o dia
              inteiro, use <strong>00:00</strong> às <strong>23:59</strong>.
            </p>
          )}
        </div>
      ) : (
        <p className="mt-2 text-xs text-amber-600">
          Desligado, a IA entrega todos os leads vencidos de uma vez — até 200 a cada passada. Ao
          ligar a chave num cliente com muito lead parado, isso vira uma enxurrada de mensagens
          saindo do mesmo número.
        </p>
      )}
    </div>
  );
}

// As três saídas do follow-up. As duas de baixo não consomem IA: as mensagens do
// funil já estão escritas, então cutucar o lead deixa de custar por lead e por vez.
const FOLLOWUP_ACTIONS: [SalesAgentFollowupAction, string, string][] = [
  ['ai', 'A IA escreve a mensagem',
   'Personalizada com base na conversa inteira e no imóvel de interesse. É a que mais converte — e a única que consome IA a cada envio.'],
  ['pipeline', 'Mover o card para uma coluna',
   'A IA leva o card para a coluna que você escolher e sai de cena. Quem manda a mensagem é o follow-up que começa quando o card entra nessa coluna. Não consome IA.'],
  ['sequence', 'Entregar pro follow-up',
   'A IA coloca o lead no follow-up escolhido, sem mexer no card. Para quem não usa o quadro de funil. Não consome IA.'],
];

function FollowupActionPicker({
  agent, onSave,
}: {
  agent: SalesAgent;
  onSave: (patch: Partial<SalesAgent>) => void;
}) {
  const [stages, setStages] = useState<StageOpt[]>([]);
  const [followups, setFollowups] = useState<FollowupFlowOption[]>([]);
  const acao = agent.followup_action ?? 'ai';
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
