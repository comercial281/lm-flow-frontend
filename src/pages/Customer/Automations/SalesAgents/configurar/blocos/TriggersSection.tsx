import { useEffect, useRef, useState } from 'react';
import { Button, Input } from '@/components/ui/ds';
import { Plus, Trash2 } from 'lucide-react';
import { type SalesAgent, type SalesAgentTrigger, type SalesAgentTriggerType, type SalesAgentTriggerMatchMode } from '@/services/salesAgents/salesAgentsService';
import { pipelinesService } from '@/services/pipelines/pipelinesService';
import { leadAdsFormsService, type LeadAdsFormConfig } from '@/services/leadAds/leadAdsFormsService';
import { formOptions, formTriggerNotice, toggleForm } from '@/features/salesAgents/formTrigger';
import { Seletor } from '@/components/base/Seletor';
import BotoesDeEscolha from '@/components/base/BotoesDeEscolha';
import { type PipelineOpt, type StageOpt } from '../../configuracao/comum';

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

// "Todas as condições" (E) ou "Qualquer uma" (OU). A palavra antiga, se houver,
// tem a frase dela no Canal (fraseDaPalavraAntiga): aqui não se fala dela.
const MODOS_DE_COMBINAR: { valor: SalesAgentTriggerMatchMode; rotulo: string }[] = [
  { valor: 'all', rotulo: 'Todas as condições' },
  { valor: 'any', rotulo: 'Qualquer uma' },
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
  // ⚠️ Gravação na hora (06/10/2026): `onSave` grava no servidor. Escolha de lista,
  // caixinha de formulário, adicionar e remover gravam no clique; o que se DIGITA
  // (palavra, etiqueta, código) fica neste rascunho e grava ao sair do campo —
  // gravar por tecla mandaria um PATCH por letra.
  const [lista, setLista] = useState<SalesAgentTrigger[]>(agent.triggers ?? []);
  const digitando = useRef(false);
  useEffect(() => { if (!digitando.current) setLista(agent.triggers ?? []); }, [agent.triggers]);
  const triggers = lista;
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

  const commit = (next: SalesAgentTrigger[]) => { digitando.current = false; setLista(next); onSave({ triggers: next }); };
  const update = (i: number, patch: Partial<SalesAgentTrigger>) => commit(triggers.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  const digitar = (i: number, patch: Partial<SalesAgentTrigger>) => {
    digitando.current = true;
    setLista(triggers.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  };
  const sairDoCampo = () => { if (digitando.current) commit(lista); };
  const remove = (i: number) => commit(triggers.filter((_, idx) => idx !== i));
  const add = () => commit([...triggers, newTrigger('keyword')]);

  const matchMode = agent.trigger_match_mode ?? 'any';

  return (
    <div className="pt-2 border-t border-sidebar-border">
      <p className="mb-2 text-sm text-muted-foreground">Sem nenhuma condição, ela atende todo lead do número.</p>

      {triggers.length > 1 && (
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted-foreground">Atender quando</span>
          <BotoesDeEscolha rotulo="Combinar condições" valor={matchMode} opcoes={MODOS_DE_COMBINAR}
            aoEscolher={(m) => onSave({ trigger_match_mode: m })} />
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
                  onChange={(e) => digitar(i, { value: e.target.value })} onBlur={sairDoCampo} />
              </>
            )}

            {t.type === 'tag' && (
              <Input className="flex-1 min-w-40" placeholder="etiqueta (ex: vip)" value={t.value ?? ''}
                onChange={(e) => digitar(i, { value: e.target.value })} onBlur={sairDoCampo} />
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
                    onChange={(e) => digitar(i, { code: e.target.value })} onBlur={sairDoCampo} />
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
                    Atenção: com "Qualquer uma", a condição de origem/funil/imóvel desta lista
                    continua deixando a IA entrar nos leads das outras campanhas. Para valer só estes
                    formulários, remova aquela condição.
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

            <button onClick={() => remove(i)} className="ml-auto text-muted-foreground hover:text-red-500" aria-label="Remover condição" title="Remover condição">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <Button size="sm" variant="outline" onClick={add} className="mt-2">
        <Plus className="h-4 w-4 mr-1" /> Adicionar condição
      </Button>
    </div>
  );
}
