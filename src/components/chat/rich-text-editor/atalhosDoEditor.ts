import { toggleMark } from 'prosemirror-commands';
import { undo, redo } from 'prosemirror-history';
import { wrapInList } from 'prosemirror-schema-list';
import type { Command } from 'prosemirror-state';
import type { Schema } from 'prosemirror-model';
import type { AcaoDoEditor } from './EditorToolbar';

/**
 * Atalhos de teclado do editor. Desfazer/refazer ficam SEMPRE: o plugin de
 * histórico está instalado e o desfazer nativo do navegador desincronizaria o
 * ProseMirror. `acoes` só liga/desliga as formatações.
 */
export function atalhosDoEditor(acoes: AcaoDoEditor[], schema: Schema): Record<string, Command> {
  return {
    'Mod-z': undo,
    'Mod-y': redo,
    'Mod-Shift-z': redo,
    ...(acoes.includes('bold') ? { 'Mod-b': toggleMark(schema.marks.strong) } : {}),
    ...(acoes.includes('italic') ? { 'Mod-i': toggleMark(schema.marks.em) } : {}),
    ...(acoes.includes('code') ? { 'Mod-`': toggleMark(schema.marks.code) } : {}),
    ...(acoes.includes('list') ? { 'Shift-Ctrl-8': wrapInList(schema.nodes.bullet_list) } : {}),
  };
}
