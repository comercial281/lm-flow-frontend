import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { EditorToolbar } from './EditorToolbar';

vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({ t: (chave: string) => chave }),
}));

const rotulos = [
  'richTextEditor.toolbar.bold',
  'richTextEditor.toolbar.italic',
  'richTextEditor.toolbar.code',
  'richTextEditor.toolbar.bulletList',
  'richTextEditor.toolbar.undo',
  'richTextEditor.toolbar.redo',
];

describe('EditorToolbar', () => {
  it('sem `acoes` desenha os 6 botões (landings e Site Builder)', () => {
    render(<EditorToolbar editorState={null} onAction={() => {}} />);
    expect(screen.getAllByRole('button')).toHaveLength(6);
    for (const r of rotulos) expect(screen.getByTitle(r)).toBeTruthy();
  });

  it("com acoes={['bold','italic']} só desenha Negrito e Itálico", () => {
    render(<EditorToolbar editorState={null} onAction={() => {}} acoes={['bold', 'italic']} />);
    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(screen.getByTitle('richTextEditor.toolbar.bold')).toBeTruthy();
    expect(screen.getByTitle('richTextEditor.toolbar.italic')).toBeTruthy();
    expect(screen.queryByTitle('richTextEditor.toolbar.code')).toBeNull();
  });
});
