import { useRef, useEffect, useState, useImperativeHandle, forwardRef, type ReactNode } from 'react';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { keymap } from 'prosemirror-keymap';
import { history, undo, redo } from 'prosemirror-history';
import { baseKeymap, lift, setBlockType, wrapIn } from 'prosemirror-commands';
import { toggleMark } from 'prosemirror-commands';
import { liftListItem, splitListItem, wrapInList } from 'prosemirror-schema-list';
import type { Schema } from 'prosemirror-model';
import { messageSchema } from './schema';
import { docDoConteudo, htmlDoDoc } from './conteudoDoEditor';
import { EditorToolbar, TODAS_AS_ACOES, type AcaoDoEditor } from './EditorToolbar';
import { atalhosDoEditor } from './atalhosDoEditor';
import { toast } from 'sonner';

const classeDoEditor = (minHeight: string, maxHeight: string) =>
  `prosemirror-editor p-3 ${minHeight} ${maxHeight} overflow-y-auto focus:outline-none resize-none text-sm leading-relaxed text-foreground`;

/** A ação só é oferecida se o esquema tem o que ela precisa (e a imagem, quem a peça). */
function acaoDisponivel(acao: AcaoDoEditor, schema: Schema, temImagem: boolean): boolean {
  switch (acao) {
    case 'heading2': case 'heading3': return !!schema.nodes.heading;
    case 'orderedList': return !!schema.nodes.ordered_list;
    case 'quote': return !!schema.nodes.blockquote;
    case 'image': return !!schema.nodes.image && temImagem;
    case 'code': return !!schema.marks.code;
    default: return true;
  }
}

export interface RichTextEditorRef {
  focus: () => void;
  getContent: () => string;
  setContent: (content: string) => void;
  insertText: (text: string) => void;
  /** Põe uma imagem onde está o cursor (o estado é relido na hora: pode vir depois de um envio). */
  insertImage: (src: string, alt?: string) => void;
  clear: () => void;
}

interface RichTextEditorProps {
  placeholder?: string;
  value?: string;
  onChange?: (content: string) => void;
  onKeyDown?: (event: KeyboardEvent) => boolean | void;
  disabled?: boolean;
  className?: string;
  showToolbar?: boolean;
  /**
   * Classe Tailwind da altura mínima da área de digitação do ProseMirror.
   * Default preserva o comportamento antigo (usado no SiteBuilder). O chat passa
   * uma altura menor pra barra ficar enxuta (estilo WhatsApp).
   */
  editorMinHeightClass?: string;
  /** Classe da altura máxima da área de digitação (rola dentro dela). Padrão: 200px. */
  editorMaxHeightClass?: string;
  /**
   * Chamado pelo botão Imagem da barra (só existe com esta função e um esquema
   * com `image`). Quem usa pede o endereço ou o arquivo e chama `insertImage`.
   */
  aoPedirImagem?: () => void;
  /** HTML carregado na montagem (troque a `key` pra recarregar). */
  conteudoInicial?: string;
  /**
   * Esquema do documento. O padrão é o do compositor do chat — negrito,
   * itálico, código e lista. A seção de Texto da landing passa um esquema com
   * LINK; o chat não pode ganhar link por efeito colateral, porque o que se
   * escreve lá vira mensagem de WhatsApp.
   */
  schema?: Schema;
  /**
   * Formatações oferecidas (barra e atalhos). Padrão: todas — é o que as
   * landings e o Site Builder usam. O chat passa só negrito e itálico.
   */
  acoes?: AcaoDoEditor[];
  /**
   * Conteúdo na ponta direita da barra. Aparece mesmo com `showToolbar` falso
   * (aí a barra fica só com ele): o chat esconde negrito/itálico na conversa
   * pendente, mas o aviso do Resposta continua.
   */
  barraExtra?: ReactNode;
}

export const RichTextEditor = forwardRef<RichTextEditorRef, RichTextEditorProps>(
  (
    {
      placeholder = 'Digite sua nota privada...',
      value = '',
      onChange,
      onKeyDown,
      disabled = false,
      className = '',
      showToolbar = true,
      editorMinHeightClass = 'min-h-[100px]',
      editorMaxHeightClass = 'max-h-[200px]',
      aoPedirImagem,
      conteudoInicial,
      schema = messageSchema,
      acoes: acoesPedidas = TODAS_AS_ACOES,
      barraExtra,
    },
    ref,
  ) => {
    const acoes = acoesPedidas.filter(a => acaoDisponivel(a, schema, !!aoPedirImagem));
    const editorRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const [editorState, setEditorState] = useState<EditorState | null>(null);

    const onKeyDownRef = useRef(onKeyDown);
    const onChangeRef = useRef(onChange);
    useEffect(() => { onKeyDownRef.current = onKeyDown; }, [onKeyDown]);
    useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

    useImperativeHandle(ref, () => ({
      focus: () => {
        viewRef.current?.focus();
      },
      getContent: () => {
        if (!viewRef.current) return '';
        return htmlDoDoc(viewRef.current.state.doc, schema);
      },
      setContent: (content: string) => {
        if (!viewRef.current) return;
        const doc = docDoConteudo(content, schema);
        const newState = EditorState.create({
          doc,
          plugins: viewRef.current.state.plugins,
        });
        viewRef.current.updateState(newState);
        setEditorState(newState);
      },
      insertText: (text: string) => {
        if (!viewRef.current) return;
        const { state, dispatch } = viewRef.current;
        const tr = state.tr.insertText(text);
        dispatch(tr);
        viewRef.current.focus();
      },
      insertImage: (src: string, alt = '') => {
        const view = viewRef.current;
        const tipo = schema.nodes.image;
        if (!view || !tipo || !src) return;
        // Estado lido AGORA (não o de quando o botão foi clicado): entre o clique e
        // a imagem houve o envio do arquivo ou a digitação do endereço.
        view.dispatch(view.state.tr.replaceSelectionWith(tipo.create({ src, alt })).scrollIntoView());
        view.focus();
      },
      clear: () => {
        if (!viewRef.current) return;
        const emptyDoc = schema.nodeFromJSON({
          type: 'doc',
          content: [],
        });
        const newState = EditorState.create({
          doc: emptyDoc,
          plugins: viewRef.current.state.plugins,
        });
        viewRef.current.updateState(newState);
        setEditorState(newState);
        onChangeRef.current?.('');
      },
    }));

    useEffect(() => {
      if (!editorRef.current) return;

      // `conteudoInicial` (HTML) vence o `value` (texto): quem abre o editor já
      // com conteúdo não depende do ref estar pronto no efeito do pai.
      const initialDoc = conteudoInicial !== undefined
        ? docDoConteudo(conteudoInicial, schema)
        : value
        ? schema.nodeFromJSON({
            type: 'doc',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: value }] }],
          })
        : schema.nodeFromJSON({
            type: 'doc',
            content: [],
          });

      const state = EditorState.create({
        doc: initialDoc,
        plugins: [
          history(),
          keymap({
            ...atalhosDoEditor(acoes, schema),
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            Enter: (_state, _dispatch) => {
              if (onKeyDownRef.current) {
                const handled = onKeyDownRef.current(new KeyboardEvent('keydown', { key: 'Enter' }));
                if (handled) return true;
              }
              return false;
            },
          }),
          // Nas páginas do site (lista numerada na barra), Enter numa lista abre
          // o próximo item e Shift+Tab sai da lista. O chat fica como estava.
          ...(acoes.includes('orderedList') && schema.nodes.list_item
            ? [keymap({ Enter: splitListItem(schema.nodes.list_item), 'Shift-Tab': liftListItem(schema.nodes.list_item) })]
            : []),
          keymap(baseKeymap),
        ],
      });

      const view = new EditorView(editorRef.current, {
        state,
        dispatchTransaction: transaction => {
          const newState = view.state.apply(transaction);
          view.updateState(newState);
          setEditorState(newState);

          if (transaction.docChanged) {
            const doc = newState.doc;
            const content = doc.textContent;
            onChangeRef.current?.(content);
          }
        },
        handleDOMEvents: {
          keydown: (_view, event) => {
            if (onKeyDownRef.current) {
              const handled = onKeyDownRef.current(event);
              if (handled) return true;
            }
            return false;
          },
        },
        editable: () => !disabled,
        attributes: {
          class:
            classeDoEditor(editorMinHeightClass, editorMaxHeightClass),
          'data-placeholder': placeholder,
        },
      });

      viewRef.current = view;
      setEditorState(state);

      return () => {
        view.destroy();
        viewRef.current = null;
      };
    }, []);

    useEffect(() => {
      if (viewRef.current) {
        viewRef.current.setProps({
          editable: () => !disabled,
        });
      }
    }, [disabled]);

    // A frase do campo muda com o estado da conversa (pendente, restrita, nota);
    // o ProseMirror só leu o `placeholder` na montagem, então atualiza aqui.
    useEffect(() => {
      viewRef.current?.setProps({
        attributes: {
          class: classeDoEditor(editorMinHeightClass, editorMaxHeightClass),
          'data-placeholder': placeholder,
        },
      });
    }, [placeholder, editorMinHeightClass, editorMaxHeightClass]);

    const handleToolbarAction = (action: string) => {
      if (!viewRef.current || !editorState) return;

      const { state, dispatch } = viewRef.current;

      switch (action) {
        case 'bold':
          toggleMark(schema.marks.strong)(state, dispatch);
          break;
        case 'italic':
          toggleMark(schema.marks.em)(state, dispatch);
          break;
        case 'code':
          toggleMark(schema.marks.code)(state, dispatch);
          break;
        case 'bulletList':
          wrapInList(schema.nodes.bullet_list)(state, dispatch);
          break;
        case 'orderedList':
          if (schema.nodes.ordered_list) wrapInList(schema.nodes.ordered_list)(state, dispatch);
          break;
        case 'heading2':
        case 'heading3': {
          const heading = schema.nodes.heading;
          if (!heading) break;
          const level = action === 'heading2' ? 2 : 3;
          const atual = state.selection.$from.parent;
          // Clicar de novo no mesmo nível volta a ser parágrafo.
          if (atual.type === heading && atual.attrs.level === level) setBlockType(schema.nodes.paragraph)(state, dispatch);
          else setBlockType(heading, { level })(state, dispatch);
          break;
        }
        case 'quote': {
          const quote = schema.nodes.blockquote;
          if (!quote) break;
          // Dentro de uma citação, o botão tira; fora, põe.
          const { $from } = state.selection;
          let dentro = false;
          for (let d = $from.depth; d > 0; d--) if ($from.node(d).type === quote) dentro = true;
          if (dentro) lift(state, dispatch);
          else wrapIn(quote)(state, dispatch);
          break;
        }
        case 'image':
          aoPedirImagem?.();
          return;
        case 'link': {
          // Só existe quando o esquema recebido tem a marca — o compositor do
          // chat não tem, então nem o botão aparece lá.
          const linkMark = schema.marks.link;
          if (!linkMark) break;
          const { from, to } = state.selection;
          if (from === to) break; // sem texto selecionado não há o que virar link
          if (state.doc.rangeHasMark(from, to, linkMark)) {
            toggleMark(linkMark)(state, dispatch);
            break;
          }
          // Continua sendo a caixinha do navegador de propósito, e o motivo é o
          // ProseMirror, não o desenho: o `state` acima foi capturado de forma
          // síncrona, e o estado do editor é imutável. Depois de um `await`, ele
          // seria um retrato velho — despachar transação em cima dele quebra o
          // documento em vez de inserir um link.
          //
          // O substituto (usePergunta) é assíncrono. Trocar aqui exige reler o
          // `viewRef.current.state` depois da resposta E conferir se a seleção
          // sobreviveu ao foco indo pro campo do diálogo — e isso não se confere
          // lendo código: precisa de navegador.
          const href = window.prompt('Endereço do link', 'https://')?.trim();
          if (!href) break;
          // Só endereço de verdade. A página é publicada num anúncio pago, e
          // `javascript:` gravado ali seria um buraco aberto para quem abrir.
          if (!/^(https?:\/\/|mailto:|tel:)/i.test(href)) {
            toast.error('Use um endereço começando com https://, mailto: ou tel:');
            break;
          }
          toggleMark(linkMark, { href })(state, dispatch);
          break;
        }
        case 'undo':
          undo(state, dispatch);
          break;
        case 'redo':
          redo(state, dispatch);
          break;
      }

      viewRef.current.focus();
    };

    return (
      <div className={`border border-border rounded-lg overflow-hidden bg-background ${className}`}>
        {(showToolbar || barraExtra) && (
          <EditorToolbar
            editorState={editorState}
            onAction={handleToolbarAction}
            acoes={showToolbar ? acoes : []}
            disabled={disabled}
            extra={barraExtra}
          />
        )}
        <div ref={editorRef} className={`relative ${disabled ? 'opacity-50' : ''}`} />
      </div>
    );
  },
);

RichTextEditor.displayName = 'RichTextEditor';
