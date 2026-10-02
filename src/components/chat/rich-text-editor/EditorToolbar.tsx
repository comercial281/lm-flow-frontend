import React from 'react';
import { EditorState } from 'prosemirror-state';
import { Button } from '@evoapi/design-system/button';
import { Bold, Italic, Code, Link2, List, Undo, Redo } from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';

/** Formatações que a barra e os atalhos do editor sabem oferecer. */
export type AcaoDoEditor = 'bold' | 'italic' | 'code' | 'list' | 'undo' | 'redo';

export const TODAS_AS_ACOES: AcaoDoEditor[] = ['bold', 'italic', 'code', 'list', 'undo', 'redo'];

interface EditorToolbarProps {
  editorState: EditorState | null;
  /** Só o que está aqui é desenhado. Padrão: todas (landings e Site Builder). */
  acoes?: AcaoDoEditor[];
  onAction: (action: string) => void;
  disabled?: boolean;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  editorState,
  onAction,
  disabled = false,
  acoes = TODAS_AS_ACOES,
}) => {
  const { t } = useLanguage('chat');

  const tem = (acao: AcaoDoEditor) => acoes.includes(acao);

  const temTexto = tem('bold') || tem('italic') || tem('code');
  const temListaOuLink = tem('list') || Boolean(editorState?.schema.marks.link);
  const temHistorico = tem('undo') || tem('redo');

  const isMarkActive = (markType: string) => {
    if (!editorState) return false;
    const { from, to } = editorState.selection;
    const mark = editorState.schema.marks[markType];
    if (!mark) return false;
    return editorState.doc.rangeHasMark(from, to, mark);
  };

  return (
    <div className="flex flex-wrap items-center gap-1 p-2 border-b border-border bg-muted/30">
      {tem('bold') && (
        <Button
          variant={isMarkActive('strong') ? 'default' : 'outline'}
          size="icon"
          onClick={() => onAction('bold')}
          disabled={disabled}
          title={t('richTextEditor.toolbar.bold')}
          className="h-8 w-8"
        >
          <Bold className="h-4 w-4" />
        </Button>
      )}

      {tem('italic') && (
        <Button
          variant={isMarkActive('em') ? 'default' : 'outline'}
          size="icon"
          onClick={() => onAction('italic')}
          disabled={disabled}
          title={t('richTextEditor.toolbar.italic')}
          className="h-8 w-8"
        >
          <Italic className="h-4 w-4" />
        </Button>
      )}

      {tem('code') && (
        <Button
          variant={isMarkActive('code') ? 'default' : 'outline'}
          size="icon"
          onClick={() => onAction('code')}
          disabled={disabled}
          title={t('richTextEditor.toolbar.code')}
          className="h-8 w-8"
        >
          <Code className="h-4 w-4" />
        </Button>
      )}

      {temTexto && temListaOuLink && <div className="w-px h-6 mx-1 bg-border" />}

      {tem('list') && (
        <Button
          variant="outline"
          size="icon"
          onClick={() => onAction('bulletList')}
          disabled={disabled}
          title={t('richTextEditor.toolbar.bulletList')}
          className="h-8 w-8"
        >
          <List className="h-4 w-4" />
        </Button>
      )}

      {/* Só aparece quando o esquema em uso tem a marca de link — o compositor
          do chat não tem, e o botão simplesmente não existe lá. */}
      {editorState?.schema.marks.link && (
        <Button
          variant={isMarkActive('link') ? 'default' : 'outline'}
          size="icon"
          onClick={() => onAction('link')}
          disabled={disabled}
          title="Transformar a seleção em link"
          className="h-8 w-8"
        >
          <Link2 className="h-4 w-4" />
        </Button>
      )}

      {(temTexto || temListaOuLink) && temHistorico && <div className="w-px h-6 mx-1 bg-border" />}

      {tem('undo') && (
        <Button
          variant="outline"
          size="icon"
          onClick={() => onAction('undo')}
          disabled={disabled}
          title={t('richTextEditor.toolbar.undo')}
          className="h-8 w-8"
        >
          <Undo className="h-4 w-4" />
        </Button>
      )}

      {tem('redo') && (
        <Button
          variant="outline"
          size="icon"
          onClick={() => onAction('redo')}
          disabled={disabled}
          title={t('richTextEditor.toolbar.redo')}
          className="h-8 w-8"
        >
          <Redo className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};
