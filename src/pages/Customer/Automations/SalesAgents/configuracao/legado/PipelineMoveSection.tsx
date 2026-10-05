import { useEffect, useState } from 'react';
import { Label } from '@/components/ui/ds';
import { type SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { pipelinesService } from '@/services/pipelines/pipelinesService';
import { Seletor } from '@/components/base/Seletor';
import { type PipelineOpt, type StageOpt, Toggle } from '../comum';

// A IA move o card do lead no funil conforme a conversa anda.
//
// O mapa é "etapa da IA -> coluna DESTA imobiliária", e não a IA escolhendo a
// coluna pelo nome: cada cliente batiza as colunas do jeito dele, e deixar a IA
// adivinhar faria o card parar de andar em silêncio no dia em que alguém
// renomeasse uma coluna.
//
// Etapa sem coluna escolhida = a IA não mexe no card naquela etapa. É o que
// permite ligar só o "visita agendada" e deixar o resto quieto.
const PIPELINE_MOVE_STAGES: Array<[string, string, string]> = [
  ['descobrindo', 'Descobrindo o que o lead quer', 'Primeiras mensagens, ainda entendendo a procura.'],
  ['qualificando', 'Qualificando', 'Já sabe região, orçamento ou prazo.'],
  ['pronto_para_visita', 'Pronto para visita', 'O lead demonstrou interesse real em conhecer o imóvel.'],
  ['agendando', 'Combinando dia e hora', 'Está fechando o horário da visita com o lead.'],
  ['agendado', 'Visita agendada', 'A visita foi marcada de verdade (a IA criou a visita).'],
  ['transferir', 'Passou pro corretor', 'A IA entregou o lead para uma pessoa.'],
];

export function PipelineMoveSection({
  agent, onSave,
}: {
  agent: SalesAgent;
  onSave: (patch: Partial<SalesAgent>) => void;
}) {
  const [pipelines, setPipelines] = useState<PipelineOpt[]>([]);
  const [stages, setStages] = useState<StageOpt[]>([]);
  const ligado = agent.pipeline_move_enabled === true;
  const funil = agent.pipeline_id ?? '';
  const mapa = agent.pipeline_stage_map ?? {};

  useEffect(() => {
    if (!ligado) return;
    pipelinesService.getPipelines()
      .then((res: unknown) => {
        const raw = (res as { data?: PipelineOpt[] }).data ?? (Array.isArray(res) ? (res as PipelineOpt[]) : []);
        setPipelines(raw.map((p) => ({ id: String(p.id), name: p.name })));
      })
      .catch(() => setPipelines([]));
  }, [ligado]);

  useEffect(() => {
    if (!ligado || !funil) { setStages([]); return; }
    pipelinesService.getPipelineStages(funil)
      .then((res: unknown) => {
        const raw = (res as { data?: StageOpt[] }).data ?? (Array.isArray(res) ? (res as StageOpt[]) : []);
        setStages(raw.map((st) => ({ id: String(st.id), name: st.name })));
      })
      .catch(() => setStages([]));
  }, [ligado, funil]);

  // Trocar de funil LIMPA o mapa: as colunas do mapa antigo são de outro funil, e
  // o servidor as recusaria uma a uma — o gestor veria as escolhas guardadas e
  // nenhum card andando.
  const trocarFunil = (id: string) => onSave({ pipeline_id: id || null, pipeline_stage_map: {} });

  const escolherColuna = (stage: string, stageId: string) => {
    const proximo = { ...mapa };
    if (stageId) proximo[stage] = stageId; else delete proximo[stage];
    onSave({ pipeline_stage_map: proximo });
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Mover o card no funil</div>
          <div className="text-xs text-muted-foreground">
            Conforme a conversa anda, a IA leva o card para a coluna que você escolher.
            O histórico do card mostra o movimento como feito pela IA.
          </div>
        </div>
        <Toggle on={ligado} onChange={(v) => onSave({ pipeline_move_enabled: v })} rotulo="mover o card no funil" />
      </div>

      {ligado && (
        <div className="mt-3 pl-7 space-y-3">
          <div>
            <Label htmlFor="pipeline_move_funil" className="text-xs">Em qual funil</Label>
            <Seletor
              id="pipeline_move_funil"
              value={funil}
              onChange={(e) => trocarFunil(e.target.value)}
              className="mt-1 w-full rounded-md border border-sidebar-border bg-background px-2 py-1 text-sm"
            >
              <option value="">— escolha o funil —</option>
              {pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Seletor>
          </div>

          {funil && (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">
                Para cada momento da conversa, escolha a coluna. Momento sem coluna escolhida:
                a IA não mexe no card.
              </div>
              {PIPELINE_MOVE_STAGES.map(([key, titulo, ajuda]) => (
                <div key={key} className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">{titulo}</div>
                    <div className="text-xs text-muted-foreground">{ajuda}</div>
                  </div>
                  <Seletor
                    value={mapa[key] ?? ''}
                    onChange={(e) => escolherColuna(key, e.target.value)}
                    className="w-48 shrink-0 rounded-md border border-sidebar-border bg-background px-2 py-1 text-sm"
                  >
                    <option value="">— não mover —</option>
                    {stages.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
                  </Seletor>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                A IA só empurra o card para a frente. Se o corretor já levou o lead para uma
                coluna mais adiantada, ela não puxa de volta.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
