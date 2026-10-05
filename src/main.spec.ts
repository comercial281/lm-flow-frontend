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

/* Se nem o app conseguiu subir: pedaço que sumiu num deploy recarrega uma vez
   (o padrão do lazyWithRetry); qualquer outro erro vira uma mensagem simples na
   tela, nunca rejeição sem tratamento nem tela em branco. */
describe('entrada do app: falha ao subir', () => {
  const recarga = { chunk: false, recarregou: true, chamadas: 0 };

  async function falharEm(hostname: string) {
    recarga.chamadas = 0;
    vi.resetModules();
    document.body.innerHTML = '<div id="root"></div>';
    vi.doMock('./mainDoSite', () => { throw new Error('quebrou'); });
    vi.doMock('./mainDoSistema', () => { throw new Error('quebrou'); });
    vi.doMock('./utils/chunkReload', () => ({
      isChunkError: () => recarga.chunk,
      reloadForNewVersion: async () => { recarga.chamadas += 1; return recarga.recarregou; },
    }));
    vi.stubGlobal('location', { ...window.location, hostname });
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});
    const rejeicoes: unknown[] = [];
    const naoTratada = (e: PromiseRejectionEvent) => rejeicoes.push(e.reason);
    window.addEventListener('unhandledrejection', naoTratada);
    await import('./main');
    await new Promise(r => setTimeout(r, 20));
    window.removeEventListener('unhandledrejection', naoTratada);
    return { erro, rejeicoes };
  }

  afterEach(() => {
    vi.doUnmock('./mainDoSite');
    vi.doUnmock('./mainDoSistema');
    vi.doUnmock('./utils/chunkReload');
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('pedaço sumido depois do deploy: recarrega uma vez, sem mensagem', async () => {
    recarga.chunk = true;
    recarga.recarregou = true;
    const { rejeicoes } = await falharEm('www.imobiliaria.com.br');
    expect(recarga.chamadas).toBe(1);
    expect(document.querySelector('[role="alert"]')).toBeNull();
    expect(rejeicoes).toEqual([]);
  });

  it('pedaço sumido, mas a trava anti-laço segurou a recarga: mensagem na tela', async () => {
    recarga.chunk = true;
    recarga.recarregou = false;
    await falharEm('www.imobiliaria.com.br');
    expect(document.getElementById('root')?.textContent).toContain('Não deu para abrir a página agora.');
  });

  it.each(['www.imobiliaria.com.br', 'app.lmflow.com.br'])(
    '%s com outro erro: mensagem simples com Tentar de novo, erro no console e nenhuma rejeição solta',
    async host => {
      recarga.chunk = false;
      const { erro, rejeicoes } = await falharEm(host);
      expect(recarga.chamadas).toBe(0);
      const raiz = document.getElementById('root')!;
      expect(raiz.querySelector('[role="alert"]')?.textContent).toContain('Não deu para abrir a página agora.');
      expect(raiz.querySelector('button')?.textContent).toBe('Tentar de novo');
      expect(erro).toHaveBeenCalled();
      expect(rejeicoes).toEqual([]);
    },
  );
});
