import { useEffect, useState } from 'react';
import { pipelinesService } from '@/services/pipelines/pipelinesService';
import { labelsService } from '@/services/contacts/labelsService';

export interface LeadRoutingValue {
  lead_pipeline_id?: string | null;
  lead_stage_id?: string | null;
  lead_label_id?: string | null;
}

interface Props {
  value: LeadRoutingValue;
  onChange: (patch: LeadRoutingValue) => void;
  /** Placeholder do select de pipeline (ex.: "Pipeline padrão do tenant"). */
  pipelinePlaceholder?: string;
}

/**
 * Campos reutilizáveis de roteamento de lead (pipeline + etapa + tag), espelhando
 * a Landing de anúncio (LeadRoutingModal). Usado no Site Builder (default do site)
 * e onde mais precisar rotear leads. Carrega pipelines/estágios/labels sozinho e
 * é tolerante a falha de rede (fica com listas vazias, nunca quebra a tela).
 */
export default function LeadRoutingFields({ value, onChange, pipelinePlaceholder }: Props) {
  const [pipelines, setPipelines] = useState<Array<{ id: string; name: string }>>([]);
  const [stages, setStages] = useState<Array<{ id: string; name: string }>>([]);
  const [labels, setLabels] = useState<Array<{ id: string; title: string }>>([]);

  useEffect(() => {
    pipelinesService.getPipelines()
      .then(res => setPipelines((res.data ?? []).map(p => ({ id: String(p.id), name: p.name }))))
      .catch(() => setPipelines([]));
    labelsService.getLabels()
      .then(res => setLabels((res.data ?? []).map(l => ({ id: String(l.id), title: l.title }))))
      .catch(() => setLabels([]));
  }, []);

  // Recarrega as etapas sempre que o pipeline selecionado muda.
  useEffect(() => {
    if (!value.lead_pipeline_id) { setStages([]); return; }
    let alive = true;
    pipelinesService.getPipelineStages(value.lead_pipeline_id)
      .then(res => { if (alive) setStages((res.data ?? []).map(s => ({ id: String(s.id), name: s.name }))); })
      .catch(() => { if (alive) setStages([]); });
    return () => { alive = false; };
  }, [value.lead_pipeline_id]);

  const selectClass = 'mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm';

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div>
        <label className="text-sm font-medium">Pipeline</label>
        <select
          value={value.lead_pipeline_id ?? ''}
          onChange={e => onChange({
            lead_pipeline_id: e.target.value || null,
            // trocar de pipeline invalida a etapa anterior
            lead_stage_id: null,
          })}
          className={selectClass}
        >
          <option value="">{pipelinePlaceholder ?? 'Pipeline padrão do tenant'}</option>
          {pipelines.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div>
        <label className="text-sm font-medium">Coluna (etapa)</label>
        <select
          value={value.lead_stage_id ?? ''}
          onChange={e => onChange({ lead_stage_id: e.target.value || null })}
          disabled={!value.lead_pipeline_id}
          className={selectClass}
        >
          <option value="">{value.lead_pipeline_id ? 'Primeira coluna' : '—'}</option>
          {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      <div>
        <label className="text-sm font-medium">Tag</label>
        <select
          value={value.lead_label_id ?? ''}
          onChange={e => onChange({ lead_label_id: e.target.value || null })}
          className={selectClass}
        >
          <option value="">Sem tag</option>
          {labels.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
        </select>
      </div>
    </div>
  );
}
