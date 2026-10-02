import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { createRef } from 'react';
import { RichTextEditor, type RichTextEditorRef } from './RichTextEditor';
import { atalhosDoEditor } from './atalhosDoEditor';
import { messageSchema } from './schema';

vi.mock('@/hooks/useLanguage', () => ({ useLanguage: () => ({ t: (k: string) => k }) }));

describe('atalhosDoEditor', () => {
  it('desfazer/refazer ficam mesmo só com negrito e itálico', () => {
    const k = atalhosDoEditor(['bold', 'italic'], messageSchema);
    expect(Object.keys(k).sort()).toEqual(['Mod-Shift-z', 'Mod-b', 'Mod-i', 'Mod-y', 'Mod-z']);
  });
  it('código e lista só entram se pedidos', () => {
    const k = atalhosDoEditor(['code', 'list'], messageSchema);
    expect(k['Mod-`']).toBeTruthy();
    expect(k['Shift-Ctrl-8']).toBeTruthy();
    expect(k['Mod-b']).toBeUndefined();
  });
});

describe('RichTextEditor → placeholder', () => {
  it('trocar a prop atualiza data-placeholder e mantém o texto', () => {
    const ref = createRef<RichTextEditorRef>();
    const { container, rerender } = render(
      <RichTextEditor ref={ref} placeholder="um" acoes={['bold', 'italic']} />,
    );
    const el = () => container.querySelector('.prosemirror-editor') as HTMLElement;
    expect(el().getAttribute('data-placeholder')).toBe('um');
    ref.current!.insertText('olá');
    rerender(<RichTextEditor ref={ref} placeholder="dois" acoes={['bold', 'italic']} />);
    expect(el().getAttribute('data-placeholder')).toBe('dois');
    expect(ref.current!.getContent()).toContain('olá');
  });
});
