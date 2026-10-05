import { useState } from 'react';
import { Input, Label } from '@/components/ui/ds';
import { SlidersHorizontal } from 'lucide-react';
import { type SalesAgent } from '@/services/salesAgents/salesAgentsService';
import { Seletor } from '@/components/base/Seletor';

// ---------------- Ajustes avançados ----------------

const MODEL_OPTIONS: [string, string][] = [
  ['claude-sonnet-4-5-20250929', 'Equilibrada — Sonnet (padrão, recomendado)'],
  ['claude-haiku-4-5-20251001', 'Mais rápida e barata — Haiku'],
];

// Criatividade amigável -> temperatura do modelo.
const TEMP_OPTIONS: [number, string, string][] = [
  [0.2, 'Mais objetiva', 'Respostas curtas e diretas, segue o script à risca.'],
  [0.4, 'Equilibrada (padrão)', 'Boa mistura de naturalidade e foco.'],
  [0.7, 'Mais criativa', 'Respostas mais soltas e variadas.'],
];

function nearestTemp(v: number): number {
  return TEMP_OPTIONS.reduce((best, [t]) => (Math.abs(t - v) < Math.abs(best - v) ? t : best), TEMP_OPTIONS[1][0]);
}

export function AdvancedSection({
  agent, onChange, onSave,
}: {
  agent: SalesAgent;
  onChange: (a: SalesAgent) => void;
  onSave: (patch: Partial<SalesAgent>) => void;
}) {
  const [open, setOpen] = useState(false);
  const modelKnown = MODEL_OPTIONS.some(([id]) => id === agent.model);
  const tempSel = nearestTemp(agent.temperature ?? 0.4);

  return (
    <div className="pt-2 border-t border-sidebar-border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <SlidersHorizontal className="h-4 w-4" />
        Ajustes avançados
        <span className="text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-4 pl-1">
          <div>
            <Label htmlFor="adv_model">Modelo de IA (inteligência x custo)</Label>
            <Seletor
              id="adv_model"
              value={modelKnown ? agent.model : ''}
              onChange={(e) => onSave({ model: e.target.value })}
              className="mt-1 w-full rounded-md border border-sidebar-border bg-background px-3 py-2 text-sm"
            >
              {!modelKnown && <option value="">Personalizado: {agent.model}</option>}
              {MODEL_OPTIONS.map(([id, label]) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </Seletor>
            <p className="text-xs text-muted-foreground mt-1">Sonnet é o padrão. Haiku responde mais rápido e custa menos, mas é menos esperta.</p>
          </div>

          <div>
            <Label htmlFor="adv_temp">Criatividade das respostas</Label>
            <Seletor
              id="adv_temp"
              value={tempSel}
              onChange={(e) => onSave({ temperature: Number(e.target.value) })}
              className="mt-1 w-full rounded-md border border-sidebar-border bg-background px-3 py-2 text-sm"
            >
              {TEMP_OPTIONS.map(([t, label, help]) => (
                <option key={t} value={t}>{label} — {help}</option>
              ))}
            </Seletor>
          </div>

          <div>
            <Label htmlFor="adv_ctx" className="text-xs">Quanto da base de conhecimento ela lê por resposta</Label>
            <Input
              id="adv_ctx"
              type="number"
              min={1000}
              max={100000}
              step={1000}
              value={agent.max_context_tokens ?? 8000}
              className="mt-1 w-40"
              onChange={(e) => onChange({ ...agent, max_context_tokens: Number(e.target.value) })}
              onBlur={() => onSave({ max_context_tokens: Math.max(1000, Number(agent.max_context_tokens) || 8000) })}
            />
            <p className="text-xs text-muted-foreground mt-1">Maior = lê mais da base (respostas mais completas), porém mais caro. Padrão 8000.</p>
          </div>
        </div>
      )}
    </div>
  );
}
