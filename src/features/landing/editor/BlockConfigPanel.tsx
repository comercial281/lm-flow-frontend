import { useLandingEditorStore } from './landingEditorStore';
import { BLOCK_REGISTRY, type BlockInstance } from '@/features/landing/blocks';

/* small field helpers ------------------------------------------------ */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-neutral-400">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  'w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-violet-500';

function Text({
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

function Num({ value, onChange }: { value?: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      className={inputCls}
      value={value ?? 0}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}

/* per-block fields --------------------------------------------------- */

function Fields({ block }: { block: BlockInstance }) {
  const update = useLandingEditorStore((s) => s.updateConfig);
  const c = block.config as Record<string, unknown>;
  const set = (patch: Record<string, unknown>) => update(block.id, patch);

  switch (block.type) {
    case 'hero':
      return (
        <>
          <Field label="Selo (badge)">
            <Text value={c.badge as string} onChange={(v) => set({ badge: v })} placeholder="PRÉ LANÇAMENTO" />
          </Field>
          <Field label="Título (vazio = nome do imóvel)">
            <Text value={c.headline as string} onChange={(v) => set({ headline: v })} />
          </Field>
          <Field label="Imagem (URL, vazio = capa do imóvel)">
            <Text value={c.imageUrl as string} onChange={(v) => set({ imageUrl: v })} />
          </Field>
        </>
      );
    case 'price_band':
      return (
        <Field label="Texto da condição">
          <Text value={c.text as string} onChange={(v) => set({ text: v })} placeholder="10% entrada + saldo em 100x" />
        </Field>
      );
    case 'description':
      return (
        <>
          <Field label="Título da seção">
            <Text value={c.title as string} onChange={(v) => set({ title: v })} />
          </Field>
          <Field label="Texto (vazio = descrição do imóvel)">
            <textarea
              className={inputCls}
              rows={5}
              value={(c.html as string) ?? ''}
              onChange={(e) => set({ html: e.target.value })}
            />
          </Field>
        </>
      );
    case 'amenities':
      return (
        <>
          <Field label="Título">
            <Text value={c.title as string} onChange={(v) => set({ title: v })} />
          </Field>
          <Field label="Itens (um por linha)">
            <textarea
              className={inputCls}
              rows={6}
              value={((c.items as string[]) ?? []).join('\n')}
              onChange={(e) => set({ items: e.target.value.split('\n').filter(Boolean) })}
            />
          </Field>
        </>
      );
    case 'video':
      return (
        <Field label="URL do vídeo (embed)">
          <Text value={c.url as string} onChange={(v) => set({ url: v })} placeholder="https://www.youtube.com/embed/..." />
        </Field>
      );
    case 'finance_simulator':
      return (
        <>
          <Field label="Entrada (%)">
            <Num value={c.entradaPct as number} onChange={(v) => set({ entradaPct: v })} />
          </Field>
          <Field label="Qtd. de reforços">
            <Num value={c.reforcoQty as number} onChange={(v) => set({ reforcoQty: v })} />
          </Field>
          <Field label="Prazo (meses)">
            <Num value={c.prazoMeses as number} onChange={(v) => set({ prazoMeses: v })} />
          </Field>
        </>
      );
    case 'lead_form':
      return (
        <>
          <Field label="Título do formulário">
            <Text value={c.title as string} onChange={(v) => set({ title: v })} />
          </Field>
          <Field label="Texto do botão">
            <Text value={c.ctaLabel as string} onChange={(v) => set({ ctaLabel: v })} />
          </Field>
        </>
      );
    case 'sticky_cta':
      return (
        <Field label="Texto do botão fixo">
          <Text value={c.label as string} onChange={(v) => set({ label: v })} />
        </Field>
      );
    default:
      return (
        <p className="text-sm text-neutral-400">
          Esta seção é preenchida automaticamente a partir do imóvel. Sem opções extras.
        </p>
      );
  }
}

export function BlockConfigPanel() {
  const selectedId = useLandingEditorStore((s) => s.selectedId);
  const block = useLandingEditorStore((s) => s.blocks.find((b) => b.id === selectedId) ?? null);

  if (!block) {
    return <p className="text-sm text-neutral-400">Selecione uma seção para configurar.</p>;
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-neutral-100">{BLOCK_REGISTRY[block.type].label}</h4>
      <Fields block={block} />
    </div>
  );
}
