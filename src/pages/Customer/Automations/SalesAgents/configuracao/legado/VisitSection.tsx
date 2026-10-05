import { Button, Input, Label, Textarea } from '@/components/ui/ds';
import { Plus, Trash2 } from 'lucide-react';
import { type SalesAgent, type SalesMethod } from '@/services/salesAgents/salesAgentsService';
import { Seletor } from '@/components/base/Seletor';
import { Toggle } from '../comum';
import { VisitWindows } from './VisitWindows';

// ---------------- Qualificação, método de venda e visita ----------------

const SALES_METHOD_OPTIONS: [SalesMethod, string, string][] = [
  ['consultative', 'Consultiva + SPIN (recomendado)', 'Descobre a história e a dor da pessoa antes de oferecer. A visita nasce natural, sem empurrão.'],
  ['spin', 'SPIN estruturado', 'Conduz mais explicitamente pelas etapas de descoberta (situação, problema, implicação, solução).'],
  ['direct', 'Direta', 'Lead já quente: confirma o essencial e vai direto pro agendamento da visita.'],
];

export function VisitSection({
  agent, onChange, onSave,
}: {
  agent: SalesAgent;
  onChange: (a: SalesAgent) => void;
  onSave: (patch: Partial<SalesAgent>) => void;
}) {
  const method = agent.sales_method ?? 'consultative';
  const booking = agent.booking_enabled ?? true;
  const examples = agent.example_conversations ?? [];

  const updateExample = (i: number, field: 'lead' | 'resposta', value: string) => {
    const next = examples.map((ex, idx) => (idx === i ? { ...ex, [field]: value } : ex));
    onChange({ ...agent, example_conversations: next });
  };
  const commitExamples = () => {
    const clean = (agent.example_conversations ?? [])
      .map((ex) => ({ lead: (ex.lead ?? '').trim(), resposta: (ex.resposta ?? '').trim() }))
      .filter((ex) => ex.resposta);
    onSave({ example_conversations: clean });
  };
  const addExample = () => onSave({ example_conversations: [...examples, { lead: '', resposta: '' }] });
  const removeExample = (i: number) => onSave({ example_conversations: examples.filter((_, idx) => idx !== i) });

  return (
    <div className="pt-2 border-t border-sidebar-border space-y-4">
      <div>
        <Label htmlFor="sales_method">Como a IA conduz a venda</Label>
        <Seletor
          id="sales_method"
          value={method}
          onChange={(e) => onSave({ sales_method: e.target.value as SalesMethod })}
          className="mt-1 w-full rounded-md border border-sidebar-border bg-background px-3 py-2 text-sm"
        >
          {SALES_METHOD_OPTIONS.map(([id, label]) => (
            <option key={id} value={id}>{label}</option>
          ))}
        </Seletor>
        <p className="text-xs text-muted-foreground mt-1">
          {SALES_METHOD_OPTIONS.find(([id]) => id === method)?.[2]}
        </p>
      </div>

      <div>
        <Label htmlFor="social_proof">Prova social / cases (a IA usa pra gerar confiança, sem inventar)</Label>
        <Textarea
          id="social_proof"
          rows={3}
          placeholder="Ex: A família Souza fechou o apê dos sonhos com a gente em 2 semanas."
          value={agent.social_proof ?? ''}
          onChange={(e) => onChange({ ...agent, social_proof: e.target.value })}
          onBlur={() => onSave({ social_proof: (agent.social_proof ?? '').trim() || null })}
        />
        <p className="text-xs text-muted-foreground mt-1">A IA só cita o que estiver aqui (nunca inventa número ou case).</p>
      </div>

      <div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">Agendar visita sozinha</div>
            <div className="text-xs text-muted-foreground">
              Quando o lead topar, a IA marca a visita direto (com dia e hora), cria o agendamento e dispara os lembretes. Desligado = ela passa pro corretor marcar.
            </div>
          </div>
          <Toggle on={!!booking} onChange={(v) => onSave({ booking_enabled: v })} rotulo="agendar visita sozinha" />
        </div>
        {booking && (
          <div className="mt-3 pl-7 space-y-3">
            <div>
              <Label htmlFor="visit_dur" className="text-xs">Duração da visita (minutos)</Label>
              <Input id="visit_dur" type="number" min={15} max={480} value={agent.visit_duration_minutes ?? 60} className="mt-1 w-28"
                onChange={(e) => onChange({ ...agent, visit_duration_minutes: Number(e.target.value) })}
                onBlur={() => onSave({ visit_duration_minutes: Math.max(15, Number(agent.visit_duration_minutes) || 60) })} />
            </div>
            <VisitWindows agent={agent} onSave={onSave} />
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between gap-2">
          <Label>Exemplos de conversas que funcionaram (a IA imita o tom)</Label>
          <Button type="button" variant="outline" size="sm" onClick={addExample}>
            <Plus className="h-3 w-3 mr-1" /> Adicionar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1 mb-2">
          Cole trechos reais que deram certo: o que o lead disse e como um bom corretor respondeu. A IA aprende o ritmo e o jeito humano (não copia literal).
        </p>
        {examples.length === 0 && (
          <p className="text-xs text-muted-foreground italic">Nenhum exemplo ainda. Opcional, mas ajuda muito a humanizar.</p>
        )}
        <div className="space-y-3">
          {examples.map((ex, i) => (
            <div key={i} className="rounded-md border border-sidebar-border p-2 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Exemplo {i + 1}</span>
                <button
                  type="button"
                  onClick={() => removeExample(i)}
                  aria-label={`Excluir exemplo ${i + 1}`}
                  title={`Excluir exemplo ${i + 1}`}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <Input
                placeholder="O que o lead disse (ex: quero um 2 quartos até 300 mil)"
                value={ex.lead ?? ''}
                onChange={(e) => updateExample(i, 'lead', e.target.value)}
                onBlur={commitExamples}
              />
              <Textarea
                rows={2}
                placeholder="Como o corretor respondeu (ex: boa! tá procurando pra morar ou investir?)"
                value={ex.resposta ?? ''}
                onChange={(e) => updateExample(i, 'resposta', e.target.value)}
                onBlur={commitExamples}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
