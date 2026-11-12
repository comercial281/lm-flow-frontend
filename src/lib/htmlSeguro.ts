import DOMPurify, { type DOMPurify as InstanciaDOMPurify } from 'dompurify';

// HTML que vem de fora (mensagem, e-mail recebido, nota) passa por aqui antes de
// ir pra tela. Duas portas, e só elas:
//
// - `textoDoHtml`: quando só interessa o texto (prévia da lista de Conversas,
//   aviso de mensagem nova, prévia de modelo). Lê num documento à parte, que o
//   navegador não exibe nem carrega. Pra só pegar o texto, nunca `innerHTML`
//   numa div criada na página (mesmo fora da tela, ela já carrega o conteúdo).
// - `htmlSeguro`: quando a formatação precisa aparecer (balão da conversa,
//   e-mail recebido, nota interna, widget). Lista fechada do que pode ficar.

/** Só o texto de um HTML, sem tocar na página. */
export function textoDoHtml(html: string | null | undefined): string {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(String(html), 'text/html');
  // Conteúdo de bloco de código/estilo não é texto pra quem lê a prévia.
  doc.querySelectorAll('script, style, noscript, template').forEach((n) => n.remove());
  return doc.body?.textContent ?? '';
}

// O que a tela usa hoje: texto formatado (negrito, itálico, sublinhado, riscado),
// títulos, listas, citações, código, links, imagens e o layout de e-mail em tabela.
const TAGS_PERMITIDAS = [
  'a', 'abbr', 'b', 'big', 'blockquote', 'br', 'caption', 'center', 'cite', 'code',
  'col', 'colgroup', 'dd', 'del', 'div', 'dl', 'dt', 'em', 'figcaption', 'figure',
  'font', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img', 'ins', 'li', 'mark',
  'ol', 'p', 'pre', 'q', 's', 'small', 'span', 'strike', 'strong', 'sub', 'sup',
  'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'u', 'ul',
  'article', 'aside', 'footer', 'header', 'main', 'section',
];

const ATRIBUTOS_PERMITIDOS = [
  'href', 'target', 'rel', 'title', 'alt', 'src', 'width', 'height', 'style',
  'align', 'valign', 'bgcolor', 'background', 'border', 'cellpadding', 'cellspacing',
  'colspan', 'rowspan', 'nowrap', 'scope', 'span', 'color', 'face', 'size',
  'start', 'type', 'reversed', 'value', 'dir', 'lang',
];

// Proibidas de forma explícita (já ficam fora pela lista acima; aqui é a régua
// escrita, pra ninguém "liberar" sem ver).
const TAGS_PROIBIDAS = [
  'iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'form', 'input',
  'button', 'textarea', 'select', 'option', 'style', 'script', 'noscript',
  'template', 'svg', 'math', 'base', 'meta', 'link', 'title',
];
// `class` e `id` ficam de fora: classe do e-mail pegaria o estilo do próprio app
// e `id` repetiria os da página.
const ATRIBUTOS_PROIBIDOS = ['srcdoc', 'formaction', 'action', 'xlink:href', 'class', 'id', 'name'];

// Endereço aceito em link/imagem: http(s), e-mail, telefone ou caminho relativo.
// Imagem com `data:` passa pela regra própria do DOMPurify (só em <img>).
const ENDERECO_PERMITIDO = /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i;

// Estilo inline que não fica: recursos de CSS fora do padrão, endereço em
// `url(...)` que não seja http(s) ou imagem embutida, e posição presa na janela
// (sairia do balão).
const ESTILO_PERIGOSO = /expression\s*\(|javascript:|vbscript:|behavior\s*:|-moz-binding|url\s*\(\s*['"]?\s*(?!https?:|data:image\/)[a-z0-9+.-]+:/i;
const POSICAO_PRESA = /(^|;)\s*position\s*:\s*(fixed|sticky)[^;]*/gi;
const DECLARACAO_DE_COR = /(^|;)\s*[a-z-]*color\s*:[^;]*/gi;

function normalizarCss(valor: string): string {
  // Comentário e barra invertida servem pra disfarçar palavra no CSS.
  return valor.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\\/g, '');
}

let instancia: InstanciaDOMPurify | null = null;
let tirarCorNestaChamada = false;

function purificador(): InstanciaDOMPurify {
  if (instancia) return instancia;
  // Instância própria: os ganchos abaixo não vazam pra outro uso do DOMPurify.
  const p = DOMPurify(window);

  p.addHook('uponSanitizeAttribute', (_no, data) => {
    if (data.attrName !== 'style') return;
    const css = normalizarCss(data.attrValue);
    if (ESTILO_PERIGOSO.test(css)) {
      data.keepAttr = false;
      return;
    }
    let limpo = css.replace(POSICAO_PRESA, '$1');
    if (tirarCorNestaChamada) limpo = limpo.replace(DECLARACAO_DE_COR, '$1');
    limpo = limpo.replace(/^[\s;]+|[\s;]+$/g, '').replace(/;\s*;+/g, ';');
    if (limpo) data.attrValue = limpo;
    else data.keepAttr = false;
  });

  // Todo link abre fora do CRM e não dá à página aberta acesso à aba de cá.
  p.addHook('afterSanitizeAttributes', (no) => {
    if (no.tagName === 'A' && no.hasAttribute('href')) {
      no.setAttribute('target', '_blank');
      no.setAttribute('rel', 'noopener noreferrer');
    }
  });

  instancia = p;
  return p;
}

export interface OpcoesHtmlSeguro {
  /** Tira as cores do estilo inline (nota interna: o texto segue a cor do balão). */
  semCor?: boolean;
}

/** HTML pronto pra `dangerouslySetInnerHTML`: só a formatação da lista permitida. */
export function htmlSeguro(html: string | null | undefined, opcoes: OpcoesHtmlSeguro = {}): string {
  if (!html) return '';
  const p = purificador();
  tirarCorNestaChamada = Boolean(opcoes.semCor);
  try {
    return p.sanitize(String(html), {
      ALLOWED_TAGS: TAGS_PERMITIDAS,
      ALLOWED_ATTR: ATRIBUTOS_PERMITIDOS,
      FORBID_TAGS: TAGS_PROIBIDAS,
      FORBID_ATTR: ATRIBUTOS_PROIBIDOS,
      ALLOWED_URI_REGEXP: ENDERECO_PERMITIDO,
      ALLOW_DATA_ATTR: false,
      ALLOW_UNKNOWN_PROTOCOLS: false,
    });
  } finally {
    tirarCorNestaChamada = false;
  }
}
