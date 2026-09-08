import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const post = vi.fn();
const get = vi.fn();

vi.mock('@/services/core/api', () => ({
  default: {
    post: (...args: unknown[]) => post(...args),
    get: (...args: unknown[]) => get(...args),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import { contactsService } from './contactsService';

function blobResponse(body: string, type: string, filename?: string) {
  return {
    data: new Blob([body], { type }),
    headers: {
      'content-type': type,
      ...(filename ? { 'content-disposition': `attachment; filename="${filename}"` } : {}),
    },
  };
}

describe('exportação de contatos', () => {
  let click: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    post.mockReset();
    get.mockReset();

    click = vi.fn();
    // jsdom não implementa nem o endereço temporário do arquivo nem o clique
    // que dispara o download.
    (URL as unknown as { createObjectURL: unknown }).createObjectURL = vi.fn(() => 'blob:teste');
    (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(click);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('BAIXA o arquivo no navegador em vez de deixá-lo sair por e-mail', async () => {
    post.mockResolvedValue(blobResponse('conteudo', 'text/csv; charset=utf-8', 'contatos-2026-09-08-1200.csv'));

    const resultado = await contactsService.exportContacts({
      format: 'csv',
      column_names: ['name', 'email'],
    });

    expect(click).toHaveBeenCalled();
    expect(resultado.queued).toBe(false);
    expect(resultado.filename).toBe('contatos-2026-09-08-1200.csv');
  });

  it('manda os campos escolhidos no nome que o SERVIDOR lê', async () => {
    // O defeito original: a tela mandava `fields`, o servidor lia `column_names`,
    // e toda exportação saía com as mesmas quatro colunas.
    post.mockResolvedValue(blobResponse('x', 'text/csv'));

    await contactsService.exportContacts({
      format: 'csv',
      column_names: ['created_at', 'name', 'origem'],
    });

    const [, body, config] = post.mock.calls[0] as [string, Record<string, unknown>, { responseType: string }];
    expect(body.column_names).toEqual(['created_at', 'name', 'origem']);
    expect(body).not.toHaveProperty('fields');
    expect(config.responseType).toBe('blob');
  });

  it('avisa em vez de baixar quando a base é grande demais e o arquivo vai por e-mail', async () => {
    post.mockResolvedValue(
      blobResponse(
        JSON.stringify({ success: true, data: { queued: true, count: 50000 }, message: 'vai por e-mail' }),
        'application/json'
      )
    );

    const resultado = await contactsService.exportContacts({ format: 'xlsx', column_names: ['name'] });

    expect(resultado.queued).toBe(true);
    expect(resultado.count).toBe(50000);
    expect(click).not.toHaveBeenCalled();
  });

  it('devolve o motivo em português mesmo com o corpo do erro vindo como arquivo', async () => {
    // Com `responseType: 'blob'` o corpo do ERRO também chega como Blob: sem
    // reabri-lo, a recusa por cargo virava a frase genérica da tela.
    post.mockRejectedValue({
      response: {
        status: 403,
        data: new Blob([JSON.stringify({ error: 'forbidden', message: 'Seu cargo não permite esta ação' })], {
          type: 'application/json',
        }),
      },
    });

    await expect(
      contactsService.exportContacts({ format: 'csv', column_names: ['name'] })
    ).rejects.toMatchObject({
      response: { data: { message: 'Seu cargo não permite esta ação' } },
    });
  });

  it('busca no servidor quais colunas existem', async () => {
    get.mockResolvedValue({
      data: { data: { columns: [{ key: 'name', label: 'Nome', group: 'Básico', default: true }] } },
    });

    const columns = await contactsService.getExportColumns();

    expect(get).toHaveBeenCalledWith('/contacts/export_columns');
    expect(columns[0].label).toBe('Nome');
  });
});
