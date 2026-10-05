import React from 'react';
import { EditorState } from 'prosemirror-state';
import { Button } from '@evoapi/design-system/button';
import { Bold, Italic, Code, Heading2, Heading3, ImagePlus, Link2, List, ListOrdered, Quote, Undo, Redo } from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';

/** Formatações que a barra e os atalhos do editor sabem oferecer. */
export type AcaoDoEditor = 'bold' | 'italic' | 'code' | 'list' | 'undo' | 'redo'
  | 'heading2' | 'heading3' | 'orderedList' | 'quote' | 'image';

/** O padrão (chat sem `acoes`, landings): as 6 de sempre. */
export const TODAS_AS_ACOES: AcaoDoEditor[] = ['bold', 'italic', 'code', 'list', 'undo', 'redo'];

/**
 * As das páginas do site (Meu site › Páginas, com `paginaDoSiteSchema`): título,
 * subtítulo, listas, citação e imagem; sem código (o servidor não guarda).
 * O link aparece sozinho, porque o esquema tem a marca.
 */
export const ACOES_DA_PAGINA: AcaoDoEditor[] = [
  'heading2', 'heading3', 'bold', 'italic', 'list', 'orderedList', 'quote', 'image', 'undo', 'redo',
];

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

  const temTitulos = tem('heading2') || tem('heading3');
  const temTexto = tem('bold') || tem('italic') || tem('code');
  const temListaOuLink = tem('list') || tem('orderedList') || tem('quote') || tem('image')
    || Boolean(editorState?.schema.marks.link);
  const temHistorico = tem('undo') || tem('redo');

  const isMarkActive = (markType: string) => {
    if (!editorState) return false;
    const { from, to } = editorState.selection;
    const mark = editorState.schema.marks[markType];
    if (!mark) return false;
    return editorState.doc.rangeHasMark(from, to, mark);
  };

  // O bloco onde o cursor está é um título desse nível?
  const isHeading = (level: number) => {
    if (!editorState) return false;
    const parent = editorState.selection.$from.parent;
    return parent.type.name === 'heading' && parent.attrs.level === level;
  };

  const botao = (acao: AcaoDoEditor, titulo: string, icone: React.ReactNode, ativo = false) => (
    <Button
      key={acao}
      variant={ativo ? 'default' : 'outline'}
      size="icon"
      onClick={() => onAction(acao)}
      disabled={disabled}
      title={titulo}
      aria-label={titulo}
      aria-pressed={ativo || undefined}
      className="h-8 w-8"
    >
      {icone}
    </Button>
  );

  return (
    <div className="flex flex-wrap items-center gap-1 p-2 border-b border-border bg-muted/30">
      {tem('heading2') && botao('heading2', 'Título', <Heading2 className="h-4 w-4" />, isHeading(2))}
      {tem('heading3') && botao('heading3', 'Subtítulo', <Heading3 className="h-4 w-4" />, isHeading(3))}

      {temTitulos && (temTexto || temListaOuLink) && <div className="w-px h-6 mx-1 bg-border" />}

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

      {tem('orderedList') && botao('orderedList', 'Lista numerada', <ListOrdered className="h-4 w-4" />)}
      {tem('quote') && botao('quote', 'Citação', <Quote className="h-4 w-4" />)}

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

      {tem('image') && botao('image', 'Imagem', <ImagePlus className="h-4 w-4" />)}

      {(temTitulos || temTexto || temListaOuLink) && temHistorico && <div className="w-px h-6 mx-1 bg-border" />}

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
