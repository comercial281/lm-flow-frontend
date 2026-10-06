import { describe, expect, it, vi, beforeEach } from 'vitest';

const get = vi.hoisted(() => vi.fn());
vi.mock('@/services/core/api', () => ({ default: { get } }));

import { salesAgentsService } from './salesAgentsService';

const SERGIO = { id: 'v1', nome: 'Sergio', descricao: 'Masculina, grave', genero: 'masculina', preview_url: 'https://x/s.mp3' };

beforeEach(() => get.mockReset());

describe('salesAgentsService.voices', () => {
  it('lê a lista do catálogo no endereço das vozes', async () => {
    get.mockResolvedValue({ data: { voices: [SERGIO] } });
    expect(await salesAgentsService.voices()).toEqual([SERGIO]);
    expect(get).toHaveBeenCalledWith('/sales_agents/voices');
  });

  // O corpo da API às vezes vem embrulhado em `data` (success_response). A Task 3.0
  // anota qual é; aqui os dois funcionam.
  it('aceita o corpo embrulhado em data', async () => {
    get.mockResolvedValue({ data: { data: { voices: [SERGIO] } } });
    expect(await salesAgentsService.voices()).toEqual([SERGIO]);
  });

  it('sem lista, devolve vazio (a página mostra só a voz gravada)', async () => {
    get.mockResolvedValue({ data: {} });
    expect(await salesAgentsService.voices()).toEqual([]);
  });
});
