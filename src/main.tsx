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

const app = ehEnderecoDoSistema(window.location.hostname)
  ? import('./mainDoSistema')
  : import('./mainDoSite');

// Deploy novo entre o HTML e o código: recarrega uma vez (trava anti-laço).
app.catch((err) => {
  if (isChunkError(err)) void reloadForNewVersion();
  else throw err;
});
