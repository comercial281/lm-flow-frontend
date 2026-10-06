// Dias da semana como pílulas de marcar. Morava no assistente da IA (que saiu na
// entrega 2 da IA Vendedora); a janela de horário de visita também usa.
import { WEEKDAYS } from './scheduleWindows';

export function PilulasDias({ value, onChange }: { value: number[]; onChange: (dias: number[]) => void }) {
  const toggle = (d: number) => onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d]);
  return (
    <div className="flex flex-wrap gap-1">
      {WEEKDAYS.map(([d, label]) => (
        <button
          key={d}
          type="button"
          onClick={() => toggle(d)}
          aria-pressed={value.includes(d)}
          className={`px-2.5 py-1 rounded text-xs border ${value.includes(d) ? 'bg-primary/10 text-primary border-primary/40' : 'border-sidebar-border text-muted-foreground'}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
