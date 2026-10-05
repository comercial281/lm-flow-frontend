import { DOMParser as ProseDOMParser, DOMSerializer, type Node as ProseNode, type Schema } from 'prosemirror-model';

// HTML ↔ documento do editor, fora do componente (o arquivo do componente só
// exporta componente, por causa do fast refresh).

/** Documento a partir de HTML (ou de texto puro, que vira um parágrafo). */
export function docDoConteudo(content: string, schema: Schema) {
  if (/<[a-z][\s\S]*>/i.test(content)) {
    // Documento à parte (inerte): `innerHTML` numa div da página carregaria as
    // imagens e rodaria um `onerror` do HTML gravado antes de o ProseMirror
    // jogar o atributo fora.
    const inerte = new DOMParser().parseFromString(content, 'text/html');
    return ProseDOMParser.fromSchema(schema).parse(inerte.body);
  }
  return schema.nodeFromJSON({
    type: 'doc',
    content: content ? [{ type: 'paragraph', content: [{ type: 'text', text: content }] }] : [],
  });
}

export function htmlDoDoc(doc: ProseNode, schema: Schema): string {
  const div = document.createElement('div');
  div.appendChild(DOMSerializer.fromSchema(schema).serializeFragment(doc.content));
  return div.innerHTML;
}

/**
 * O HTML como o editor o devolveria depois de abrir (`getContent` logo após
 * carregar). Serve pra saber se a pessoa mexeu: o editor reescreve o HTML
 * antigo (h1 vira h2, `<b>` vira `<strong>`), então comparar com o gravado
 * diria "mudou" sem ninguém ter tocado.
 */
export function htmlComoOEditorDevolve(html: string, schema: Schema): string {
  return htmlDoDoc(docDoConteudo(html, schema), schema);
}
