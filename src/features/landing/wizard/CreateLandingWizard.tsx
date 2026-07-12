import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Building2, Check, Loader2, Megaphone, Search, X } from 'lucide-react';
import api from '@/services/core/api';
import { landingPageService } from '@/services/landingPages/landingPageService';
import { pipelinesService } from '@/services/pipelines/pipelinesService';
import { propertiesService, type Property } from '@/services/properties/propertiesService';

interface Opt {
  id: string;
  label: string;
}

type Base = 'blank' | 'property';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * Assistente de criação de landing (Fatia 1): monta a landing já reusando o que
 * existe — em branco ou de um imóvel + nome + destino do lead (pipeline/coluna/
 * tag) — cria, aplica o roteamento e abre o editor. As etapas mais pesadas
 * (quiz+qualificação, automação/roleta/lembrete/instância, Pixel/CAPI, páginas
 * de resultado, templates) entram nas próximas fatias.
 */
export default function CreateLandingWizard({
  siteId,
  onClose,
}: {
  siteId: string;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [creating, setCreating] = useState(false);

  // Passo 1 — base
  const [base, setBase] = useState<Base>('blank');
  const [propQuery, setPropQuery] = useState('');
  const [propResults, setPropResults] = useState<Property[]>([]);
  const [propLoading, setPropLoading] = useState(false);
  const [property, setProperty] = useState<Property | null>(null);

  // Passo 2 — nome
  const [name, setName] = useState('');

  // Passo 3 — destino
  const [pipelines, setPipelines] = useState<Opt[]>([]);
  const [stages, setStages] = useState<Opt[]>([]);
  const [labels, setLabels] = useState<Opt[]>([]);
  const [pipelineId, setPipelineId] = useState('');
  const [stageId, setStageId] = useState('');
  const [labelId, setLabelId] = useState('');
  const [routingLoading, setRoutingLoading] = useState(false);

  const slug = useMemo(() => slugify(name), [name]);

  // Busca de imóveis (debounce simples) quando base = property.
  useEffect(() => {
    if (base !== 'property') return;
    let active = true;
    setPropLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await propertiesService.list({ q: propQuery || undefined, per_page: 8 });
        if (active) setPropResults(res.data);
      } finally {
        if (active) setPropLoading(false);
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [base, propQuery]);

  // Carrega pipelines + tags ao entrar no passo 3 (uma vez).
  useEffect(() => {
    if (step !== 3 || pipelines.length) return;
    let active = true;
    setRoutingLoading(true);
    (async () => {
      try {
        const [pRes, lRes] = await Promise.all([pipelinesService.getPipelines(), api.get('/labels')]);
        if (!active) return;
        const ps = (pRes?.data ?? []) as Array<{ id: string; name: string }>;
        setPipelines(ps.map((p) => ({ id: p.id, label: p.name })));
        const ls = ((lRes.data as { data?: Array<{ id: string; title: string }> })?.data ?? []);
        setLabels(ls.map((l) => ({ id: l.id, label: l.title })));
      } finally {
        if (active) setRoutingLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [step, pipelines.length]);

  const onPipeline = async (pid: string) => {
    setPipelineId(pid);
    setStageId('');
    setStages([]);
    if (!pid) return;
    const res = await pipelinesService.getPipelineStages(pid);
    const ss = (res?.data ?? []) as Array<{ id: string; name: string }>;
    setStages(ss.map((s) => ({ id: s.id, label: s.name })));
  };

  const pickProperty = (p: Property) => {
    setProperty(p);
    if (!name.trim()) setName(p.title);
  };

  const canNext =
    step === 1 ? (base === 'blank' || !!property) : step === 2 ? !!name.trim() : true;

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const lp =
        base === 'property' && property
          ? await landingPageService.getOrCreateForProperty(siteId, {
              propertyId: property.id,
              title: name.trim(),
              brandMode: 'development',
            })
          : await landingPageService.createBlank(siteId, name.trim());

      if (pipelineId || labelId) {
        await landingPageService
          .saveRouting(siteId, lp.dto.id, {
            lead_pipeline_id: pipelineId || null,
            lead_stage_id: stageId || null,
            lead_label_id: labelId || null,
          })
          .catch(() => toast.error('Landing criada, mas o roteamento falhou — ajuste na lista.'));
      }

      toast.success('Landing criada! Abrindo o editor…');
      navigate(`/landings/${lp.dto.id}`);
    } catch {
      toast.error('Erro ao criar a landing');
      setCreating(false);
    }
  };

  const Select = ({ label, value, onChange, options, placeholder }: {
    label: string; value: string; onChange: (v: string) => void; options: Opt[]; placeholder: string;
  }) => (
    <label className="block">
      <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border border-border bg-card">
        {/* header */}
        <div className="flex items-start justify-between border-b border-border p-5">
          <div>
            <h2 className="text-base font-semibold">Criar com assistente</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Passo {step} de 3</p>
          </div>
          <button type="button" aria-label="Fechar" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Como você quer começar?</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setBase('blank')}
                  className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left ${base === 'blank' ? 'border-primary bg-primary/5' : 'border-border'}`}
                >
                  <Megaphone className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium">Em branco</span>
                  <span className="text-xs text-muted-foreground">Blocos padrão pra montar do zero.</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBase('property')}
                  className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left ${base === 'property' ? 'border-primary bg-primary/5' : 'border-border'}`}
                >
                  <Building2 className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium">De um imóvel</span>
                  <span className="text-xs text-muted-foreground">Puxa os dados do imóvel cadastrado.</span>
                </button>
              </div>

              {base === 'property' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
                    <Search className="h-4 w-4 flex-none text-muted-foreground" />
                    <input
                      value={propQuery}
                      onChange={(e) => setPropQuery(e.target.value)}
                      placeholder="Buscar imóvel por título ou código"
                      className="w-full bg-transparent text-sm outline-none"
                    />
                  </div>
                  <div className="max-h-56 space-y-1 overflow-y-auto">
                    {propLoading ? (
                      <div className="flex items-center gap-2 px-1 py-3 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Buscando…
                      </div>
                    ) : propResults.length === 0 ? (
                      <p className="px-1 py-3 text-sm text-muted-foreground">Nenhum imóvel encontrado.</p>
                    ) : (
                      propResults.map((p) => {
                        const active = property?.id === p.id;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => pickProperty(p)}
                            className={`flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left ${active ? 'border-primary bg-primary/5' : 'border-border'}`}
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-sm">{p.title}</span>
                              <span className="block truncate font-mono text-xs text-muted-foreground">
                                {p.code}{p.address_city ? ` · ${p.address_city}` : ''}{p.display_price ? ` · ${p.display_price}` : ''}
                              </span>
                            </span>
                            {active && <Check className="h-4 w-4 flex-none text-primary" />}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs text-muted-foreground">Nome da landing</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Campanha Lançamento Setembro"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </label>
              <p className="text-xs text-muted-foreground">
                Link provável: <span className="font-mono">/lp/&lt;cliente&gt;/{slug || '...'}</span>
                {' '}— você confirma o nome final ao publicar.
              </p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Para onde vai o lead dessa landing? (opcional, dá pra ajustar depois)</p>
              {routingLoading ? (
                <div className="flex items-center gap-2 py-4 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
                </div>
              ) : (
                <>
                  <Select label="Pipeline" value={pipelineId} onChange={onPipeline} options={pipelines} placeholder="Sem pipeline (só vira contato)" />
                  {pipelineId && (
                    <Select label="Coluna (estágio)" value={stageId} onChange={setStageId} options={stages} placeholder="Escolha a coluna" />
                  )}
                  <Select label="Tag" value={labelId} onChange={setLabelId} options={labels} placeholder="Sem tag" />
                </>
              )}
            </div>
          )}
        </div>

        {/* footer */}
        <div className="flex items-center justify-between border-t border-border p-4">
          <button
            type="button"
            onClick={() => (step === 1 ? onClose() : setStep((s) => (s - 1) as 1 | 2 | 3))}
            className="rounded-md px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            {step === 1 ? 'Cancelar' : 'Voltar'}
          </button>
          {step < 3 ? (
            <button
              type="button"
              disabled={!canNext}
              onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
            >
              Próximo
            </button>
          ) : (
            <button
              type="button"
              disabled={creating || !name.trim()}
              onClick={handleCreate}
              className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
            >
              {creating && <Loader2 className="h-4 w-4 animate-spin" />} Criar landing
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
