import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Loader2, StopCircle, Rocket, Play } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/ds';
import EmptyState from '@/components/base/EmptyState';
import { httpStatusOf, serverErrorOf } from '@/services/core/httpError';
import {
  flowAutomationInstancesService,
  type RunningFlow,
  type StartableFollowup,
} from '@/services/flowAutomations/flowAutomationInstancesService';
import { useColocarEmFollowup } from '@/features/followup/useColocarEmFollowup';
import { linhaDoFluxo, saiAs } from '@/features/conversas/automacaoRodando';

/**
 * O bloco de FOLLOW-UP do card (Automações · sprint 3, 03/10/2026).
 *
 * O follow-up virou um fluxo do construtor (aba Follow-up). Aqui o card mostra:
 *
 * - cada fluxo de follow-up rodando pra este lead, com a MESMA linha da faixa da
 *   conversa ("Follow-up "X" · aguardando resposta até…") e **Parar**;
 * - sem nada rodando, **Iniciar**: abre a janela "Colocar em follow-up" (Fase 2,
 *   20/10/2026), a mesma de todas as portas; a escolha do follow-up, do ponto de
 *   partida e a ida pra coluna moram lá. O botão só aparece quando o servidor
 *   lista algum em `meta.startable_followups` (o corretor não lê o construtor).
 *
 * Pausar manual saiu (decisão do Tony, 02–03/10). Desde 20/10/2026 o SERVIDOR
 * pausa o follow-up quando o número cai ("Pausado: motivo" + **Retomar**) e
 * segura a mensagem no gotejamento ("Na fila, sai às HH:MM"). O estado continua vindo
 * do servidor, nunca de etiqueta: a lição de 31/08 (o botão lia a etiqueta e a
 * lista lia a fila, e as duas discordavam na tela).
 */

const RUNNING = { label: 'Rodando', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' };
const PAUSED = { label: 'Follow-up pausado', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' };
const IDLE = { label: 'Sem follow-up', cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' };
// Leitura dos fluxos falhou: "Sem follow-up" mentiria (pode estar rodando).
const UNKNOWN = { label: 'Não deu pra ler', cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' };

/** Aceita contato OU conversa: lead de formulário/anúncio pode não ter conversa,
 *  e o follow-up é do LEAD. */
export interface LeadRef {
  contactId?: string | null;
  conversationId?: string | null;
}

interface Props extends LeadRef {
  /** Somente leitura: cargo sem permissão de mexer no card. */
  readOnly?: boolean;
  /** A coluna fixa do card do lead. O bloco já é de uma linha por follow-up; fica pela compatibilidade. */
  compacto?: boolean;
  /** O card de onde o bloco abre: a janela "Colocar em follow-up" leva ele (o servidor move pra coluna). */
  pipelineItemId?: string | null;
  /** Depois de pôr o lead no follow-up pela janela: o card leva a Etapa pra coluna Follow-up e avisa o quadro. */
  aoColocar?: () => void;
}

/** "Parar o follow-up X"; nome mascarado ("Follow-up de Ana") entra como veio: "Parar Follow-up de Ana". */
const rotuloDePararFollowup = (flow: RunningFlow): string =>
  flow.flow_masked && flow.flow_name ? `Parar ${flow.flow_name}` : `Parar o follow-up ${flow.flow_name ?? ''}`.trim();

/** A linha do follow-up: pausado e na fila falam por extenso; o resto é a frase da faixa da conversa. */
const textoDoFluxo = (flow: RunningFlow): string => {
  if (flow.phase === 'paused') return flow.paused_reason ? `Pausado: ${flow.paused_reason}` : 'Pausado';
  if (flow.phase === 'queued') return flow.until ? `Na fila, ${saiAs(flow.until)}` : 'Na fila';
  return linhaDoFluxo(flow).texto;
};

const failMessage = (e: unknown) =>
  serverErrorOf(e)
  || (httpStatusOf(e) === 403 ? 'Seu cargo não permite mexer no follow-up deste lead.' : null)
  || 'Não consegui falar com o servidor. Tente de novo.';

export default function FollowupTimeline({ contactId, conversationId, readOnly, compacto, pipelineItemId, aoColocar }: Props) {
  const [flows, setFlows] = useState<RunningFlow[]>([]);
  const [options, setOptions] = useState<StartableFollowup[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);
  // Falha (que não é 403) não vira "Nenhum…".
  const [erroFluxos, setErroFluxos] = useState(false);
  const followup = useColocarEmFollowup();

  const ref = useMemo<LeadRef>(() => ({ contactId, conversationId }), [contactId, conversationId]);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const load = useCallback(async () => {
    if (!contactId && !conversationId) { setLoading(false); return; }
    const [running] = await Promise.allSettled([flowAutomationInstancesService.forCard(ref)]);
    if (!alive.current) return;
    setFlows(running.status === 'fulfilled' ? running.value.flows.filter(f => f.kind === 'followup' && f.active) : []);
    setOptions(running.status === 'fulfilled' ? running.value.startable : []);
    // 403 é o cargo sem a permissão, e precisa aparecer: engolir o erro e
    // mostrar "sem follow-up" foi o que fez a linha do tempo parecer vazia pra
    // corretor e gestor com follow-up rodando.
    setDenied(running.status === 'rejected' && httpStatusOf(running.reason) === 403);
    setErroFluxos(running.status === 'rejected' && httpStatusOf(running.reason) !== 403);
    setLoading(false);
  }, [ref, contactId, conversationId]);

  useEffect(() => { setLoading(true); void load(); }, [load]);

  const act = useCallback(async (fn: () => Promise<{ message?: string }>, fallbackMsg: string) => {
    setBusy(true);
    try {
      const result = await fn();
      if (!alive.current) return;
      toast.success(result.message || fallbackMsg);
      // Recarrega da MESMA fonte: a ação não devolve a lista.
      await load();
    } catch (e: unknown) {
      toast.error(failMessage(e));
    } finally {
      if (alive.current) setBusy(false);
    }
  }, [load]);

  const running = flows.length > 0;
  // Iniciar abre a janela "Colocar em follow-up"; depois de iniciar, relê da MESMA fonte.
  const abrirJanela = () => followup.abrir(
    { contactId, conversationId, pipelineItemId: pipelineItemId ?? undefined },
    { aoConfirmar: () => { void load(); aoColocar?.(); } },
  );

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
        <Loader2 className="h-3 w-3 animate-spin" /> Carregando follow-up…
      </div>
    );
  }

  if (denied) {
    return (
      <p className="text-[11px] text-muted-foreground">
        Seu cargo não dá acesso ao follow-up deste lead. Peça a um administrador para liberar o
        acesso ao funil de vendas.
      </p>
    );
  }

  const canAct = !readOnly;
  const headline = flows.some(f => f.phase === 'paused') ? PAUSED : running ? RUNNING : erroFluxos ? UNKNOWN : IDLE;

  const stopButton = (onClick: () => void, label: string) => (
    <Button size="sm" variant="outline" className="text-xs gap-1.5 shrink-0" disabled={busy} onClick={onClick} aria-label={label}>
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <StopCircle className="h-3.5 w-3.5" />}
      Parar
    </Button>
  );

  const resumeButton = (flow: RunningFlow) => flow.phase === 'paused' ? (
    <Button size="sm" variant="default" className="text-xs gap-1.5 shrink-0" disabled={busy}
      onClick={() => void act(() => flowAutomationInstancesService.resume(flow.id), 'Follow-up retomado.')}
      aria-label="Retomar">
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
      Retomar
    </Button>
  ) : null;

  // Janela do card (versão A): o estado à esquerda e o botão de contorno à
  // direita, numa linha por follow-up. Sem selo colorido nem roxo cheio.
  // Mantém o que a versão de antes dizia: "mensagem N enviada" de cada fluxo e,
  // sem follow-up pra iniciar, onde criar um.
  if (compacto) {
    const semOpcao = canAct && options.length === 0 && !erroFluxos;
    const linhas: Array<{ chave: string; texto: string; retomar?: () => ReactNode; parar?: () => ReactNode }> = [
      ...flows.map(flow => ({
        chave: flow.id,
        texto: textoDoFluxo(flow) + (flow.progress_step ? ` · mensagem ${flow.progress_step} enviada` : ''),
        retomar: () => resumeButton(flow),
        parar: () => stopButton(
          () => void act(() => flowAutomationInstancesService.stop(flow.id), 'Follow-up parado'),
          rotuloDePararFollowup(flow),
        ),
      })),
    ];
    return (
      <div className="grid gap-2">
        {linhas.map(l => (
          <div key={l.chave} data-linha-followup className="flex items-center gap-2">
            <span className="min-w-0 flex-1 text-xs text-foreground line-clamp-2">{l.texto}</span>
            {canAct && l.retomar?.()}
            {canAct && l.parar?.()}
          </div>
        ))}
        {linhas.length === 0 && semOpcao && (
          <EmptyState
            tamanho="compacto"
            title="Nenhum follow-up pra iniciar."
            description={<>Crie e ligue um em <em>Funis de mensagem → Follow-up</em>.</>}
            className="p-3 text-xs"
          />
        )}
        {linhas.length === 0 && !semOpcao && (
          <div data-linha-followup className="flex items-center gap-2">
            <span className="min-w-0 flex-1 text-xs text-muted-foreground">{headline.label}</span>
            {canAct && options.length > 0 && (
              <Button size="sm" variant="outline" className="text-xs gap-1.5 shrink-0" disabled={busy}
                aria-label="Iniciar follow-up"
                onClick={abrirJanela}>
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}
                Iniciar
              </Button>
            )}
          </div>
        )}
        {erroFluxos && !running && (
          <EmptyState tipo="erro" tamanho="compacto" aoTentarDeNovo={() => void load()} className="p-3 text-xs" />
        )}
        {followup.janela}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${headline.cls}`}>{headline.label}</span>
      </div>

      {/* Uma linha por follow-up rodando: a mesma da faixa da conversa. */}
      {flows.map(flow => (
        <div key={flow.id} className="flex items-center gap-2">
          <span className="min-w-0 flex-1 text-xs text-muted-foreground line-clamp-2">
            {textoDoFluxo(flow)}
            {flow.progress_step ? <span className="text-[10px]"> · mensagem {flow.progress_step} enviada</span> : null}
          </span>
          {canAct && resumeButton(flow)}
          {canAct && stopButton(
            () => void act(() => flowAutomationInstancesService.stop(flow.id), 'Follow-up parado'),
            rotuloDePararFollowup(flow),
          )}
        </div>
      ))}

      {/* O erro vale pra todos, inclusive quem só lê: sem ele, o selo cinza parecia "nada rodando". */}
      {erroFluxos && !running && (
        <EmptyState tipo="erro" tamanho="compacto" aoTentarDeNovo={() => void load()} className="p-3 text-xs" />
      )}

      {/* Iniciar só com nada rodando: começar por cima mandaria mensagem em dobro. */}
      {canAct && !running && (
        options.length > 0 ? (
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="default" className="text-xs gap-1.5" disabled={busy}
              onClick={abrirJanela}>
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}
              Iniciar follow-up
            </Button>
          </div>
        ) : erroFluxos ? null : (
          <EmptyState
            tamanho="compacto"
            title="Nenhum follow-up pra iniciar."
            description={<>Crie e ligue um em <em>Funis de mensagem → Follow-up</em>.</>}
            className="p-3 text-xs"
          />
        )
      )}
      {followup.janela}
    </div>
  );
}
