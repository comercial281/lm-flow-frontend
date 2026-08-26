import { useRef, useState } from 'react';
import api from '@/services/core/api';

/**
 * Peças dos painéis de configuração do editor.
 *
 * Todas as cores saem dos tokens do design system (background, card, border,
 * foreground, muted-foreground, primary) — o editor seguia preto fixo enquanto
 * o resto do LM Flow é claro, e o painel destoava de todas as outras telas.
 * A PRÉVIA continua com as cores da landing: aquelas são a página sendo
 * editada, não a interface.
 */

export const inputCls =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

/** Bloco de campos com título — é o que dá ao painel a leitura em grupos, em
 *  vez de uma pilha única de campos sem hierarquia. */
export function Group({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground">{title}</h4>
      {hint && <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{hint}</p>}
      <div className="mt-2.5 space-y-2.5">{children}</div>
    </section>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] leading-snug text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function Text({
  value,
  onChange,
  placeholder,
}: {
  value?: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      className={inputCls}
      value={value ?? ''}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function TextArea({
  value,
  onChange,
  rows = 4,
  placeholder,
}: {
  value?: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <textarea
      className={inputCls}
      rows={rows}
      value={value ?? ''}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function Num({
  value,
  onChange,
  placeholder,
}: {
  value?: number;
  onChange: (v: number | undefined) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="number"
      className={inputCls}
      value={value ?? ''}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
    />
  );
}

/** Upload genérico (ActiveStorage) → devolve file_url. */
async function uploadFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.append('attachment', file);
  const res = await api.post('/uploads', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  return (res.data as { data: { file_url: string } }).data.file_url;
}

export function Upload({
  value,
  onChange,
  accept,
  hint,
}: {
  value?: string;
  onChange: (url: string) => void;
  accept: string;
  hint?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const isAudio = accept.includes('audio');
  return (
    <div className="space-y-2">
      {value && !isAudio && <img src={value} alt="" className="h-20 w-full rounded-lg object-cover" />}
      {value && isAudio && <audio controls src={value} className="w-full" />}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => ref.current?.click()}
          disabled={busy}
          className="rounded-md border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:border-primary disabled:opacity-50"
        >
          {busy ? 'Enviando…' : value ? 'Trocar arquivo' : 'Enviar arquivo'}
        </button>
        {value && (
          <button type="button" onClick={() => onChange('')} className="text-xs text-muted-foreground hover:text-red-500">
            remover
          </button>
        )}
      </div>
      {err && <p className="text-xs text-red-500">Falha no upload. Tente de novo.</p>}
      {hint && !err && <p className="text-xs text-muted-foreground">{hint}</p>}
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setBusy(true);
          setErr(false);
          try {
            onChange(await uploadFile(f));
          } catch {
            setErr(true);
          } finally {
            setBusy(false);
            if (ref.current) ref.current.value = '';
          }
        }}
      />
    </div>
  );
}
