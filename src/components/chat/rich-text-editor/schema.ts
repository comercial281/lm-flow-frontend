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

/** Destinos que a página do site aceita (os mesmos que o servidor guarda). */
const LINK_ACEITO = /^(https?:\/\/|mailto:|tel:|\/(?![/\\]))/i;
const IMAGEM_ACEITA = /^https?:\/\//i;

/**
 * Esquema das PÁGINAS do site (Meu site › Páginas). Só o que o servidor guarda
 * ao gravar (Page.clean_html: `h2 h3 p ul ol li a img strong em blockquote br`):
 * título e subtítulo, listas com marcador e numeradas, citação, link e imagem.
 * Sem `code` (o servidor tira a marca e deixa o texto).
 *
 * O HTML antigo abre aqui: `h1` vira título (h2), `h4`–`h6` viram subtítulo
 * (h3), `b`/`i` viram negrito/itálico; marca desconhecida some e o texto fica.
 * Fora do chat de propósito: o compositor do chat continua sem nada disso.
 */
export const paginaDoSiteSchema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: {
      content: 'inline*',
      group: 'block',
      parseDOM: [{ tag: 'p' }],
      toDOM() { return ['p', 0]; },
    },
    heading: {
      attrs: { level: { default: 2 } },
      content: 'inline*',
      group: 'block',
      defining: true,
      parseDOM: [
        { tag: 'h1', attrs: { level: 2 } },
        { tag: 'h2', attrs: { level: 2 } },
        { tag: 'h3', attrs: { level: 3 } },
        { tag: 'h4', attrs: { level: 3 } },
        { tag: 'h5', attrs: { level: 3 } },
        { tag: 'h6', attrs: { level: 3 } },
      ],
      toDOM(node) { return [node.attrs.level === 3 ? 'h3' : 'h2', 0]; },
    },
    blockquote: {
      content: 'block+',
      group: 'block',
      defining: true,
      parseDOM: [{ tag: 'blockquote' }],
      toDOM() { return ['blockquote', 0]; },
    },
    bullet_list: {
      content: 'list_item+',
      group: 'block',
      parseDOM: [{ tag: 'ul' }],
      toDOM() { return ['ul', 0]; },
    },
    ordered_list: {
      content: 'list_item+',
      group: 'block',
      parseDOM: [{ tag: 'ol' }],
      toDOM() { return ['ol', 0]; },
    },
    list_item: {
      content: 'paragraph block*',
      defining: true,
      parseDOM: [{ tag: 'li' }],
      toDOM() { return ['li', 0]; },
    },
    text: { group: 'inline' },
    image: {
      inline: true,
      group: 'inline',
      draggable: true,
      attrs: { src: {}, alt: { default: '' } },
      parseDOM: [{
        tag: 'img[src]',
        // Só imagem http(s): o servidor tira a outra ao gravar, e `data:`/`javascript:`
        // nem entram no editor.
        getAttrs: (dom: HTMLElement | string) => {
          if (typeof dom === 'string') return false;
          const src = (dom.getAttribute('src') ?? '').trim();
          return IMAGEM_ACEITA.test(src) ? { src, alt: dom.getAttribute('alt') ?? '' } : false;
        },
      }],
      toDOM(node) { return ['img', { src: node.attrs.src as string, alt: node.attrs.alt as string }]; },
    },
    hard_break: {
      inline: true,
      group: 'inline',
      selectable: false,
      parseDOM: [{ tag: 'br' }],
      toDOM() { return ['br']; },
    },
  },
  marks: {
    link: {
      attrs: { href: {} },
      inclusive: false,
      parseDOM: [{
        tag: 'a[href]',
        // Os mesmos destinos que o servidor guarda: http(s), mailto:, tel: e
        // caminho do site ("/imoveis", nunca "//outro-site"). Fora disso, o
        // link some e o texto fica.
        getAttrs: (dom: HTMLElement | string) => {
          if (typeof dom === 'string') return false;
          const href = (dom.getAttribute('href') ?? '').trim();
          return LINK_ACEITO.test(href) ? { href } : false;
        },
      }],
      toDOM(mark) { return ['a', { href: mark.attrs.href as string }, 0]; },
    },
    strong: {
      parseDOM: [{ tag: 'strong' }, { tag: 'b' }],
      toDOM() { return ['strong', 0]; },
    },
    em: {
      parseDOM: [{ tag: 'i' }, { tag: 'em' }],
      toDOM() { return ['em', 0]; },
    },
  },
});
