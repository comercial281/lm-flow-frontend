import { afterEach, describe, expect, it, vi } from 'vitest';

/* A entrada decide PELO ENDEREÇO qual app sobe, antes de montar qualquer coisa:
   no domínio do cliente, o app do CRM (com login, sessão e websocket) nem é
   importado. */

const subiu = { lista: [] as string[] };

async function abrirEm(hostname: string) {
  subiu.lista = [];
  vi.resetModules();
  vi.doMock('./mainDoSistema', () => { subiu.lista.push('sistema'); return {}; });
  vi.doMock('./mainDoSite', () => { subiu.lista.push('site'); return {}; });
  vi.stubGlobal('location', { ...window.location, hostname });
  await import('./main');
  await vi.waitFor(() => expect(subiu.lista.length).toBe(1));
  return subiu.lista[0];
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('entrada do app', () => {
  it.each(['app.lmflow.com.br', 'imob.lmflow.com.br', 'lm-flow-git-x.vercel.app', 'localhost', '127.0.0.1'])(
    '%s sobe o CRM', async host => expect(await abrirEm(host)).toBe('sistema'),
  );

  it.each(['www.imobiliaria.com.br', 'imobiliaria.com.br'])(
    '%s sobe só o site', async host => expect(await abrirEm(host)).toBe('site'),
  );
});
