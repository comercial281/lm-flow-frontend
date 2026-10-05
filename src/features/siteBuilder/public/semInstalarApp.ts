// No domínio do cliente o navegador não pode oferecer "Instalar LM Flow".
//
// O `index.html` é um só para o CRM e para o site, e traz o manifest e as metas
// do PWA do CRM. O middleware da Vercel já tira essas tags quando monta o
// `<head>` do domínio (middleware/headDoSite.ts). Isto é a garantia do lado do
// navegador para quando o middleware não rodou (servidor fora, tempo esgotado).
//
// ARMADILHA: lido por src/mainDoSite.tsx. Não importar nada do CRM aqui.

const SELETORES = [
  'link[rel="manifest"]',
  'meta[name^="apple-mobile-web-app-"]',
  'meta[name="mobile-web-app-capable"]',
  'meta[name="application-name"]',
];

/** Tira do `<head>` o manifest e as metas de instalação do app. */
export function semInstalarApp(doc: Document = document): void {
  for (const el of Array.from(doc.head.querySelectorAll(SELETORES.join(',')))) el.remove();
}
