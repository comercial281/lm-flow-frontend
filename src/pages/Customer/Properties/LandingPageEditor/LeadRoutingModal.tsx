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
  const disqInit = ((page.settings as { routing?: { disqualified?: Record<string, string | null> } } | null)
    ?.routing?.disqualified) ?? {};
  const [pipelines, setPipelines] = useState<Opt[]>([]);
  const [stages, setStages] = useState<Opt[]>([]);
  const [labels, setLabels] = useState<Opt[]>([]);
  const [pipelineId, setPipelineId] = useState(page.lead_pipeline_id ?? '');
  const [stageId, setStageId] = useState(page.lead_stage_id ?? '');
  const [labelId, setLabelId] = useState(page.lead_label_id ?? '');
  // Ramo desqualificado (opcional): se vazio, cai no roteamento padrão acima.
  const [disqStages, setDisqStages] = useState<Opt[]>([]);
  const [disqPipelineId, setDisqPipelineId] = useState(disqInit.pipeline_id ?? '');
  const [disqStageId, setDisqStageId] = useState(disqInit.stage_id ?? '');
  const [disqLabelId, setDisqLabelId] = useState(disqInit.label_id ?? '');
  // Rastreio (Pixel Meta) da landing — client-side.
  const pixelInit = ((page.settings as { pixel?: { pixel_id?: string; events?: Record<string, boolean> } } | null)
    ?.pixel) ?? {};
  const pixelEv = pixelInit.events ?? {};
  const [pixelId, setPixelId] = useState(pixelInit.pixel_id ?? '');
  const [evPageView, setEvPageView] = useState(pixelEv.page_view ?? true);
  const [evLead, setEvLead] = useState(pixelEv.lead ?? true);
  const [evQualified, setEvQualified] = useState(pixelEv.qualified ?? true);
  const [evDisqualified, setEvDisqualified] = useState(pixelEv.disqualified ?? false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchStages = async (pid: string) => {
    const res = await pipelinesService.getPipelineStages(pid);
    return ((res?.data ?? []) as Array<{ id: string; name: string }>).map((s) => ({ id: s.id, label: s.name }));
  };
  const loadStages = async (pid: string, active = true) => {
    const ss = await fetchStages(pid);
    if (active) setStages(ss);
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
        if (disqInit.pipeline_id) {
          const ss = await fetchStages(disqInit.pipeline_id);
          if (active) setDisqStages(ss);
        }
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

  const onDisqPipeline = async (pid: string) => {
    setDisqPipelineId(pid);
    setDisqStageId('');
    setDisqStages([]);
    if (pid) setDisqStages(await fetchStages(pid));
  };

  const save = async () => {
    setSaving(true);
    try {
      const hasDisq = disqPipelineId || disqStageId || disqLabelId;
      const settings = {
        routing: {
          disqualified: hasDisq
            ? {
                pipeline_id: disqPipelineId || null,
                stage_id: disqStageId || null,
                label_id: disqLabelId || null,
              }
            : {},
        },
        pixel: {
          pixel_id: pixelId.trim() || null,
          events: {
            page_view: evPageView,
            lead: evLead,
            qualified: evQualified,
            disqualified: evDisqualified,
          },
        },
      };
      await landingPageService.saveRouting(
        siteId,
        page.id,
        {
          lead_pipeline_id: pipelineId || null,
          lead_stage_id: stageId || null,
          lead_label_id: labelId || null,
        },
        settings,
      );
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
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-card p-5">
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

            <div className="mt-2 border-t border-border pt-3">
              <p className="mb-0.5 text-sm font-medium">Se o lead for desqualificado (opcional)</p>
              <p className="mb-2 text-xs text-muted-foreground">Deixe vazio para usar o mesmo roteamento acima.</p>
              <div className="space-y-3">
                <Field label="Pipeline" value={disqPipelineId} onChange={onDisqPipeline} options={pipelines} placeholder="Mesmo de cima" />
                {disqPipelineId && (
                  <Field label="Coluna (estágio)" value={disqStageId} onChange={setDisqStageId} options={disqStages} placeholder="Escolha a coluna" />
                )}
                <Field label="Tag" value={disqLabelId} onChange={setDisqLabelId} options={labels} placeholder="Sem tag" />
              </div>
            </div>

            <div className="mt-2 border-t border-border pt-3">
              <p className="mb-0.5 text-sm font-medium">Rastreio (Pixel Meta)</p>
              <p className="mb-2 text-xs text-muted-foreground">Dispara os eventos na landing pra otimizar o anúncio. Deixe o ID vazio pra desligar.</p>
              <label className="block">
                <span className="mb-1 block text-xs text-muted-foreground">ID do Pixel</span>
                <input value={pixelId} onChange={(e) => setPixelId(e.target.value)} placeholder="Ex: 123456789012345"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
              </label>
              <div className="mt-2 grid grid-cols-2 gap-1.5 text-xs text-muted-foreground">
                <label className="flex items-center gap-1.5"><input type="checkbox" checked={evPageView} onChange={(e) => setEvPageView(e.target.checked)} /> PageView</label>
                <label className="flex items-center gap-1.5"><input type="checkbox" checked={evLead} onChange={(e) => setEvLead(e.target.checked)} /> Lead (no envio)</label>
                <label className="flex items-center gap-1.5"><input type="checkbox" checked={evQualified} onChange={(e) => setEvQualified(e.target.checked)} /> Lead Qualificado</label>
                <label className="flex items-center gap-1.5"><input type="checkbox" checked={evDisqualified} onChange={(e) => setEvDisqualified(e.target.checked)} /> Lead Desqualificado</label>
              </div>
            </div>

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
