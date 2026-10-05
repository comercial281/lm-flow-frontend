// Entrada do index.html. Decide PELO ENDEREÇO, antes de montar qualquer coisa,
// qual app sobe:
//
//   - endereço do sistema (*.lmflow.com.br, *.vercel.app, localhost, IP) → o
//     CRM de sempre (src/mainDoSistema.tsx);
//   - domínio de cliente (www.imobiliaria.com.br) → SÓ o site dele
//     (src/mainDoSite.tsx): sem login, sem sessão, sem websocket. O CRM nem é
//     baixado nesse endereço.
//
// Este arquivo fica mínimo de propósito: tudo que ele importa vai junto para os
// dois lados.
import { ehEnderecoDoSistema } from './features/siteBuilder/public/dominioDoSite';
import { isChunkError, reloadForNewVersion } from './utils/chunkReload';

// ⚠️ A trava de build só segue o import estático da entrada. Um novo `import()`
// aqui não é conferido pela `conferir-dominio-limpo` (scripts/conferir-dominio-limpo.mjs).
const app = ehEnderecoDoSistema(window.location.hostname)
  ? import('./mainDoSistema')
  : import('./mainDoSite');

/**
 * Nem o app subiu: mensagem simples na tela, sem nada do sistema. O Sentry
 * ainda não existe aqui (ele é ligado DENTRO de cada lado), então o erro vai
 * pro console e nunca vira rejeição sem tratamento.
 */
export function mostrarFalhaAoAbrir(doc: Document = document): void {
  const raiz = doc.getElementById('root') ?? doc.body;
  const caixa = doc.createElement('div');
  caixa.setAttribute('role', 'alert');
  caixa.style.cssText =
    'min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;' +
    'gap:12px;padding:24px;text-align:center;font-family:Inter,system-ui,sans-serif;color:#17140F;background:#FAF7F2';
  const titulo = doc.createElement('p');
  titulo.textContent = 'Não deu para abrir a página agora.';
  titulo.style.cssText = 'font-size:20px;font-weight:600;margin:0';
  const botao = doc.createElement('button');
  botao.type = 'button';
  botao.textContent = 'Tentar de novo';
  botao.style.cssText =
    'border:0;border-radius:999px;padding:10px 20px;font-size:14px;font-weight:600;color:#fff;background:#17140F;cursor:pointer';
  botao.addEventListener('click', () => window.location.reload());
  caixa.append(titulo, botao);
  raiz.replaceChildren(caixa);
}

// Deploy novo entre o HTML e o código: recarrega uma vez (trava anti-laço, o
// mesmo padrão do lazyWithRetry). Se a trava segurou, ou o erro é outro, a
// mensagem simples aparece no lugar da tela em branco.
app.catch(async (err: unknown) => {
  try {
    if (isChunkError(err) && (await reloadForNewVersion())) return;
  } catch {
    /* segue pra mensagem */
  }
  console.error('[LM Flow] não deu para abrir a página', err);
  mostrarFalhaAoAbrir();
});
