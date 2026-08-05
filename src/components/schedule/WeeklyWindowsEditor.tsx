import { Input, Label } from '@/components/ui/ds';
import { WEEKDAYS, DEFAULT_WINDOW, type ScheduleWindow } from './scheduleWindows';

/**
 * O editor de janelas semanais, controlado.
 *
 * Nasceu dentro da tela da IA Vendedora e foi extraído quando a roleta passou a
 * precisar da mesma coisa. Mora aqui, e não copiado nos dois lugares, pelo mesmo
 * motivo que o gate do backend foi extraído: a semântica de `days` + janela que
 * atravessa a meia-noite é sutil o bastante para que duas cópias divirjam — e a
 * divergência apareceria como "configurei seg a sex e ele atendeu domingo", que
 * é literalmente o bug que a IA Vendedora carregou por meses.
 */
export function WeeklyWindowsEditor({
  value,
  onChange,
  idPrefix = 'win',
  addLabel = '+ Adicionar outra janela (ex: fechar no almoço)',
}: {
  value: ScheduleWindow[];
  onChange: (windows: ScheduleWindow[]) => void;
  /** Prefixo dos ids dos inputs — precisa ser único quando há dois editores na mesma página. */
  idPrefix?: string;
  addLabel?: string;
}) {
  const windows = value.length ? value : [DEFAULT_WINDOW];

  const patchWindow = (i: number, p: Partial<ScheduleWindow>) =>
    onChange(windows.map((w, idx) => (idx === i ? { ...w, ...p } : w)));

  const addWindow = () => onChange([...windows, { start: '14:00', end: '18:00', days: [1, 2, 3, 4, 5] }]);

  const removeWindow = (i: number) => onChange(windows.filter((_, idx) => idx !== i));

  const toggleDay = (i: number, d: number) => {
    const current = windows[i].days ?? [];
    patchWindow(i, { days: current.includes(d) ? current.filter((x) => x !== d) : [...current, d] });
  };

  return (
    <div className="mt-3 space-y-3">
      {windows.map((w, i) => (
        <div key={i} className="rounded-md border border-sidebar-border p-3 space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Janela {i + 1}</Label>
            {windows.length > 1 && (
              <button
                type="button"
                onClick={() => removeWindow(i)}
                className="text-xs text-destructive hover:underline"
              >
                remover
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-1">
            {WEEKDAYS.map(([d, label]) => {
              const active = (w.days ?? []).includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDay(i, d)}
                  className={`px-2 py-1 rounded text-xs border ${
                    active
                      ? 'bg-primary/10 text-primary border-primary/40'
                      : 'border-sidebar-border text-muted-foreground'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {(w.days ?? []).length === 0 && (
            <p className="text-xs text-muted-foreground">Nenhum dia marcado = vale todos os dias.</p>
          )}

          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <Label htmlFor={`${idPrefix}_start_${i}`} className="text-xs">Das</Label>
              <Input
                id={`${idPrefix}_start_${i}`}
                type="time"
                value={w.start}
                className="mt-1 w-32"
                onChange={(e) => patchWindow(i, { start: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor={`${idPrefix}_end_${i}`} className="text-xs">Até</Label>
              <Input
                id={`${idPrefix}_end_${i}`}
                type="time"
                value={w.end}
                className="mt-1 w-32"
                onChange={(e) => patchWindow(i, { end: e.target.value })}
              />
            </div>
          </div>
        </div>
      ))}

      <button type="button" onClick={addWindow} className="text-xs text-primary hover:underline">
        {addLabel}
      </button>
      <p className="text-xs text-muted-foreground">
        Se o fim for menor que o início, a janela vira a madrugada (ex: 22h às 06h) e conta pelo dia em que ela começa.
      </p>
    </div>
  );
}
