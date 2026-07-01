import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, X } from 'lucide-react';
import api from '@/services/core/api';
import { pipelinesService } from '@/services/pipelines/pipelinesService';
import {
  landingPageService,
  type LandingPageDTO,
} from '@/services/landingPages/landingPageService';

interface Opt {
  id: string;
  label: string;
}

/** Config por landing: pra qual pipeline/coluna o lead cai e qual tag recebe. */
export default function LeadRoutingModal({
  siteId,
  page,
  onClose,
  onSaved,
}: {
  siteId: string;
  page: LandingPageDTO;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [pipelines, setPipelines] = useState<Opt[]>([]);
  const [stages, setStages] = useState<Opt[]>([]);
  const [labels, setLabels] = useState<Opt[]>([]);
  const [pipelineId, setPipelineId] = useState(page.lead_pipeline_id ?? '');
  const [stageId, setStageId] = useState(page.lead_stage_id ?? '');
  const [labelId, setLabelId] = useState(page.lead_label_id ?? '');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadStages = async (pid: string, active = true) => {
    const res = await pipelinesService.getPipelineStages(pid);
    if (!active) return;
    const ss = (res?.data ?? []) as Array<{ id: string; name: string }>;
    setStages(ss.map((s) => ({ id: s.id, label: s.name })));
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [pRes, lRes] = await Promise.all([
          pipelinesService.getPipelines(),
          api.get('/labels'),
        ]);
        if (!active) return;
        const ps = (pRes?.data ?? []) as Array<{ id: string; name: string }>;
        setPipelines(ps.map((p) => ({ id: p.id, label: p.name })));
        const ls = ((lRes.data as { data?: Array<{ id: string; title: string }> })?.data ?? []);
        setLabels(ls.map((l) => ({ id: l.id, label: l.title })));
        if (page.lead_pipeline_id) await loadStages(page.lead_pipeline_id, active);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPipeline = async (pid: string) => {
    setPipelineId(pid);
    setStageId('');
    setStages([]);
    if (pid) await loadStages(pid);
  };

  const save = async () => {
    setSaving(true);
    try {
      await landingPageService.saveRouting(siteId, page.id, {
        lead_pipeline_id: pipelineId || null,
        lead_stage_id: stageId || null,
        lead_label_id: labelId || null,
      });
      toast.success('Roteamento salvo');
      onSaved();
    } catch {
      toast.error('Erro ao salvar roteamento');
    } finally {
      setSaving(false);
    }
  };

  const Field = ({ label, value, onChange, options, placeholder }: {
    label: string; value: string; onChange: (v: string) => void; options: Opt[]; placeholder: string;
  }) => (
    <label className="block">
      <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary">
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5">
        <div className="mb-1 flex items-start justify-between">
          <h2 className="text-base font-semibold">Roteamento de lead</h2>
          <button type="button" aria-label="Fechar" onClick={onClose} className="text-muted-foreground"><X className="h-4 w-4" /></button>
        </div>
        <p className="mb-4 truncate text-xs text-muted-foreground">Landing: {page.title}</p>

        {loading ? (
          <div className="flex items-center gap-2 py-6 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
        ) : (
          <div className="space-y-3">
            <Field label="Pipeline" value={pipelineId} onChange={onPipeline} options={pipelines} placeholder="Sem pipeline (só vira contato)" />
            {pipelineId && (
              <Field label="Coluna (estágio)" value={stageId} onChange={setStageId} options={stages} placeholder="Escolha a coluna" />
            )}
            <Field label="Tag" value={labelId} onChange={setLabelId} options={labels} placeholder="Sem tag" />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm text-muted-foreground">Cancelar</button>
              <button type="button" onClick={save} disabled={saving}
                className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
