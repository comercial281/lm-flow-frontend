import { Component, type CSSProperties, type ReactNode } from 'react';
import type { BlockInstance } from './contract';
import { BLOCK_COMPONENTS, LeadFormBlock } from './components';
import { formularioDaCapa } from './formularioDaCapa';
import {
  DEFAULT_LANDING_THEME,
  type LandingProperty,
  type LandingTheme,
  type LeadSubmitPayload,
  type LeadSubmitResult,
  themeToCssVars,
} from './render-types';

/** A broken block must never take down the whole page (NFR6). */
class BlockBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export interface BlockRendererProps {
  blocks: BlockInstance[];
  property?: LandingProperty | null;
  theme?: Partial<LandingTheme>;
  /** Editor preview hint: render hidden blocks dimmed instead of removing them. */
  showHidden?: boolean;
  /** Grava o lead do formulário (render público). */
  onSubmitLead?: (payload: LeadSubmitPayload) => Promise<LeadSubmitResult | void> | LeadSubmitResult | void;
  /** Prévia do editor: destaca a seção selecionada e mostra o nome dela. */
  selectedBlockId?: string | null;
  selectedLabel?: string | null;
  /** Página larga no computador: só a página pública, e só quando o formulário
   *  está na capa (`formularioDaCapa`). A capa ocupa a largura toda e o resto
   *  fica numa coluna de 720px. A prévia do editor nunca passa — é celular. */
  wide?: boolean;
}

/** Espaçamento escolhido na seção, como variável para o componente ler. Só
 *  entra a medida escolhida: as demais caem no padrão declarado dentro do
 *  componente. Com `isolar`, a medida não escolhida é ZERADA para o padrão
 *  (`initial`) em vez de herdada — é o caso do formulário dentro da capa, que
 *  herdaria o espaçamento escolhido para a capa. */
function espacamento(layout: BlockInstance['layout'], isolar = false): CSSProperties {
  const v = (n: number | undefined) => (n != null ? `${n}px` : isolar ? 'initial' : undefined);
  const out: Record<string, string> = {};
  const top = v(layout?.top);
  const bottom = v(layout?.bottom);
  const sides = v(layout?.sides);
  if (top) out['--lp-pad-top'] = top;
  if (bottom) out['--lp-pad-bottom'] = bottom;
  if (sides) out['--lp-pad-x'] = sides;
  return out as CSSProperties;
}

// Contorno em DUAS camadas: a de dentro escura, a de fora clara. Uma cor só
// (era a cor da landing) desaparecia toda vez que o tema da página tinha a
// mesma cor por perto.
const CONTORNO: CSSProperties = {
  outline: '2px solid #0B0B0C',
  outlineOffset: '-2px',
  boxShadow: 'inset 0 0 0 4px rgba(255,255,255,0.9)',
};

function SeloDaSelecao({ label }: { label: string }) {
  return (
    <span
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: 5,
        padding: '2px 8px',
        fontSize: 11,
        fontWeight: 600,
        // Preto sólido com borda branca, sempre — o selo usava a cor
        // da landing e sumia nos temas claros, que são a maioria.
        color: '#fff',
        background: '#0B0B0C',
        border: '1px solid rgba(255,255,255,0.9)',
        borderTop: 'none',
        borderLeft: 'none',
        borderBottomRightRadius: 6,
      }}
    >
      {label}
    </span>
  );
}

/** Renders an ordered list of blocks. Shared by the editor preview and the
 *  public SSR renderer. */
export function BlockRenderer({
  blocks,
  property,
  theme,
  showHidden = false,
  onSubmitLead,
  selectedBlockId,
  selectedLabel,
  wide = false,
}: BlockRendererProps) {
  const resolved: LandingTheme = { ...DEFAULT_LANDING_THEME, ...theme };
  const vars = themeToCssVars(resolved);

  // Formulário dentro da capa: o primeiro formulário visível sai da sequência e
  // entra na capa. Sem o par, nada muda — mesma ordem de sempre.
  const par = formularioDaCapa(blocks);
  const form = par ? blocks.find((b) => b.id === par.formId) : undefined;
  // Um formulário por página: só o primeiro visível leva a âncora
  // `#lp-lead-form`, para o id nunca duplicar.
  const ancora = blocks.find((b) => b.type === 'lead_form' && b.visible)?.id;

  const formNaCapa = form ? (
    // O envelope do formulário continua com o id da seção dele: clicar no
    // formulário da prévia seleciona o formulário, e selecioná-lo na lista o
    // destaca — mesmo morando dentro da capa. Proteção própria: formulário
    // quebrado não derruba a capa junto.
    <BlockBoundary>
      <div
        data-block-id={form.id}
        style={{
          position: 'relative',
          ...espacamento(form.layout, true),
          ...(selectedBlockId === form.id ? CONTORNO : {}),
        }}
      >
        {selectedBlockId === form.id && selectedLabel && <SeloDaSelecao label={selectedLabel} />}
        <LeadFormBlock
          config={form.config as BlockInstance<'lead_form'>['config']}
          property={property}
          theme={resolved}
          onSubmitLead={onSubmitLead}
        />
      </div>
    </BlockBoundary>
  ) : null;

  return (
    <div
      className={showHidden ? 'lp-editor-preview' : undefined}
      style={{
        ...vars,
        background: `linear-gradient(var(--lp-bg-start), var(--lp-bg-end))`,
        color: 'var(--lp-text)',
        fontFamily: 'var(--lp-font)',
        paddingBottom: '5.5rem', // espaço pro CTA fixo não cobrir o conteúdo
      }}
    >
      {/* Na PRÉVIA do editor, mapa e vídeo não podem capturar o clique nem a
          rolagem: quem clica numa seção está escolhendo o que editar, e a
          moldura do mapa engoliria o clique e a rolagem da página inteira. */}
      {showHidden && <style>{`.lp-editor-preview iframe{pointer-events:none}`}</style>}
      {blocks.map((block) => {
        if (!block.visible && !showHidden) return null;
        if (par && block.id === par.formId) return null;
        const Cmp = BLOCK_COMPONENTS[block.type];
        if (!Cmp) return null;
        const selected = selectedBlockId === block.id;
        const capaComForm = par?.heroId === block.id;
        return (
          <BlockBoundary key={block.id}>
            <div
              data-block-id={block.id}
              style={{
                position: 'relative',
                ...espacamento(block.layout),
                ...(!block.visible && showHidden ? { opacity: 0.4 } : {}),
                ...(selected ? CONTORNO : {}),
                // Página larga: a capa ocupa a largura toda; o resto, 720px.
                ...(wide && !capaComForm ? { maxWidth: 720, margin: '0 auto' } : {}),
              }}
            >
              {selected && selectedLabel && <SeloDaSelecao label={selectedLabel} />}
              {block.type === 'lead_form' ? (
                <LeadFormBlock
                  config={block.config as BlockInstance<'lead_form'>['config']}
                  property={property}
                  theme={resolved}
                  onSubmitLead={onSubmitLead}
                  anchor={block.id === ancora}
                />
              ) : (
                <Cmp
                  config={block.config}
                  property={property}
                  theme={resolved}
                  onSubmitLead={onSubmitLead}
                  {...(capaComForm ? { slot: formNaCapa, wide } : {})}
                />
              )}
            </div>
          </BlockBoundary>
        );
      })}
    </div>
  );
}
