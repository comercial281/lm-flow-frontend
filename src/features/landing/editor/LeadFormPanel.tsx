import { useEffect, useState } from 'react';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { NativeSelect } from '@/components/ui/native-select';
import api from '@/services/core/api';
import { pipelinesService } from '@/services/pipelines/pipelinesService';
import type { BlockConfig, BlockInstance, LeadFormStep } from '@/features/landing/blocks';
import { useLandingEditorStore, type AnswerDestination } from './landingEditorStore';
import { Field, Group, Num, Text, TextArea, inputCls } from './panelKit';

/* ------------------------------------------------------------------ */
/* Funis, colunas e etiquetas — carregados uma vez por sessão do editor */
/* ------------------------------------------------------------------ */

interface Opt {
  id: string;
  label: string;
}

/** Cache de módulo: o painel de destino aparece dentro de CADA opção de
 *  resposta. Buscar a lista de funis por opção renderizada faria uma pergunta
 *  com cinco alternativas disparar cinco vezes as mesmas requisições. */
let routingCache: { pipelines: Opt[]; labels: Opt[] } | null = null;
const stagesCache = new Map<string, Opt[]>();

function useRoutingOptions() {
  const [pipelines, setPipelines] = useState<Opt[]>(routingCache?.pipelines ?? []);
  const [labels, setLabels] = useState<Opt[]>(routingCache?.labels ?? []);

  useEffect(() => {
    if (routingCache) return;
    let active = true;
    (async () => {
      try {
        const [pRes, lRes] = await Promise.all([pipelinesService.getPipelines(), api.get('/labels')]);
        const ps = ((pRes?.data ?? []) as Array<{ id: string; name: string }>).map((p) => ({ id: p.id, label: p.name }));
        const ls = (((lRes.data as { data?: Array<{ id: string; title: string }> })?.data) ?? []).map((l) => ({
          id: l.id,
          label: l.title,
        }));
        routingCache = { pipelines: ps, labels: ls };
        if (!active) return;
        setPipelines(ps);
        setLabels(ls);
      } catch {
        // Sem a lista, o destino por resposta simplesmente não é oferecido —
        // o resto da edição da pergunta continua funcionando.
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return { pipelines, labels };
}

function useStages(pipelineId?: string | null) {
  const [stages, setStages] = useState<Opt[]>(pipelineId ? (stagesCache.get(pipelineId) ?? []) : []);

  useEffect(() => {
    if (!pipelineId) return setStages([]);
    const cached = stagesCache.get(pipelineId);
    if (cached) return setStages(cached);
    let active = true;
    (async () => {
      try {
        const res = await pipelinesService.getPipelineStages(pipelineId);
        const ss = ((res?.data ?? []) as Array<{ id: string; name: string }>).map((s) => ({ id: s.id, label: s.name }));
        stagesCache.set(pipelineId, ss);
        if (active) setStages(ss);
      } catch {
        if (active) setStages([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [pipelineId]);

  return stages;
}

/* ------------------------------------------------------------------ */
/* Painel de UMA pergunta                                              */
/* ------------------------------------------------------------------ */

export function QuestionPanel({ block, step }: { block: BlockInstance; step: LeadFormStep }) {
  const config = block.config as BlockConfig<'lead_form'>;
  const updateStep = useLandingEditorStore((s) => s.updateStep);
  const addOption = useLandingEditorStore((s) => s.addOption);
  const updateOption = useLandingEditorStore((s) => s.updateOption);
  const removeOption = useLandingEditorStore((s) => s.removeOption);

  const index = config.steps.findIndex((s) => s.id === step.id);
  // Só perguntas ABAIXO desta podem ser destino de desvio — pular pra trás
  // prenderia o lead num laço.
  const laterSteps = config.steps.slice(index + 1);

  return (
    <div className="space-y-4">
      <Group title="A pergunta">
        <Field label="Texto da pergunta">
          <TextArea
            rows={2}
            value={step.question}
            placeholder="Ex: Quando você pretende comprar?"
            onChange={(v) => updateStep(block.id, step.id, { question: v })}
          />
        </Field>
      </Group>

      <Group
        title="Respostas"
        hint="Cada resposta pode valer pontos, desqualificar o lead na hora, mandar o formulário para outro ponto e escolher para onde o lead vai."
      >
        <div className="space-y-3">
          {step.options.map((opt) => (
            <OptionRow
              key={opt.id}
              blockId={block.id}
              stepId={step.id}
              option={opt}
              laterSteps={laterSteps}
              onChange={(patch) => updateOption(block.id, step.id, opt.id, patch)}
              onRemove={() => removeOption(block.id, step.id, opt.id)}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => addOption(block.id, step.id)}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary"
        >
          <Plus className="h-3.5 w-3.5" /> Adicionar resposta
        </button>
      </Group>
    </div>
  );
}

function OptionRow({
  blockId,
  stepId,
  option,
  laterSteps,
  onChange,
  onRemove,
}: {
  blockId: string;
  stepId: string;
  option: LeadFormStep['options'][number];
  laterSteps: LeadFormStep[];
  onChange: (patch: Partial<LeadFormStep['options'][number]>) => void;
  onRemove: () => void;
}) {
  const answerDestination = useLandingEditorStore((s) => s.answerDestination);
  const setAnswerDestination = useLandingEditorStore((s) => s.setAnswerDestination);
  // Assinar `settings` mantém a linha viva quando o destino muda: sem isto o
  // select continuaria mostrando o valor anterior até a próxima renderização.
  useLandingEditorStore((s) => s.settings);
  const dest = answerDestination(option.id);

  const { pipelines, labels } = useRoutingOptions();
  const stages = useStages(dest.pipeline_id);

  const nextValue =
    option.next?.kind === 'question'
      ? `question:${option.next.id}`
      : option.next?.kind === 'finish'
        ? `finish:${option.next.screen}`
        : (option.next?.kind ?? 'next');

  const onNextChange = (value: string) => {
    if (value === 'next') return onChange({ next: undefined });
    if (value === 'contact') return onChange({ next: { kind: 'contact' } });
    if (value.startsWith('finish:')) {
      return onChange({ next: { kind: 'finish', screen: value.slice(7) as 'thankyou' | 'disqualified' } });
    }
    onChange({ next: { kind: 'question', id: value.slice(9) } });
  };

  const patchDest = (patch: AnswerDestination) => {
    const merged = { ...dest, ...patch };
    // Trocar de funil zera a coluna: coluna é de UM funil, e manter a anterior
    // deixaria gravado um par que não existe.
    if (patch.pipeline_id !== undefined) merged.stage_id = null;
    setAnswerDestination(option.id, merged);
  };

  return (
    <div className="rounded-lg border border-border bg-background p-2.5">
      <div className="flex items-start gap-2">
        <GripVertical className="mt-2 h-3.5 w-3.5 flex-none text-muted-foreground/50" />
        <div className="min-w-0 flex-1 space-y-2">
          {/* Um campo por resposta, e não um texto com uma opção por linha: no
              formato antigo cada tecla reescrevia o campo inteiro, então espaço
              no fim sumia e Enter não criava alternativa nova. */}
          <input
            className={inputCls}
            value={option.text}
            placeholder="Texto da resposta"
            onChange={(e) => onChange({ text: e.target.value })}
          />
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              Pontos
              <input
                type="number"
                className="w-16 rounded-md border border-input bg-background px-2 py-1 text-xs outline-none focus:border-primary"
                value={option.weight ?? ''}
                placeholder="0"
                onChange={(e) => onChange({ weight: e.target.value === '' ? undefined : Number(e.target.value) })}
              />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={option.disqualifies ?? false}
                onChange={(e) => onChange({ disqualifies: e.target.checked || undefined })}
              />
              Desqualifica o lead
            </label>
            <button
              type="button"
              onClick={onRemove}
              aria-label="Remover resposta"
              className="ml-auto text-muted-foreground hover:text-red-500"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs text-muted-foreground">Se responder isto, vai para</span>
            <NativeSelect value={nextValue} onChange={(e) => onNextChange(e.target.value)}>
              <option value="next">A próxima pergunta</option>
              {laterSteps.map((s, i) => (
                <option key={s.id} value={`question:${s.id}`}>
                  Pular para: {s.question || `Pergunta ${i + 1} adiante`}
                </option>
              ))}
              <option value="contact">Os dados de contato</option>
              <option value="finish:thankyou">Encerrar na tela de obrigado</option>
              <option value="finish:disqualified">Encerrar na tela de desqualificado</option>
            </NativeSelect>
          </label>

          <div className="rounded-md border border-dashed border-border p-2">
            <span className="mb-1.5 block text-xs font-medium text-foreground">E o lead cai em</span>
            <p className="mb-2 text-[11px] leading-snug text-muted-foreground">
              Deixe em branco para usar o destino da landing. Quando o lead responde mais de uma
              pergunta com destino, vale a última que ele respondeu.
            </p>
            <div className="space-y-1.5">
              <NativeSelect
                value={dest.pipeline_id ?? ''}
                onChange={(e) => patchDest({ pipeline_id: e.target.value || null })}
              >
                <option value="">Funil da landing</option>
                {pipelines.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </NativeSelect>
              {dest.pipeline_id && (
                <NativeSelect
                  value={dest.stage_id ?? ''}
                  onChange={(e) => patchDest({ stage_id: e.target.value || null })}
                >
                  <option value="">Primeira coluna do funil</option>
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </NativeSelect>
              )}
              <NativeSelect
                value={dest.label_id ?? ''}
                onChange={(e) => patchDest({ label_id: e.target.value || null })}
              >
                <option value="">Etiqueta da landing</option>
                {labels.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
        </div>
      </div>
      <input type="hidden" data-step={stepId} data-block={blockId} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Painel do formulário (o bloco inteiro, sem as perguntas)            */
/* ------------------------------------------------------------------ */

export function LeadFormPanel({ block }: { block: BlockInstance }) {
  const config = block.config as BlockConfig<'lead_form'>;
  const updateConfig = useLandingEditorStore((s) => s.updateConfig);
  const set = (patch: Partial<BlockConfig<'lead_form'>>) => updateConfig(block.id, patch);

  return (
    <div className="space-y-4">
      <Group title="Chamada">
        <Field label="Título do formulário">
          <Text value={config.title} onChange={(v) => set({ title: v })} />
        </Field>
        <Field label="Nome do especialista">
          <Text value={config.specialistName} onChange={(v) => set({ specialistName: v })} />
        </Field>
        <Field label="Texto do botão de envio">
          <Text value={config.ctaLabel} onChange={(v) => set({ ctaLabel: v })} />
        </Field>
      </Group>

      <Group
        title="Perguntas"
        hint="As perguntas aparecem na lista à esquerda. Clique numa delas para editar as respostas, os pontos e o destino."
      >
        <p className="text-xs text-muted-foreground">
          {config.steps.length === 0
            ? 'Nenhuma pergunta — o formulário pede só os dados de contato.'
            : `${config.steps.length} ${config.steps.length === 1 ? 'pergunta' : 'perguntas'} antes dos dados de contato.`}
        </p>
      </Group>

      <Group
        title="Qualificação"
        hint="Soma os pontos das respostas. Abaixo da nota de corte, o lead é tratado como desqualificado."
      >
        <Field label="Nota de corte">
          <Num value={config.cutoff} onChange={(v) => set({ cutoff: v ?? 0 })} placeholder="0" />
        </Field>
      </Group>

      <Group title="Depois do envio">
        <Field label="Quando o lead é aprovado">
          <Text value={config.thankyouTitle} onChange={(v) => set({ thankyouTitle: v })} />
        </Field>
        <Field label="Mensagem">
          <TextArea rows={2} value={config.thankyouMessage} onChange={(v) => set({ thankyouMessage: v })} />
        </Field>
        <Field
          label="WhatsApp do botão “Fura a fila”"
          hint="Com DDD e país (ex: 5511999999999). Sem número, o botão não aparece."
        >
          <Text
            value={config.whatsappPhone}
            placeholder="5511999999999"
            onChange={(v) => set({ whatsappPhone: v })}
          />
        </Field>
        <Field label="Quando o lead é desqualificado">
          <Text value={config.disqualifiedTitle} onChange={(v) => set({ disqualifiedTitle: v })} />
        </Field>
        <Field label="Mensagem">
          <TextArea rows={3} value={config.disqualifiedMessage} onChange={(v) => set({ disqualifiedMessage: v })} />
        </Field>
        <Field
          label="Onde mostrar o resultado"
          hint="Página própria dá um endereço separado, que o Pixel mede como visita própria."
        >
          <NativeSelect value={config.resultMode} onChange={(e) => set({ resultMode: e.target.value as 'inline' | 'url' })}>
            <option value="inline">Na mesma página</option>
            <option value="url">Numa página própria</option>
          </NativeSelect>
        </Field>
      </Group>
    </div>
  );
}
