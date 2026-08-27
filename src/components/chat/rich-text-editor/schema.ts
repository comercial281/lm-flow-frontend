import { Schema } from 'prosemirror-model';

/**
 * Schema para notas privadas - bold, italic, code e listas
 */
export const messageSchema = new Schema({
  nodes: {
    doc: {
      content: 'block+',
    },
    paragraph: {
      content: 'inline*',
      group: 'block',
      parseDOM: [{ tag: 'p' }],
      toDOM() {
        return ['p', 0];
      },
    },
    text: {
      group: 'inline',
    },
    hard_break: {
      inline: true,
      group: 'inline',
      selectable: false,
      parseDOM: [{ tag: 'br' }],
      toDOM() {
        return ['br'];
      },
    },
    bullet_list: {
      content: 'list_item+',
      group: 'block',
      parseDOM: [{ tag: 'ul' }],
      toDOM() {
        return ['ul', 0];
      },
    },
    list_item: {
      content: 'paragraph block*',
      parseDOM: [{ tag: 'li' }],
      toDOM() {
        return ['li', 0];
      },
      defining: true,
    },
  },
  marks: {
    strong: {
      parseDOM: [{ tag: 'strong' }, { tag: 'b' }],
      toDOM() {
        return ['strong', 0];
      },
    },
    em: {
      parseDOM: [{ tag: 'i' }, { tag: 'em' }],
      toDOM() {
        return ['em', 0];
      },
    },
    code: {
      parseDOM: [{ tag: 'code' }],
      toDOM() {
        return ['code', { spellcheck: 'false' }, 0];
      },
    },
  },
});

/**
 * O mesmo esquema das notas privadas, mais a marca de LINK. Vive separado de
 * propósito: o compositor do chat NÃO pode ganhar link por efeito colateral —
 * o que se escreve lá vira mensagem de WhatsApp, onde âncora não existe e o
 * endereço teria de aparecer como texto.
 *
 * Quem usa é a seção de Texto da landing, onde o link é conteúdo legítimo da
 * página (o portal, um PDF de plantas, a conversa no WhatsApp).
 */
export const landingTextSchema = new Schema({
  nodes: messageSchema.spec.nodes,
  marks: messageSchema.spec.marks.addToEnd('link', {
    attrs: { href: {} },
    inclusive: false,
    parseDOM: [
      {
        tag: 'a[href]',
        getAttrs: (dom: HTMLElement | string) => ({
          href: typeof dom === 'string' ? dom : (dom.getAttribute('href') ?? ''),
        }),
      },
    ],
    toDOM(mark) {
      return ['a', { href: mark.attrs.href as string, target: '_blank', rel: 'noopener noreferrer' }, 0];
    },
  }),
});
