// Follow-up (onda 3, decisão 10): retomada e follow-up numa página só, como linha
// do tempo. Nasce em cima do Follow-up padrão (06/10/2026, não reabrir): a IA não
// escreve o follow-up (só 'sequence' e 'pipeline'), um campo de dias só (grava
// mínimo = máximo), nada de "Máximo de tentativas".
//
// ⚠️ Ligar o follow-up sem uma saída válida (IA antiga em 'ai', ou sem valor) é
// RECUSADO aqui (o servidor também recusa): a chave volta e o "Depois dela"
// aparece com o motivo, mesmo desligado — senão ninguém conseguiria escolher.
// ⚠️ Público (decisão de 29/09 + onda 1): só quem ela atendeu e que ainda não foi
// pra um corretor. A frase é fixa; o recorte por funil é por cima disso.
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/ds';
import { Secao, Secoes } from '@/components/base/Secao';
import { Campo, CLASSE_DO_CAMPO } from '@/components/base/Campo';
import { Seletor } from '@/components/base/Seletor';
import BotoesDeEscolha from '@/components/base/BotoesDeEscolha';
import CartoesDeEscolha from '@/components/base/CartoesDeEscolha';
import EtiquetasDeEscolha from '@/components/base/EtiquetasDeEscolha';
import LinhaComChave from '@/components/base/LinhaComChave';
import type { SalesAgentFollowupChoice } from '@/services/salesAgents/salesAgentsService';
import type { FlowAutomation } from '@/types/flowAutomations';
import { flowAutomationsService } from '@/services/flowAutomations/flowAutomationsService';
import { pipelinesService } from '@/services/pipelines/pipelinesService';
import { followupFlowOptions, followupPadraoId, legacySequenceNotice } from '@/features/flowAutomations/followupOptions';
import { janelaDoFollowup } from '@/features/salesAgents/followupHours';
import { motivoSemEscolhaDoFollowup } from '@/features/salesAgents/pendencias';
import {
  clampReengagementHours, REENGAGEMENT_DEFAULT_FIRST_HOURS, REENGAGEMENT_DEFAULT_SECOND_HOURS,
} from '../../reengagementHours';
import type { PipelineOpt, StageOpt } from '../../configuracao/comum';
import TextoNaHora from '../TextoNaHora';
import JanelaDaSemana from './JanelaDaSemana';
import { Aviso } from '../Aviso';
import type { PropsDaPagina } from '../paginas';

const ACOES = [
  { valor: 'sequence' as const, rotulo: 'Entregar pro follow-up', descricao: 'Um follow-up pronto de Automações. Padrão: Follow-up padrão (30 dias).' },
  { valor: 'pipeline' as const, rotulo: 'Mover o card', descricao: 'Leva pra uma coluna e traz de volta se responder.' },
];
const lista = <T,>(res: unknown): T[] => (res as { data?: T[] }).data ?? (Array.isArray(res) ? (res as T[]) : []);

export default function Followup({ agent, gravar, irPara }: PropsDaPagina) {
  const [fluxos, setFluxos] = useState<FlowAutomation[]>([]);
  const [funis, setFunis] = useState<PipelineOpt[]>([]);
  const [colunas, setColunas] = useState<StageOpt[]>([]);
  const [recortando, setRecortando] = useState(false);
  const [precisaEscolher, setPrecisaEscolher] = useState(false);

  const ligado = !!agent.followup_enabled;
  const acao = agent.followup_action === 'sequence' || agent.followup_action === 'pipeline' ? agent.followup_action : null;
  const motivo = motivoSemEscolhaDoFollowup({ followup_enabled: true, followup_action: agent.followup_action });
  const escolhidos = agent.followup_pipeline_ids ?? [];
  const recortado = escolhidos.length > 0 || recortando;

  // ⚠️ A promessa fica guardada: "Entregar pro follow-up" clicado antes de a lista
  // chegar espera por ela pra aplicar o Follow-up padrão. Sem isso, gravava sem
  // follow-up e a pendência "sem follow-up" aparecia (revisão final da onda 3, M4).
  const lendoFluxos = useRef<Promise<FlowAutomation[]>>(Promise.resolve([]));
  useEffect(() => {
    lendoFluxos.current = flowAutomationsService.list({ kind: 'followup' }).catch(() => [] as FlowAutomation[]);
    lendoFluxos.current.then(setFluxos);
    pipelinesService.getPipelines().then((r: unknown) => setFunis(lista<PipelineOpt>(r).map((p) => ({ id: String(p.id), name: p.name })))).catch(() => setFunis([]));
  }, []);
  useEffect(() => {
    if (acao !== 'pipeline' || !agent.pipeline_id) { setColunas([]); return; }
    pipelinesService.getPipelineStages(agent.pipeline_id).then((r: unknown) => setColunas(lista<StageOpt>(r).map((s) => ({ id: String(s.id), name: s.name })))).catch(() => setColunas([]));
  }, [acao, agent.pipeline_id]);

  const ligar = async (v: boolean) => {
    if (v && motivo) { setPrecisaEscolher(true); return false; }
    return gravar({ followup_enabled: v });
  };
  const escolherAcao = async (valor: SalesAgentFollowupChoice) => {
    const precisaDoPadrao = valor === 'sequence' && !agent.followup_flow_id;
    const padrao = precisaDoPadrao ? followupPadraoId(await lendoFluxos.current) : null;
    setPrecisaEscolher(false);
    return gravar(padrao ? { followup_action: valor, followup_flow_id: padrao } : { followup_action: valor });
  };
  const dias = agent.followup_min_days ?? 2;
  const mostrarResto = ligado || precisaEscolher;

  return (
    <Secoes>
      <Secao titulo="Linha do tempo" descricao="O que ela faz desde o momento em que o lead para de responder. Desligue a etapa que não quiser.">
        <LinhaComChave rotulo="Ir atrás de quem parou de responder" ligada={ligado} aoMudar={ligar}>
          <ol className="divide-y divide-border rounded-xl border border-border bg-background">
            <li className="bg-muted/40 px-3.5 py-3"><span className="rounded-lg border border-border bg-background px-3 py-1.5 text-[13px] font-semibold">Lead parou de responder</span></li>
            <li className="space-y-3 px-3.5 py-3">
              <LinhaComChave rotulo="Retomada" descricao="Repete a pergunta que ficou sem resposta." ligada={!!agent.reengagement_enabled}
                aoMudar={(v) => gravar({ reengagement_enabled: v })}>
                {agent.followup_only && <Aviso>Com "Só follow-up" ela não responde ao vivo, então não há pergunta pra retomar.</Aviso>}
                <div className="flex flex-wrap items-end gap-3">
                  <TextoNaHora id="retomada-1" tipo="numero" min={1} max={48} rotulo="1ª depois de (horas)" className="w-44"
                    salvo={String(agent.reengagement_first_hours ?? REENGAGEMENT_DEFAULT_FIRST_HOURS)}
                    aoGravar={(v) => gravar({ reengagement_first_hours: clampReengagementHours(Number(v), REENGAGEMENT_DEFAULT_FIRST_HOURS) })} />
                  <TextoNaHora id="retomada-2" tipo="numero" min={1} max={48} rotulo="2ª depois de (horas)" className="w-44"
                    salvo={String(agent.reengagement_second_hours ?? REENGAGEMENT_DEFAULT_SECOND_HOURS)}
                    aoGravar={(v) => gravar({ reengagement_second_hours: clampReengagementHours(Number(v), REENGAGEMENT_DEFAULT_SECOND_HOURS) })} />
                </div>
              </LinhaComChave>
            </li>
            <li className="space-y-2 px-3.5 py-3">
              <p className="text-sm font-semibold">Entrega pro follow-up</p>
              <p className="text-[13px] text-muted-foreground">Depois de um tempo em silêncio, ela sai e o lead vai pra ação de "Depois dela".</p>
              {/* Follow-up padrão (06/10): um número só; o servidor espera o mínimo. */}
              <TextoNaHora id="followup-dias" tipo="numero" min={1} max={365} rotulo="Dias de silêncio até entregar" className="w-56"
                salvo={String(dias)} aoGravar={(v) => { const d = Math.min(365, Math.max(1, Number(v) || 1)); return gravar({ followup_min_days: d, followup_max_days: d }); }} />
            </li>
          </ol>
        </LinhaComChave>
      </Secao>

      {mostrarResto && (
        <>
          <Secao titulo="Quais leads" descricao="Só quem ela atendeu e que ainda não foi pra um corretor. Lead que nunca falou com ela fica com o Robô Sem Resposta, em Automações.">
            <BotoesDeEscolha rotulo="Quais leads" valor={recortado ? 'funis' : 'todos'}
              opcoes={[{ valor: 'todos', rotulo: 'Todos esses' }, { valor: 'funis', rotulo: 'Só os destes funis' }]}
              aoEscolher={(v) => {
                if (v === 'funis') { setRecortando(true); return; }
                setRecortando(false);
                if (escolhidos.length) void gravar({ followup_pipeline_ids: [] });
              }} />
            {recortado && (
              <>
                <EtiquetasDeEscolha rotulo="Funis" opcoes={funis.map((f) => ({ valor: f.id, rotulo: f.name }))} escolhidas={escolhidos}
                  aoMudar={(l) => void gravar({ followup_pipeline_ids: l })} />
                {escolhidos.length === 0 && <Aviso>Marque ao menos um funil. Sem nenhum marcado, ela continua indo atrás de todos os leads que ela atendeu.</Aviso>}
              </>
            )}
          </Secao>

          <Secao titulo="Janela de envio" descricao="Quando ela pode mandar a retomada e entregar o lead. As mensagens dali em diante seguem o horário do follow-up que recebe o lead.">
            <JanelaDaSemana idBase="followup-janela" rotuloDias="Dias de envio" janelas={janelaDoFollowup(agent)}
              aoGravar={(next) => gravar({ followup_hours: { mode: 'custom', tz: 'America/Sao_Paulo', windows: next } })} />
          </Secao>

          <Secao titulo="Depois dela" descricao="Pra onde o lead vai quando ela sai de cena por silêncio.">
            {motivo && <Aviso>{motivo}</Aviso>}
            <CartoesDeEscolha<SalesAgentFollowupChoice> rotulo="Depois dela" valor={acao} opcoes={ACOES} aoEscolher={(v) => void escolherAcao(v)} />
            {acao === 'sequence' && (
              <>
                <Campo id="followup-fluxo" rotulo="Qual follow-up">
                  <Seletor id="followup-fluxo" className={`${CLASSE_DO_CAMPO} w-full`} value={agent.followup_flow_id ?? ''}
                    onChange={(e) => void gravar({ followup_flow_id: e.target.value || null })}>
                    <option value="">Escolha o follow-up</option>
                    {agent.followup_flow_id && !followupFlowOptions(fluxos).some((f) => f.value === agent.followup_flow_id) && (
                      <option value={agent.followup_flow_id}>Follow-up que não existe mais</option>
                    )}
                    {followupFlowOptions(fluxos).map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </Seletor>
                </Campo>
                {legacySequenceNotice(agent) && <Aviso>{legacySequenceNotice(agent)}</Aviso>}
              </>
            )}
            {acao === 'pipeline' && (agent.pipeline_id ? (
              <div className="flex flex-wrap items-end gap-3">
                <Campo id="followup-coluna" rotulo="Coluna do lead que sumiu" className="min-w-[12rem] flex-1">
                  <Seletor id="followup-coluna" className={`${CLASSE_DO_CAMPO} w-full`} value={agent.followup_stage_id ?? ''}
                    onChange={(e) => void gravar({ followup_stage_id: e.target.value || null })}>
                    <option value="">Escolha a coluna</option>
                    {colunas.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </Seletor>
                </Campo>
                <Campo id="followup-volta" rotulo="Volta pra, se responder" className="min-w-[12rem] flex-1">
                  <Seletor id="followup-volta" className={`${CLASSE_DO_CAMPO} w-full`} value={agent.followup_return_stage_id ?? ''}
                    onChange={(e) => void gravar({ followup_return_stage_id: e.target.value || null })}>
                    <option value="">Primeira coluna do funil</option>
                    {colunas.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </Seletor>
                </Campo>
              </div>
            ) : (
              <Aviso>
                <p>Escolha antes o funil em Funil: é dele que saem as colunas.</p>
                <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => irPara('funil')}>Abrir Funil</Button>
              </Aviso>
            ))}
          </Secao>
        </>
      )}
    </Secoes>
  );
}
