/**
 * Peças compartilhadas pelas etapas do assistente. Só componentes aqui (Fast
 * Refresh do Vite): constantes e funções moram em `assistenteOpcoes.ts`.
 */
import type { ReactNode } from 'react';
import { Input, Label, Textarea } from '@/components/ui/ds';
import { WEEKDAYS } from '@/components/schedule/scheduleWindows';

export function Secao({ titulo, ajuda, children }: { titulo: string; ajuda?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-base font-semibold">{titulo}</h3>
        {ajuda && <p className="text-sm text-muted-foreground mt-0.5">{ajuda}</p>}
      </div>
      {children}
    </section>
  );
}

export function Campo({
  id, label, ajuda, children,
}: { id?: string; label: string; ajuda?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {ajuda && <p className="text-xs text-muted-foreground">{ajuda}</p>}
    </div>
  );
}

export function CampoTexto({
  id, label, ajuda, value, onChange, placeholder, rows,
}: {
  id: string; label: string; ajuda?: ReactNode; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <Campo id={id} label={label} ajuda={ajuda}>
      {rows && rows > 1 ? (
        <Textarea id={id} rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <Input id={id} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
    </Campo>
  );
}

/** Uma resposta por linha. O texto cru fica no estado da tela; a lista sai limpa. */
export function CampoLinhas({
  id, label, ajuda, value, onChange, placeholder, rows = 4,
}: {
  id: string; label: string; ajuda?: ReactNode; value: string[]; onChange: (v: string[]) => void; placeholder?: string; rows?: number;
}) {
  return (
    <Campo id={id} label={label} ajuda={ajuda}>
      <Textarea
        id={id}
        rows={rows}
        value={value.join('\n')}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value.split('\n'))}
      />
    </Campo>
  );
}

export function CartaoEscolha<T extends string>({
  opcoes, value, onChange, nome, colunas = 1,
}: {
  opcoes: { value: T; title: string; desc: string }[];
  value: T;
  onChange: (v: T) => void;
  nome: string;
  colunas?: 1 | 2 | 3;
}) {
  const grid = colunas === 3 ? 'md:grid-cols-3' : colunas === 2 ? 'md:grid-cols-2' : '';
  return (
    <div className={`grid grid-cols-1 gap-2 ${grid}`} role="radiogroup" aria-label={nome}>
      {opcoes.map((opt) => {
        const escolhido = value === opt.value;
        return (
          <button
            key={opt.value || 'vazio'}
            type="button"
            role="radio"
            aria-checked={escolhido}
            onClick={() => onChange(opt.value)}
            className={`rounded-lg border p-3 text-left transition-colors ${escolhido ? 'border-primary bg-primary/5' : 'border-sidebar-border hover:bg-muted/40'}`}
          >
            <div className="text-sm font-medium">{opt.title}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{opt.desc}</div>
          </button>
        );
      })}
    </div>
  );
}

export function Interruptor({ on, onChange, titulo, desc, id }: {
  on: boolean; onChange: (v: boolean) => void; titulo: string; desc?: ReactNode; id?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-sidebar-border p-3">
      <div>
        <div className="text-sm font-medium" id={id ? `${id}_label` : undefined}>{titulo}</div>
        {desc && <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby={id ? `${id}_label` : undefined}
        onClick={() => onChange(!on)}
        className={`relative mt-0.5 inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${on ? 'bg-primary' : 'bg-muted-foreground/40'}`}
      >
        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}

export function LinhaMarcar({ checked, onChange, titulo, desc }: {
  checked: boolean; onChange: (v: boolean) => void; titulo: string; desc?: ReactNode;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer py-1">
      <input type="checkbox" className="mt-1" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <div>
        <div className="text-sm font-medium">{titulo}</div>
        {desc && <div className="text-xs text-muted-foreground">{desc}</div>}
      </div>
    </label>
  );
}

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

export function Seletor({
  id, value, onChange, opcoes, vazio,
}: {
  id: string; value: string; onChange: (v: string) => void; opcoes: { value: string; label: string }[]; vazio?: string;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-sidebar-border bg-background px-3 py-2 text-sm"
    >
      {vazio !== undefined && <option value="">{vazio}</option>}
      {opcoes.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
