import { Label } from '@/components/ui/ds';
import { type SalesAgent, type ActiveHours, type ActiveHoursMode, type ActiveHoursWindow } from '@/services/salesAgents/salesAgentsService';
import { WeeklyWindowsEditor } from '@/components/schedule/WeeklyWindowsEditor';
import { Toggle } from '../comum';
import { OutOfHoursSection } from './OutOfHoursSection';

// ---------------- Horário de atuação ----------------

const SCHEDULE_OPTIONS: [ActiveHoursMode, string, string][] = [
  ['outside_business', 'Fora do horário comercial (18h às 07h)', 'Só responde à noite/madrugada — quando não tem ninguém no time.'],
  ['custom', 'Horário personalizado', 'Você escolhe a janela em que ela responde.'],
];

const DEFAULT_WINDOW: ActiveHoursWindow = { start: '08:00', end: '18:00', days: [1, 2, 3, 4, 5] };

export function ScheduleSection({ agent, onSave }: { agent: SalesAgent; onSave: (patch: Partial<SalesAgent>) => void }) {
  const hours: ActiveHours = agent.active_hours ?? {};
  const mode: ActiveHoursMode = hours.mode ?? 'always';
  const enabled = mode !== 'always';
  const windows: ActiveHoursWindow[] = hours.windows?.length ? hours.windows : [DEFAULT_WINDOW];

  const commit = (patch: Partial<ActiveHours>) =>
    onSave({ active_hours: { ...hours, tz: hours.tz ?? 'America/Sao_Paulo', ...patch } });

  const toggleEnabled = (on: boolean) => commit({ mode: on ? 'custom' : 'always', windows: on ? windows : hours.windows });
  const setMode = (m: ActiveHoursMode) =>
    commit({ mode: m, windows: m === 'custom' && !hours.windows?.length ? [DEFAULT_WINDOW] : hours.windows });

  return (
    <div className="pt-2 border-t border-sidebar-border">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label>Horário de atuação</Label>
          <p className="text-xs text-muted-foreground">Desligado = a IA responde a qualquer hora (24h).</p>
        </div>
        <Toggle on={enabled} onChange={toggleEnabled} rotulo="horário de atuação" />
      </div>

      {enabled && (
        <div className="grid grid-cols-1 gap-2 mt-2">
          {SCHEDULE_OPTIONS.map(([m, title, help]) => (
            <label
              key={m}
              className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer ${
                mode === m ? 'border-primary bg-primary/5' : 'border-sidebar-border'
              }`}
            >
              <input type="radio" name="schedule_mode" className="mt-1" checked={mode === m} onChange={() => setMode(m)} />
              <div>
                <div className="text-sm font-medium">{title}</div>
                <div className="text-xs text-muted-foreground">{help}</div>
              </div>
            </label>
          ))}
        </div>
      )}

      {/* Várias janelas, cada uma com seus dias. Antes só existia UMA janela e os
          dias nem apareciam: "segunda a sexta das 8h às 18h, fechado no almoço"
          era impossível de configurar.

          O editor mora em components/schedule desde que a roleta passou a ter
          horário também — duas cópias da regra de dias/meia-noite divergiriam. */}
      {enabled && mode === 'custom' && (
        <div className="mt-2">
          <button
            type="button"
            className="text-xs text-primary hover:underline"
            onClick={() => commit({ mode: 'custom', windows: [DEFAULT_WINDOW] })}
          >
            Aplicar horário comercial padrão (08h às 18h, seg a sex)
          </button>
        </div>
      )}
      {enabled && mode === 'custom' && (
        <WeeklyWindowsEditor
          value={windows}
          idPrefix="ia_win"
          onChange={(next) => commit({ mode: 'custom', windows: next })}
        />
      )}

      {enabled && <OutOfHoursSection agent={agent} onSave={onSave} />}
    </div>
  );
}
