import { useEffect, useState } from 'react';
import { Button, Input, Label } from '@/components/ui/ds';
import { Plus, Trash2, SlidersHorizontal } from 'lucide-react';
import { type SalesAgent, type SalesAgentTrigger, type SalesAgentTriggerType, type SalesAgentTriggerMatchMode } from '@/services/salesAgents/salesAgentsService';
import { pipelinesService } from '@/services/pipelines/pipelinesService';
import { leadAdsFormsService, type LeadAdsFormConfig } from '@/services/leadAds/leadAdsFormsService';
import { formOptions, formTriggerNotice, toggleForm } from '@/features/salesAgents/formTrigger';
import { Seletor } from '@/components/base/Seletor';
import { type PipelineOpt, type StageOpt } from '../comum';

// ---------------- Gatilhos de ativação (multi) ----------------

const TRIGGER_TYPES: { value: SalesAgentTriggerType; label: string }[] = [
  // Primeiro da lista porque é o que quase todo mundo quer: contato e lead não
  // são a mesma coisa — toda mensagem de número desconhecido vira contato, mas
  // só quem entra no funil é lead. É a definição que o resto do sistema já usa.
  { value: 'pipeline', label: 'É lead (tem card no funil)' },
  { value: 'keyword', label: 'Contém/é igual a palavra' },
  { value: 'origin', label: 'Origem do lead' },
  { value: 'form', label: 'Veio de um destes formulários' },
  { value: 'property', label: 'Imóvel (código / form)' },
  { value: 'pipeline_stage', label: 'Coluna de funil' },
  { value: 'tag', label: 'Tem a etiqueta' },
];

const TRIGGER_MATCH_MODE_OPTIONS: [SalesAgentTriggerMatchMode, string, string][] = [
  ['any', 'Qualquer gatilho ativa (OU)', 'Basta UM dos gatilhos abaixo bater pra IA entrar na conversa.'],
  ['all', 'Todos os gatilhos juntos (E)', 'Só ativa quando TODOS os gatilhos abaixo baterem ao mesmo tempo — pra combinar mais de uma condição.'],
];

function newTrigger(type: SalesAgentTriggerType): SalesAgentTrigger {
  switch (type) {
    case 'keyword': return { type, value: '', match_type: 'contains' };
    case 'origin': return { type, mode: 'ads' };
    case 'property': return { type, mode: 'any' };
    case 'pipeline_stage': return { type, pipeline_id: '', stage_id: '' };
    // pipeline_id vazio = qualquer funil, que é o caso normal.
    case 'pipeline': return { type, mode: 'any', pipeline_id: '' };
    case 'tag': return { type, value: '' };
    case 'form': return { type, form_ids: [] };
  }
}

export function TriggersSection({ agent, onSave }: { agent: SalesAgent; onSave: (patch: Partial<SalesAgent>) => void }) {
  const triggers = agent.triggers ?? [];
  const [pipelines, setPipelines] = useState<PipelineOpt[]>([]);
  const [stagesByPipeline, setStagesByPipeline] = useState<Record<string, StageOpt[]>>({});

  // Formulários de Origem → Formulários. Leitura de fundo: falha só esconde a lista.
  const [formConfigs, setFormConfigs] = useState<LeadAdsFormConfig[]>([]);
  const hasFormTrigger = triggers.some((t) => t.type === 'form');
  useEffect(() => {
    if (!hasFormTrigger) return;
    leadAdsFormsService.getAll().then(setFormConfigs).catch(() => setFormConfigs([]));
  }, [hasFormTrigger]);


  useEffect(() => {
    pipelinesService.getPipelines()
      .then((res: unknown) => {
        const raw = (res as { data?: PipelineOpt[] }).data ?? (Array.isArray(res) ? (res as PipelineOpt[]) : []);
        setPipelines(raw.map((p) => ({ id: String(p.id), name: p.name })));
      })
      .catch(() => setPipelines([]));
  }, []);

  const loadStages = (pipelineId: string) => {
    if (!pipelineId || stagesByPipeline[pipelineId]) return;
    pipelinesService.getPipelineStages(pipelineId)
      .then((res: unknown) => {
        const raw = (res as { data?: StageOpt[] }).data ?? (Array.isArray(res) ? (res as StageOpt[]) : []);
        setStagesByPipeline((prev) => ({ ...prev, [pipelineId]: raw.map((s) => ({ id: String(s.id), name: s.name })) }));
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    triggers.forEach((t) => { if (t.type === 'pipeline_stage' && t.pipeline_id) loadStages(t.pipeline_id); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggers]);

  const commit = (next: SalesAgentTrigger[]) => onSave({ triggers: next });
  const update = (i: number, patch: Partial<SalesAgentTrigger>) => commit(triggers.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  const remove = (i: number) => commit(triggers.filter((_, idx) => idx !== i));
  const add = () => commit([...triggers, newTrigger('keyword')]);

  const matchMode = agent.trigger_match_mode ?? 'any';

  return (
    <div className="pt-2 border-t border-sidebar-border">
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="h-4 w-4 text-primary" />
        <Label>Gatilhos de ativação (avançado)</Label>
      </div>
      <p className="text-xs text-muted-foreground mt-1 mb-2">
        Sem nenhum gatilho = atende todo lead do canal (além da palavra-chave acima, que sempre restringe sozinha).
      </p>

      {triggers.length > 1 && (
        <div className="grid grid-cols-1 gap-2 mb-2">
          {TRIGGER_MATCH_MODE_OPTIONS.map(([m, title, help]) => (
            <label key={m} className={`flex items-start gap-3 p-2 rounded-md border cursor-pointer text-sm ${
              matchMode === m ? 'border-primary bg-primary/5' : 'border-sidebar-border'
            }`}>
              <input type="radio" name="trigger_match_mode" className="mt-1"
                checked={matchMode === m} onChange={() => onSave({ trigger_match_mode: m })} />
              <div>
                <div className="font-medium">{title}</div>
                <div className="text-xs text-muted-foreground">{help}</div>
              </div>
            </label>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {triggers.map((t, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 p-2 rounded-md border border-sidebar-border">
            <Seletor
              value={t.type}
              onChange={(e) => commit(triggers.map((tr, idx) => (idx === i ? newTrigger(e.target.value as SalesAgentTriggerType) : tr)))}
              className="w-72 max-w-full rounded-md border border-sidebar-border bg-background px-2 py-1 text-sm"
            >
              {TRIGGER_TYPES.map((tt) => <option key={tt.value} value={tt.value}>{tt.label}</option>)}
            </Seletor>

            {t.type === 'keyword' && (
              <>
                <Seletor value={t.match_type ?? 'contains'} onChange={(e) => update(i, { match_type: e.target.value as 'contains' | 'equals' })}
                  className="w-36 rounded-md border border-sidebar-border bg-background px-2 py-1 text-sm">
                  <option value="contains">Contém</option>
                  <option value="equals">É exatamente</option>
                </Seletor>
                <Input className="flex-1 min-w-40" placeholder="palavra (ex: fluxoimob)" value={t.value ?? ''}
                  onChange={(e) => update(i, { value: e.target.value })} onBlur={() => commit(triggers)} />
              </>
            )}

            {t.type === 'tag' && (
              <Input className="flex-1 min-w-40" placeholder="etiqueta (ex: vip)" value={t.value ?? ''}
                onChange={(e) => update(i, { value: e.target.value })} onBlur={() => commit(triggers)} />
            )}

            {t.type === 'origin' && (
              <Seletor value={t.mode ?? 'ads'} onChange={(e) => update(i, { mode: e.target.value })}
                className="w-64 max-w-full rounded-md border border-sidebar-border bg-background px-2 py-1 text-sm">
                <option value="ads">Só anúncios (FB/IG/Google)</option>
                <option value="all">Todos os leads</option>
              </Seletor>
            )}

            {t.type === 'property' && (
              <>
                <Seletor value={t.mode ?? 'any'} onChange={(e) => update(i, { mode: e.target.value })}
                  className="w-[26rem] max-w-full rounded-md border border-sidebar-border bg-background px-2 py-1 text-sm">
                  <option value="any">Qualquer imóvel (veio de form/anúncio de imóvel)</option>
                  <option value="code">Imóvel específico (código)</option>
                </Seletor>
                {t.mode === 'code' && (
                  <Input className="w-32" placeholder="código" value={t.code ?? ''}
                    onChange={(e) => update(i, { code: e.target.value })} onBlur={() => commit(triggers)} />
                )}
              </>
            )}

            {t.type === 'form' && (
              <div className="w-full space-y-1">
                <div className="text-xs text-muted-foreground">
                  A IA só entra na conversa do lead que preencheu um dos formulários marcados. Lead de
                  outra campanha — inclusive anúncio que leva direto ao WhatsApp — fica de fora. Vale
                  também para o formulário novo que o Facebook cria a cada campanha, desde que ele seja
                  reconhecido pela palavra-chave do imóvel em Origem → Formulários.
                </div>
                <div className="flex flex-col gap-1">
                  {formOptions(formConfigs, t.form_ids).map((o) => (
                    <label key={o.formId} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={o.checked}
                        onChange={() => update(i, { form_ids: toggleForm(t.form_ids, o.formId) })} />
                      <span>{o.label}</span>
                      {o.inactive && <span className="text-xs text-muted-foreground">(desativado)</span>}
                      {o.orphan && <span className="text-xs text-amber-600">(não está mais cadastrado)</span>}
                    </label>
                  ))}
                </div>
                {matchMode === 'any' && triggers.some((o) => o.type === 'origin' || o.type === 'pipeline' || o.type === 'property') && (
                  <div className="text-xs text-amber-600">
                    Atenção: com "Qualquer gatilho ativa (OU)", o gatilho de origem/funil/imóvel desta lista
                    continua deixando a IA entrar nos leads das outras campanhas. Para valer só estes
                    formulários, remova aquele gatilho.
                  </div>
                )}
                {formTriggerNotice(t.form_ids, formConfigs.length) && (
                  <div className="text-xs text-amber-600">{formTriggerNotice(t.form_ids, formConfigs.length)}</div>
                )}
              </div>
            )}

            {t.type === 'pipeline' && (
              <>
                <Seletor
                  value={t.pipeline_id ?? ''}
                  onChange={(e) => update(i, { pipeline_id: e.target.value })}
                  className="w-64 max-w-full rounded-md border border-sidebar-border bg-background px-2 py-1 text-sm"
                >
                  <option value="">Qualquer funil</option>
                  {pipelines.map((p) => <option key={p.id} value={p.id}>{`Só o funil ${p.name}`}</option>)}
                </Seletor>
                <span className="text-xs text-muted-foreground">
                  Card arquivado não conta — lead que saiu do funil e volta a escrever fica pro humano.
                </span>
              </>
            )}

            {t.type === 'pipeline_stage' && (
              <>
                <Seletor value={t.pipeline_id ?? ''} onChange={(e) => { loadStages(e.target.value); update(i, { pipeline_id: e.target.value, stage_id: '' }); }}
                  className="w-48 rounded-md border border-sidebar-border bg-background px-2 py-1 text-sm">
                  <option value="">— funil —</option>
                  {pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Seletor>
                <Seletor value={t.stage_id ?? ''} onChange={(e) => update(i, { stage_id: e.target.value })} disabled={!t.pipeline_id}
                  className="w-48 rounded-md border border-sidebar-border bg-background px-2 py-1 text-sm">
                  <option value="">— coluna —</option>
                  {(stagesByPipeline[t.pipeline_id ?? ''] ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Seletor>
              </>
            )}

            <button onClick={() => remove(i)} className="ml-auto text-muted-foreground hover:text-red-500" title="Remover gatilho">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <Button size="sm" variant="outline" onClick={add} className="mt-2">
        <Plus className="h-4 w-4 mr-1" /> Adicionar gatilho
      </Button>
    </div>
  );
}
