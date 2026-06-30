import { Component, type ReactNode } from 'react';
import type { BlockInstance } from './contract';
import { BLOCK_COMPONENTS } from './components';
import {
  DEFAULT_LANDING_THEME,
  type LandingProperty,
  type LandingTheme,
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
}

/** Renders an ordered list of blocks. Shared by the editor preview and the
 *  public SSR renderer. */
export function BlockRenderer({ blocks, property, theme, showHidden = false }: BlockRendererProps) {
  const resolved: LandingTheme = { ...DEFAULT_LANDING_THEME, ...theme };
  const vars = themeToCssVars(resolved);

  return (
    <div
      style={{
        ...vars,
        background: `linear-gradient(var(--lp-bg-start), var(--lp-bg-end))`,
        color: 'var(--lp-text)',
        fontFamily: 'var(--lp-font)',
      }}
    >
      {blocks.map((block) => {
        if (!block.visible && !showHidden) return null;
        const Cmp = BLOCK_COMPONENTS[block.type];
        if (!Cmp) return null;
        return (
          <BlockBoundary key={block.id}>
            <div style={!block.visible && showHidden ? { opacity: 0.4 } : undefined}>
              <Cmp config={block.config} property={property} theme={resolved} />
            </div>
          </BlockBoundary>
        );
      })}
    </div>
  );
}
