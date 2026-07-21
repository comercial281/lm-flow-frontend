import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { publicOnboardingService, type OnboardingField } from '@/services/superAdmin/onboardingFormsService';

/**
 * Página PÚBLICA do formulário de onboarding (Épico E). Sem login: o cliente abre
 * o link, preenche e envia; a resposta cai no super-admin da Leal Mídia.
 */
export default function PublicOnboardingForm() {
  const { token = '' } = useParams();
  const [form, setForm] = useState<{ id: string; name: string; description?: string; fields: OnboardingField[] } | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setForm(await publicOnboardingService.get(token));
      } catch {
        setError('Formulário não encontrado ou desativado.');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const visibleFields = useMemo(() => {
    if (!form) return [];
    return form.fields.filter(f => shouldShow(f, values));
  }, [form, values]);

  const setVal = (name: string, v: unknown) => setValues(prev => ({ ...prev, [name]: v }));

  const submit = async () => {
    // valida obrigatórios visíveis
    for (const f of visibleFields) {
      if (f.required && (values[f.name] === undefined || values[f.name] === '' || (Array.isArray(values[f.name]) && (values[f.name] as unknown[]).length === 0))) {
        setError(`Preencha: ${f.label}`);
        return;
      }
    }
    setError('');
    setSending(true);
    try {
      const payload: Record<string, unknown> = {};
      for (const f of visibleFields) if (values[f.name] !== undefined) payload[f.name] = values[f.name];
      await publicOnboardingService.submit(token, payload);
      setSent(true);
    } catch {
      setError('Não consegui enviar. Tente de novo.');
    } finally {
      setSending(false);
    }
  };

  if (loading) return <Shell><p className="text-center text-slate-500">Carregando...</p></Shell>;
  if (error && !form) return <Shell><p className="text-center text-slate-500">{error}</p></Shell>;
  if (sent) return (
    <Shell>
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-600">✓</div>
        <h1 className="text-lg font-semibold text-slate-800">Recebido, obrigado!</h1>
        <p className="mt-1 text-sm text-slate-500">Suas respostas foram enviadas.</p>
      </div>
    </Shell>
  );

  return (
    <Shell>
      <h1 className="text-xl font-semibold text-slate-800">{form?.name}</h1>
      {form?.description && <p className="mt-1 text-sm text-slate-500">{form.description}</p>}
      <div className="mt-5 space-y-4">
        {visibleFields.map(f => (
          <FieldInput key={f.id} field={f} value={values[f.name]} onChange={v => setVal(f.name, v)} />
        ))}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          onClick={submit}
          disabled={sending}
          className="w-full rounded-lg bg-gradient-to-r from-[#7C3AED] to-[#9333EA] px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {sending ? 'Enviando...' : 'Enviar'}
        </button>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">{children}</div>
    </div>
  );
}

function FieldInput({ field, value, onChange }: { field: OnboardingField; value: unknown; onChange: (v: unknown) => void }) {
  const base = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-[#7C3AED] focus:outline-none';
  const label = (
    <label className="text-sm font-medium text-slate-700">
      {field.label}{field.required && <span className="text-red-500"> *</span>}
    </label>
  );
  const opts = field.options ?? [];

  switch (field.field_type) {
    case 'textarea':
      return <div>{label}<textarea className={base} rows={4} value={(value as string) ?? ''} onChange={e => onChange(e.target.value)} placeholder={field.placeholder ?? ''} /></div>;
    case 'select':
      return (
        <div>{label}
          <select className={base} value={(value as string) ?? ''} onChange={e => onChange(e.target.value)}>
            <option value="">Selecione...</option>
            {opts.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      );
    case 'multiselect':
    case 'checkbox': {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div>{label}
          <div className="mt-1 space-y-1">
            {opts.map(o => (
              <label key={o} className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={arr.includes(o)} onChange={e => onChange(e.target.checked ? [...arr, o] : arr.filter(x => x !== o))} />
                {o}
              </label>
            ))}
          </div>
        </div>
      );
    }
    case 'boolean':
      return (
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)} /> {field.label}
        </label>
      );
    case 'number':
      return <div>{label}<input type="number" className={base} value={(value as string) ?? ''} onChange={e => onChange(e.target.value)} /></div>;
    case 'date':
      return <div>{label}<input type="date" className={base} value={(value as string) ?? ''} onChange={e => onChange(e.target.value)} /></div>;
    case 'email':
      return <div>{label}<input type="email" className={base} value={(value as string) ?? ''} onChange={e => onChange(e.target.value)} placeholder={field.placeholder ?? ''} /></div>;
    case 'file':
      // Upload real fica pra v2; por ora aceita nome/descrição do arquivo.
      return <div>{label}<input type="text" className={base} value={(value as string) ?? ''} onChange={e => onChange(e.target.value)} placeholder="Descreva ou cole o link do arquivo" /></div>;
    default:
      return <div>{label}<input type="text" className={base} value={(value as string) ?? ''} onChange={e => onChange(e.target.value)} placeholder={field.placeholder ?? ''} /></div>;
  }
}

// Lógica condicional: mostra o campo só se a condição bater.
function shouldShow(field: OnboardingField, values: Record<string, unknown>): boolean {
  const c = field.conditional as { field?: string; op?: string; value?: string } | undefined;
  if (!c || !c.field) return true;
  const target = values[c.field];
  switch (c.op) {
    case 'filled': return target !== undefined && target !== '' && target !== null;
    case 'neq': return String(target ?? '') !== String(c.value ?? '');
    case 'eq':
    default: return String(target ?? '') === String(c.value ?? '');
  }
}
