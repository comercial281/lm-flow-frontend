// Para onde a tela vai depois do login (`?returnUrl=`). Só caminho deste mesmo
// endereço; o resto vira null e a tela segue o caminho padrão.
//
// Antes (até 12/11/2026, auditoria 3E-09) a regra era "começa com `/` e não com
// `//`". O navegador normaliza `/\outro-site` e `/<tab>/outro-site` para
// `//outro-site`, então a pessoa digitava a senha certa no endereço verdadeiro e
// caía no site de quem mandou o link. Agora quem decide é o próprio navegador:
// resolve o endereço contra o atual e só aceita se a origem for a mesma.
export function destinoDepoisDoLogin(
  valor: string | null | undefined,
  origemAtual: string = window.location.origin,
): string | null {
  if (!valor) return null;
  const bruto = String(valor);
  // Caminho relativo sempre começa com "/" (nada de "pagina", "javascript:" etc.).
  if (!bruto.startsWith('/')) return null;
  let url: URL;
  try {
    url = new URL(bruto, origemAtual);
  } catch {
    return null;
  }
  if (url.origin !== origemAtual) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}
