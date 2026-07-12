import { useRef, useState } from 'react';
import api from '@/services/core/api';
import { useLandingEditorStore } from './landingEditorStore';
import { BLOCK_REGISTRY, DEFAULT_LEAD_FORM_STEPS, type BlockInstance } from '@/features/landing/blocks';

/* ── upload genérico (ActiveStorage) → retorna file_url ──────────────── */
async function uploadFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.append('attachment', file);
  const res = await api.post('/uploads', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  return (res.data as { data: { file_url: string } }).data.file_url;
}

/* ── field helpers ──────────────────────────────────────────────────── */
const inputCls =
  'w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-violet-500';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-neutral-400">{label}</span>
      {children}
    </label>
  );
}
function Text({ value, onChange, placeholder }: { value?: string; onChange: (v: string) => void; placeholder?: string }) {
  return <input className={inputCls} value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}
function Area({ value, onChange, rows = 4, placeholder }: { value?: string; onChange: (v: string) => void; rows?: number; placeholder?: string }) {
  return <textarea className={inputCls} rows={rows} value={value ?? ''} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}
function Num({ value, onChange, placeholder }: { value?: number; onChange: (v: number | undefined) => void; placeholder?: string }) {
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

/* Upload de arquivo (áudio/imagem) com preview do estado. */
function Upload({ value, onChange, accept, hint }: { value?: string; onChange: (url: string) => void; accept: string; hint?: string }) {
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
          className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-xs font-medium text-neutral-100 hover:border-violet-500 disabled:opacity-50"
        >
          {busy ? 'Enviando…' : value ? 'Trocar arquivo' : 'Enviar arquivo'}
        </button>
        {value && <button type="button" onClick={() => onChange('')} className="text-xs text-neutral-500 hover:text-red-400">remover</button>}
      </div>
      {err && <p className="text-xs text-red-400">Falha no upload. Tente de novo.</p>}
      {hint && !err && <p className="text-xs text-neutral-500">{hint}</p>}
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setBusy(true); setErr(false);
          try { onChange(await uploadFile(f)); } catch { setErr(true); } finally { setBusy(false); if (ref.current) ref.current.value = ''; }
        }}
      />
    </div>
  );
}

/* Editor de lista genérico. */
function Repeater<T>({ items, onChange, empty, addLabel, render }: {
  items: T[];
  onChange: (next: T[]) => void;
  empty: T;
  addLabel: string;
  render: (item: T, update: (patch: Partial<T>) => void) => React.ReactNode;
}) {
  const patchAt = (i: number, patch: Partial<T>) => onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const removeAt = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="space-y-2 rounded-lg border border-neutral-800 bg-neutral-900/60 p-2.5">
          <div className="flex justify-end">
            <button type="button" onClick={() => removeAt(i)} className="text-xs text-neutral-500 hover:text-red-400">excluir</button>
          </div>
          {render(it, (patch) => patchAt(i, patch))}
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, { ...empty }])}
        className="w-full rounded-lg border border-dashed border-neutral-700 py-2 text-xs font-medium text-neutral-300 hover:border-violet-500"
      >
        + {addLabel}
      </button>
    </div>
  );
}

/* ── por bloco ──────────────────────────────────────────────────────── */
function Fields({ block }: { block: BlockInstance }) {
  const update = useLandingEditorStore((s) => s.updateConfig);
  const c = block.config as Record<string, unknown>;
  const set = (patch: Record<string, unknown>) => update(block.id, patch);
  const arr = <T,>(key: string): T[] => (Array.isArray(c[key]) ? (c[key] as T[]) : []);

  switch (block.type) {
    case 'hero':
      return (
        <>
          <Field label="Selo (badge)"><Text value={c.badge as string} onChange={(v) => set({ badge: v })} placeholder="PRÉ LANÇAMENTO" /></Field>
          <Field label="Título (vazio = nome do imóvel)"><Text value={c.headline as string} onChange={(v) => set({ headline: v })} /></Field>
          <Field label="Subtítulo"><Text value={c.subheadline as string} onChange={(v) => set({ subheadline: v })} /></Field>
          <Field label="Imagem (vazio = capa do imóvel)"><Upload value={c.imageUrl as string} onChange={(v) => set({ imageUrl: v })} accept="image/*" /></Field>
        </>
      );
    case 'price_band':
      return <Field label="Texto da condição"><Text value={c.text as string} onChange={(v) => set({ text: v })} placeholder="10% entrada + saldo em 100x" /></Field>;
    case 'description':
      return (
        <>
          <Field label="Título da seção"><Text value={c.title as string} onChange={(v) => set({ title: v })} /></Field>
          <Field label="Texto (vazio = descrição do imóvel)"><Area value={c.html as string} rows={5} onChange={(v) => set({ html: v })} /></Field>
        </>
      );
    case 'amenities':
      return (
        <>
          <Field label="Título"><Text value={c.title as string} onChange={(v) => set({ title: v })} /></Field>
          <Field label="Itens (um por linha)">
            <Area value={((c.items as string[]) ?? []).join('\n')} rows={6} onChange={(v) => set({ items: v.split('\n').map((s) => s.trim()).filter(Boolean) })} />
          </Field>
        </>
      );
    case 'video':
      return (
        <>
          <Field label="Título"><Text value={c.title as string} onChange={(v) => set({ title: v })} /></Field>
          <Field label="URL do vídeo (embed)"><Text value={c.url as string} onChange={(v) => set({ url: v })} placeholder="https://www.youtube.com/embed/..." /></Field>
        </>
      );
    case 'finance_simulator':
      return (
        <>
          <Field label="Entrada (%)"><Num value={c.entradaPct as number} onChange={(v) => set({ entradaPct: v ?? 0 })} /></Field>
          <Field label="Qtd. de reforços"><Num value={c.reforcoQty as number} onChange={(v) => set({ reforcoQty: v ?? 0 })} /></Field>
          <Field label="Prazo (meses)"><Num value={c.prazoMeses as number} onChange={(v) => set({ prazoMeses: v ?? 1 })} /></Field>
        </>
      );
    case 'lead_form': {
      const steps = (Array.isArray(c.steps) ? (c.steps as { question: string; options: string[] }[]) : DEFAULT_LEAD_FORM_STEPS);
      const weights = (c.answerWeights as Record<string, number>) ?? {};
      const disq = (c.disqualifyingAnswers as string[]) ?? [];
      const setWeight = (opt: string, v: number | undefined) =>
        set({ answerWeights: { ...weights, [opt]: v ?? 0 } });
      const toggleDisq = (opt: string, on: boolean) =>
        set({ disqualifyingAnswers: on ? [...disq.filter((o) => o !== opt), opt] : disq.filter((o) => o !== opt) });
      return (
        <>
          <Field label="Título do formulário"><Text value={c.title as string} onChange={(v) => set({ title: v })} /></Field>
          <Field label="Nome do especialista"><Text value={c.specialistName as string} onChange={(v) => set({ specialistName: v })} /></Field>
          <Field label="Texto do botão"><Text value={c.ctaLabel as string} onChange={(v) => set({ ctaLabel: v })} /></Field>

          <div className="mt-2 rounded-lg border border-neutral-800 p-3">
            <p className="mb-1 text-xs font-semibold text-neutral-200">Qualificação do lead</p>
            <p className="mb-3 text-xs text-neutral-500">
              Dê pontos por resposta e marque as que desqualificam. Score abaixo da nota de corte = desqualificado.
            </p>
            <Field label="Nota de corte (score mínimo p/ qualificar)">
              <Num value={c.cutoff as number} onChange={(v) => set({ cutoff: v ?? 0 })} placeholder="0" />
            </Field>
            <div className="mt-2 space-y-3">
              {steps.map((st, si) => (
                <div key={si}>
                  <p className="mb-1 text-xs font-medium text-neutral-300">{st.question}</p>
                  <div className="space-y-1.5">
                    {st.options.map((opt) => (
                      <div key={opt} className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-xs text-neutral-200">{opt}</span>
                        <input
                          type="number"
                          value={weights[opt] ?? ''}
                          placeholder="0"
                          onChange={(e) => setWeight(opt, e.target.value === '' ? undefined : Number(e.target.value))}
                          className="w-16 rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-100 outline-none focus:border-violet-500"
                          title="Pontos dessa resposta"
                        />
                        <label className="flex flex-none items-center gap-1 text-xs text-neutral-400" title="Escolher essa resposta desqualifica o lead">
                          <input type="checkbox" checked={disq.includes(opt)} onChange={(e) => toggleDisq(opt, e.target.checked)} />
                          desqualifica
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      );
    }
    case 'sticky_cta':
      return (
        <>
          <Field label="Texto do botão fixo"><Text value={c.label as string} onChange={(v) => set({ label: v })} /></Field>
          <Field label="Ação">
            <select className={inputCls} value={(c.action as string) ?? 'open_form'} onChange={(e) => set({ action: e.target.value })}>
              <option value="open_form">Abrir formulário</option>
              <option value="whatsapp">Abrir WhatsApp</option>
            </select>
          </Field>
          {c.action === 'whatsapp' && (
            <Field label="WhatsApp (com DDD)"><Text value={c.whatsappPhone as string} onChange={(v) => set({ whatsappPhone: v })} placeholder="5511999999999" /></Field>
          )}
        </>
      );
    case 'broker_audio':
      return (
        <>
          <Field label="Título"><Text value={c.label as string} onChange={(v) => set({ label: v })} placeholder="Explicação do plano de pagamento" /></Field>
          <Field label="Áudio (grave e suba o arquivo)"><Upload value={c.audioUrl as string} onChange={(v) => set({ audioUrl: v })} accept="audio/*" hint="MP3, WAV ou M4A. O corretor grava e envia aqui." /></Field>
        </>
      );
    case 'consultant':
      return (
        <>
          <Field label="Nome do corretor"><Text value={c.name as string} onChange={(v) => set({ name: v })} /></Field>
          <Field label="CRECI"><Text value={c.creci as string} onChange={(v) => set({ creci: v })} /></Field>
          <Field label="WhatsApp"><Text value={c.phone as string} onChange={(v) => set({ phone: v })} placeholder="5511999999999" /></Field>
          <Field label="Foto"><Upload value={c.photoUrl as string} onChange={(v) => set({ photoUrl: v })} accept="image/*" /></Field>
        </>
      );
    case 'construction_progress':
      return (
        <>
          <Field label="Percentual concluído (%)"><Num value={c.percent as number} onChange={(v) => set({ percent: v ?? 0 })} /></Field>
          <Field label="Marcos da obra">
            <Repeater<{ label: string; date?: string }>
              items={arr('milestones')} onChange={(v) => set({ milestones: v })} empty={{ label: '', date: '' }} addLabel="marco"
              render={(it, u) => (
                <>
                  <Text value={it.label} onChange={(v) => u({ label: v })} placeholder="Fundação" />
                  <Text value={it.date} onChange={(v) => u({ date: v })} placeholder="Concluída / Dez/2027" />
                </>
              )}
            />
          </Field>
        </>
      );
    case 'valuation_history':
      return (
        <>
          <Field label="Título"><Text value={c.title as string} onChange={(v) => set({ title: v })} /></Field>
          <Field label="Pontos (ano → valor R$/m²)">
            <Repeater<{ label: string; value: number }>
              items={arr('points')} onChange={(v) => set({ points: v })} empty={{ label: '', value: 0 }} addLabel="ponto"
              render={(it, u) => (
                <div className="grid grid-cols-2 gap-2">
                  <Text value={it.label} onChange={(v) => u({ label: v })} placeholder="2025" />
                  <Num value={it.value} onChange={(v) => u({ value: v ?? 0 })} placeholder="9500" />
                </div>
              )}
            />
          </Field>
        </>
      );
    case 'trust_badges':
      return (
        <Field label="Selos de confiança">
          <Repeater<{ imageUrl?: string; label?: string }>
            items={arr('items')} onChange={(v) => set({ items: v })} empty={{ imageUrl: '', label: '' }} addLabel="selo"
            render={(it, u) => (
              <>
                <Text value={it.label} onChange={(v) => u({ label: v })} placeholder="ISO 9001 / +50 obras" />
                <Upload value={it.imageUrl} onChange={(v) => u({ imageUrl: v })} accept="image/*" />
              </>
            )}
          />
        </Field>
      );
    case 'track_record':
      return (
        <>
          <Field label="Título"><Text value={c.title as string} onChange={(v) => set({ title: v })} /></Field>
          <Field label="Obras entregues">
            <Repeater<{ title: string; year?: string; imageUrl?: string }>
              items={arr('items')} onChange={(v) => set({ items: v })} empty={{ title: '', year: '', imageUrl: '' }} addLabel="obra"
              render={(it, u) => (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <Text value={it.title} onChange={(v) => u({ title: v })} placeholder="Ocean Tower" />
                    <Text value={it.year} onChange={(v) => u({ year: v })} placeholder="2023" />
                  </div>
                  <Upload value={it.imageUrl} onChange={(v) => u({ imageUrl: v })} accept="image/*" />
                </>
              )}
            />
          </Field>
        </>
      );
    case 'apartment_types':
      return (
        <>
          <Field label="Título"><Text value={c.title as string} onChange={(v) => set({ title: v })} /></Field>
          <Field label="Tipos de planta">
            <Repeater<{ name: string; areaM2?: number; price?: number; planUrl?: string }>
              items={arr('items')} onChange={(v) => set({ items: v })} empty={{ name: '', areaM2: undefined, price: undefined, planUrl: '' }} addLabel="tipo"
              render={(it, u) => (
                <>
                  <Text value={it.name} onChange={(v) => u({ name: v })} placeholder="3 suítes — 165m²" />
                  <div className="grid grid-cols-2 gap-2">
                    <Num value={it.areaM2} onChange={(v) => u({ areaM2: v })} placeholder="Área m²" />
                    <Num value={it.price} onChange={(v) => u({ price: v })} placeholder="Preço R$" />
                  </div>
                  <Upload value={it.planUrl} onChange={(v) => u({ planUrl: v })} accept="image/*" hint="Planta do apto" />
                </>
              )}
            />
          </Field>
        </>
      );
    case 'map':
      return (
        <>
          <Field label="Título"><Text value={c.title as string} onChange={(v) => set({ title: v })} /></Field>
          <Field label="Pontos de interesse (nome → minutos)">
            <Repeater<{ label: string; minutes: number }>
              items={arr('pois')} onChange={(v) => set({ pois: v })} empty={{ label: '', minutes: 0 }} addLabel="ponto"
              render={(it, u) => (
                <div className="grid grid-cols-[1fr_80px] gap-2">
                  <Text value={it.label} onChange={(v) => u({ label: v })} placeholder="Praia Central" />
                  <Num value={it.minutes} onChange={(v) => u({ minutes: v ?? 0 })} placeholder="min" />
                </div>
              )}
            />
          </Field>
        </>
      );
    case 'tech_sheet':
      return <p className="text-sm text-neutral-400">Preenchida automaticamente com a ficha técnica do imóvel.</p>;
    case 'gallery':
      return <p className="text-sm text-neutral-400">Mostra as fotos publicadas do imóvel automaticamente.</p>;
    default:
      return <p className="text-sm text-neutral-400">Esta seção é preenchida automaticamente a partir do imóvel.</p>;
  }
}

export function BlockConfigPanel() {
  const selectedId = useLandingEditorStore((s) => s.selectedId);
  const block = useLandingEditorStore((s) => s.blocks.find((b) => b.id === selectedId) ?? null);
  if (!block) return <p className="text-sm text-neutral-400">Selecione uma seção para configurar.</p>;
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-neutral-100">{BLOCK_REGISTRY[block.type].label}</h4>
      <Fields block={block} />
    </div>
  );
}
