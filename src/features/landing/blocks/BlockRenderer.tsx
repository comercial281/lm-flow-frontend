import { Component, type CSSProperties, type ReactNode } from 'react';
import type { BlockInstance } from './contract';
import { BLOCK_COMPONENTS } from './components';
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
}: BlockRendererProps) {
  const resolved: LandingTheme = { ...DEFAULT_LANDING_THEME, ...theme };
  const vars = themeToCssVars(resolved);

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
        const Cmp = BLOCK_COMPONENTS[block.type];
        if (!Cmp) return null;
        const selected = selectedBlockId === block.id;
        return (
          <BlockBoundary key={block.id}>
            <div
              data-block-id={block.id}
              style={{
                position: 'relative',
                // Espaçamento escolhido nesta seção. Só entra a medida que foi
                // escolhida: as demais continuam caindo no padrão declarado
                // dentro do componente Section.
                ...(block.layout?.top != null ? { '--lp-pad-top': `${block.layout.top}px` } : {}),
                ...(block.layout?.bottom != null ? { '--lp-pad-bottom': `${block.layout.bottom}px` } : {}),
                ...(block.layout?.sides != null ? { '--lp-pad-x': `${block.layout.sides}px` } : {}),
                ...(!block.visible && showHidden ? { opacity: 0.4 } : {}),
                // Contorno em DUAS camadas: a de dentro escura, a de fora clara.
                // Uma cor só (era a cor da landing) desaparecia toda vez que o
                // tema da página tinha a mesma cor por perto.
                ...(selected
                  ? { outline: '2px solid #0B0B0C', outlineOffset: '-2px', boxShadow: 'inset 0 0 0 4px rgba(255,255,255,0.9)' }
                  : {}),
              } as CSSProperties}
            >
              {selected && selectedLabel && (
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
                  {selectedLabel}
                </span>
              )}
              <Cmp config={block.config} property={property} theme={resolved} onSubmitLead={onSubmitLead} />
            </div>
          </BlockBoundary>
        );
      })}
    </div>
  );
}
