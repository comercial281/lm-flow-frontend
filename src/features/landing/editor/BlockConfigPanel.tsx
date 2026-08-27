import { LeadFormPanel, QuestionPanel } from './LeadFormPanel';
import { useLandingEditorStore } from './landingEditorStore';
import {
  BLOCK_REGISTRY,
  DEFAULT_BLOCK_LAYOUT,
  type BlockConfig,
  type BlockInstance,
} from '@/features/landing/blocks';
import {
  Check,
  Field,
  Group,
  ImageList,
  Num,
  RichText,
  Text,
  TextArea as Area,
  Upload,
  inputCls,
} from './panelKit';

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
        <div key={i} className="space-y-2 rounded-lg border border-border bg-background p-2.5">
          <div className="flex justify-end">
            <button type="button" onClick={() => removeAt(i)} className="text-xs text-muted-foreground hover:text-red-500">excluir</button>
          </div>
          {render(it, (patch) => patchAt(i, patch))}
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, { ...empty }])}
        className="w-full rounded-lg border border-dashed border-border py-2 text-xs font-medium text-foreground hover:border-primary"
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
          <Field label="Botão sobre a capa" hint="Vazio = sem botão. Preenchido, ele leva o lead direto para o formulário.">
            <Text value={c.ctaLabel as string} onChange={(v) => set({ ctaLabel: v })} placeholder="Quero saber mais" />
          </Field>
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
          <Field
            label="Valor do imóvel (R$)"
            hint="Vazio = usa o preço do imóvel vinculado. Sem imóvel vinculado e sem valor aqui, a simulação inteira sai zerada."
          >
            <Num value={c.basePrice as number} onChange={(v) => set({ basePrice: v })} placeholder="850000" />
          </Field>
          <Field label="Entrada (%)"><Num value={c.entradaPct as number} onChange={(v) => set({ entradaPct: v ?? 0 })} /></Field>
          <Field label="Qtd. de reforços"><Num value={c.reforcoQty as number} onChange={(v) => set({ reforcoQty: v ?? 0 })} /></Field>
          <Field label="Reforços (% do total)"><Num value={c.reforcoPct as number} onChange={(v) => set({ reforcoPct: v ?? 0 })} /></Field>
          <Field label="Nas chaves (% do total)"><Num value={c.chavesPct as number} onChange={(v) => set({ chavesPct: v ?? 0 })} /></Field>
          <Field label="Prazo (meses)"><Num value={c.prazoMeses as number} onChange={(v) => set({ prazoMeses: v ?? 1 })} /></Field>
          <Group title="Textos da seção">
            <Field label="Título"><Text value={c.title as string} onChange={(v) => set({ title: v })} /></Field>
            <Field label="Linha de apoio"><Text value={c.subtitle as string} onChange={(v) => set({ subtitle: v })} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Entrada"><Text value={c.entradaLabel as string} onChange={(v) => set({ entradaLabel: v })} /></Field>
              <Field label="Mensais"><Text value={c.mensaisLabel as string} onChange={(v) => set({ mensaisLabel: v })} /></Field>
              <Field label="Reforços"><Text value={c.reforcosLabel as string} onChange={(v) => set({ reforcosLabel: v })} /></Field>
              <Field label="Chaves"><Text value={c.chavesLabel as string} onChange={(v) => set({ chavesLabel: v })} /></Field>
            </div>
            <Field label="Prazo"><Text value={c.prazoLabel as string} onChange={(v) => set({ prazoLabel: v })} /></Field>
            <Field label="Aviso do rodapé" hint="Vazio = o aviso não aparece.">
              <Area value={c.footnote as string} rows={2} onChange={(v) => set({ footnote: v })} />
            </Field>
          </Group>
        </>
      );
    case 'lead_form':
      // O formulário tem painel PRÓPRIO: perguntas, respostas, pontos, desvio e
      // destino não cabem — nem se leem — espremidos junto do resto.
      return <LeadFormPanel block={block} />;
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
          <Field label="Título da seção"><Text value={c.title as string} onChange={(v) => set({ title: v })} /></Field>
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
          <Field
            label="Endereço mostrado na página"
            hint="O que o lead lê. Vazio = o endereço do imóvel vinculado."
          >
            <Text value={c.address as string} onChange={(v) => set({ address: v })} placeholder="Rua das Palmeiras, 320 — Centro" />
          </Field>
          <Field
            label="Região do mapa"
            hint="O mapa mostra a REGIÃO, nunca a rua com número — mesmo que ela esteja no campo de cima. Vazio = bairro e cidade do imóvel."
          >
            <Text value={c.region as string} onChange={(v) => set({ region: v })} placeholder="Centro, Porto Belo, SC" />
          </Field>
          <Check
            checked={(c.showMap as boolean) ?? true}
            onChange={(v) => set({ showMap: v })}
            label="Mostrar o mapa na página"
          />
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
      return (
        <>
          <Field label="Título da seção"><Text value={c.title as string} onChange={(v) => set({ title: v })} /></Field>
          <p className="text-xs text-muted-foreground">Os valores vêm da ficha técnica do imóvel.</p>
        </>
      );
    case 'gallery':
      return (
        <>
          <Field label="Título da seção"><Text value={c.title as string} onChange={(v) => set({ title: v })} /></Field>
          <Field label="De onde vêm as fotos">
            <select className={inputCls} value={(c.source as string) ?? 'property'} onChange={(e) => set({ source: e.target.value })}>
              <option value="property">Fotos do imóvel</option>
              <option value="manual">Fotos que eu enviar</option>
            </select>
          </Field>
          {c.source === 'manual' ? (
            <Field label="Fotos desta seção" hint="Enviadas aqui mesmo. É o caminho para landing de imóvel que não está cadastrado.">
              <ImageList
                items={arr<{ url: string; caption?: string }>('images')}
                onChange={(v) => set({ images: v })}
              />
            </Field>
          ) : (
            <p className="text-xs text-muted-foreground">Mostra as fotos publicadas do imóvel.</p>
          )}
        </>
      );
    case 'rich_text':
      return (
        <>
          <Field label="Título da seção" hint="Vazio = a seção mostra só o texto.">
            <Text value={c.title as string} onChange={(v) => set({ title: v })} />
          </Field>
          <Field label="Texto" hint="Use a barra para negrito, itálico, lista e link. Para criar um link, selecione o trecho e clique no botão de link.">
            <RichText value={c.html as string} onChange={(v) => set({ html: v })} placeholder="Escreva o texto desta seção…" />
          </Field>
          <Field label="Alinhamento">
            <select className={inputCls} value={(c.align as string) ?? 'left'} onChange={(e) => set({ align: e.target.value })}>
              <option value="left">À esquerda</option>
              <option value="center">Centralizado</option>
            </select>
          </Field>
        </>
      );
    default:
      return <p className="text-sm text-muted-foreground">Esta seção é preenchida automaticamente a partir do imóvel.</p>;
  }
}

/**
 * Espaçamento da seção, no fim do painel. Medida em branco = o espaçamento
 * padrão da página, que é o que o campo mostra como sugestão — por isso os
 * campos nascem vazios em vez de já virem preenchidos com o padrão.
 */
function SpacingGroup({ block }: { block: BlockInstance }) {
  const setLayout = useLandingEditorStore((s) => s.setLayout);
  const layout = block.layout ?? {};

  if (block.type === 'sticky_cta') {
    return (
      <Group title="Espaçamento">
        <p className="text-xs text-muted-foreground">
          O botão fixo flutua sobre a página, sempre no mesmo lugar — não há margem para ajustar.
        </p>
      </Group>
    );
  }

  const isHero = block.type === 'hero';
  return (
    <Group title="Espaçamento" hint="Em pixels. Em branco = o espaçamento padrão da página.">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Acima">
          <Num
            value={layout.top}
            onChange={(v) => setLayout(block.id, { top: v })}
            placeholder={String(isHero ? 0 : DEFAULT_BLOCK_LAYOUT.top)}
          />
        </Field>
        <Field label="Abaixo">
          <Num
            value={layout.bottom}
            onChange={(v) => setLayout(block.id, { bottom: v })}
            placeholder={String(isHero ? 0 : DEFAULT_BLOCK_LAYOUT.bottom)}
          />
        </Field>
      </div>
      {isHero ? (
        <p className="text-xs text-muted-foreground">
          A capa ocupa a largura toda da tela, então não tem margem lateral.
        </p>
      ) : (
        <Field label="Laterais">
          <Num
            value={layout.sides}
            onChange={(v) => setLayout(block.id, { sides: v })}
            placeholder={String(DEFAULT_BLOCK_LAYOUT.sides)}
          />
        </Field>
      )}
    </Group>
  );
}

/** Painel da direita: mostra SÓ o que está selecionado — uma seção, ou uma
 *  pergunta do formulário. Antes tudo ficava empilhado numa coluna só (lista de
 *  seções + configurações + aparência + biblioteca), e nada tinha hierarquia. */
export function BlockConfigPanel() {
  const selection = useLandingEditorStore((s) => s.selection);
  const blocks = useLandingEditorStore((s) => s.blocks);

  if (!selection || selection.kind === 'appearance') {
    return (
      <p className="text-sm text-muted-foreground">
        Escolha uma seção na lista à esquerda para configurar.
      </p>
    );
  }

  const blockId = selection.kind === 'block' ? selection.id : selection.blockId;
  const block = blocks.find((b) => b.id === blockId);
  if (!block) {
    return <p className="text-sm text-muted-foreground">Esta seção não existe mais.</p>;
  }

  if (selection.kind === 'question') {
    const config = block.config as BlockConfig<'lead_form'>;
    const step = config.steps.find((st) => st.id === selection.stepId);
    if (!step) return <p className="text-sm text-muted-foreground">Esta pergunta não existe mais.</p>;
    return <QuestionPanel block={block} step={step} />;
  }

  if (block.type === 'lead_form') {
    return (
      <div className="space-y-4">
        <LeadFormPanel block={block} />
        <SpacingGroup block={block} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Group title={BLOCK_REGISTRY[block.type].label} hint={BLOCK_REGISTRY[block.type].description}>
        {/* A `key` troca ao mudar de seção porque o campo de texto com
            formatação é NÃO-controlado: sem remontar, a caixa continuaria
            mostrando o texto da seção anterior. */}
        <Fields key={block.id} block={block} />
      </Group>
      <SpacingGroup block={block} />
    </div>
  );
}
