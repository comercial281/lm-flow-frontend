import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), loading: vi.fn() },
}));

import api from '@/services/core/api';

/**
 * O que este spec protege: o corretor não pode levar aviso vermelho de permissão
 * sem ter clicado em nada.
 *
 * O defeito que ele reproduz: o backend passou a conferir o cargo em TODA a API, e
 * o interceptador transformava QUALQUER recusa em toast — inclusive a dos pedidos
 * que a própria tela dispara sozinha pra se montar. Só de entrar no CRM, a busca
 * dos aplicativos do painel (chave que só o Administrador tem) já pintava um
 * vermelho em cima de uma tela que estava funcionando; abrir uma conversa pintava
 * mais dois.
 *
 * A regra é por VERBO e não por chamada marcada uma a uma, de propósito: o cargo
 * Corretor é uma lista fixa no servidor, então cada tela nova que ganha um botão
 * nasce com uma chave que ele não tem — marcar chamada por chamada consertaria as
 * de hoje e a próxima tela recriaria o problema.
 *
 * Leitura recusada = o pedaço da tela não aparece, calado. Escrita recusada
 * continua avisando: sem o aviso, o botão "não faz nada" e vira chamado de
 * suporte.
 */

// O interceptador de erro registrado pelo próprio api.ts é o primeiro da fila —
// o `applySetupInterceptor` (503 de setup) entra depois. Chamar o handler direto
// exercita o código de verdade sem nenhuma requisição de rede.
type Handler = { rejected?: (error: unknown) => Promise<unknown> };
const handlers = (api.interceptors.response as unknown as { handlers: Handler[] }).handlers;
const aoFalhar = handlers[0]?.rejected;

const recusa = (metodo: string, url: string, extra: Record<string, unknown> = {}) => ({
  config: { method: metodo, url, headers: {}, ...extra },
  response: {
    status: 403,
    data: {
      error: 'Forbidden - Insufficient permissions',
      message: 'Seu cargo não permite esta ação',
      required_permission: 'dashboard_apps.read',
    },
  },
  message: 'Request failed with status code 403',
});

const esperarRecusa = async (erro: unknown) => {
  await expect(aoFalhar!(erro)).rejects.toBeDefined();
};

describe('cliente de API — recusa por cargo (403)', () => {
  beforeEach(() => {
    vi.mocked(toast.error).mockClear();
  });

  it('existe um interceptador de erro para exercitar', () => {
    expect(typeof aoFalhar).toBe('function');
  });

  it('LEITURA recusada não vira aviso vermelho (é o app buscando sozinho)', async () => {
    // É literalmente o pedido que o corretor levava na cara ao logar.
    await esperarRecusa(recusa('get', '/dashboard_apps'));

    expect(toast.error).not.toHaveBeenCalled();
  });

  it('ESCRITA recusada continua avisando, nomeando a permissão que falta', async () => {
    const erro = recusa('post', '/conversations/42/claim');
    erro.response.data.required_permission = 'conversations.claim';

    await esperarRecusa(erro);

    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(vi.mocked(toast.error).mock.calls[0][0]).toContain('conversations.claim');
  });

  it('o aviso da escrita sobrevive sem `required_permission` no corpo', async () => {
    const erro = recusa('delete', '/contacts/7');
    erro.response.data.required_permission = undefined as unknown as string;

    await esperarRecusa(erro);

    expect(toast.error).toHaveBeenCalledTimes(1);
  });

  it('`silentForbidden` cala também a escrita de fundo', async () => {
    await esperarRecusa(recusa('post', '/conversations/42/update_last_seen', { silentForbidden: true }));

    expect(toast.error).not.toHaveBeenCalled();
  });

  it('erro que não é de permissão segue o caminho de sempre, sem toast daqui', async () => {
    await esperarRecusa({
      config: { method: 'get', url: '/pipelines', headers: {} },
      response: { status: 500, data: {} },
      message: 'Request failed with status code 500',
    });

    expect(toast.error).not.toHaveBeenCalled();
  });

  // HEAD/OPTIONS entram na mesma regra do GET: nenhum dos dois é clique de
  // ninguém, e deixá-los de fora reabriria a torneira pela porta dos fundos.
  it.each(['head', 'options'])('%s recusado também fica calado', async metodo => {
    await esperarRecusa(recusa(metodo, '/inboxes'));

    expect(toast.error).not.toHaveBeenCalled();
  });
});
