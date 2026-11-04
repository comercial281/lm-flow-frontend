/**
 * O middleware põe o texto da página (`#lmf-ssr`: título, descrição, cards,
 * migalhas, FAQ) ANTES do `#root`, para o Google e para quem abre a página
 * ler alguma coisa antes do app subir. Quando o app desenha a página de
 * verdade, o texto sai — senão o visitante veria as duas.
 *
 * "De verdade" = o `#root` tem conteúdo e nenhum `[data-carregando]` dentro
 * (o "Carregando…" das páginas). Página que ainda não desenhou nada deixa o
 * texto na tela. Sem `#lmf-ssr` (CRM, página sem texto do servidor), não faz
 * nada.
 */
export function tirarTextoDoServidorQuandoPronto(doc: Document = document): () => void {
  const texto = doc.getElementById('lmf-ssr');
  const raiz = doc.getElementById('root');
  if (!texto || !raiz) return () => {};

  const pronto = () => raiz.childElementCount > 0 && !raiz.querySelector('[data-carregando]');
  const observador = new MutationObserver(() => {
    if (!pronto()) return;
    texto.remove();
    observador.disconnect();
  });
  if (pronto()) {
    texto.remove();
    return () => {};
  }
  observador.observe(raiz, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-carregando'] });
  return () => observador.disconnect();
}
