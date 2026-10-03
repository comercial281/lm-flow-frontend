import { describe, it, expect, vi, beforeEach } from 'vitest';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/services/core/api', () => ({ default: api }));

import { flowAutomationsService } from '@/services/flowAutomations/flowAutomationsService';
import { appliedFlowFrom, templatesFrom } from './templates';

const MODELO = { key: 'primeiro_contato', name: 'Primeiro contato com nova tentativa', description: 'Manda, espera 30 minutos e tenta de novo.' };

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
});

describe('modelos de fluxo', () => {
  it('lista pela rota GET /flow_automations/templates, com ou sem o envelope { data }', async () => {
    api.get.mockResolvedValueOnce({ data: { success: true, data: [MODELO] } });
    expect(await flowAutomationsService.templates()).toEqual([MODELO]);
    expect(api.get).toHaveBeenCalledWith('/flow_automations/templates');

    api.get.mockResolvedValueOnce({ data: [MODELO] });
    expect(await flowAutomationsService.templates()).toEqual([MODELO]);
  });

  it('item sem chave ou sem nome fica de fora; sem descrição vira texto vazio', () => {
    expect(templatesFrom([{ key: '', name: 'x' }, { key: 'a' }, null, { key: 'b', name: 'B' }])).toEqual([
      { key: 'b', name: 'B', description: '' },
    ]);
    expect(templatesFrom({ erro: 'x' })).toEqual([]);
    expect(templatesFrom(null)).toEqual([]);
  });

  it('usar o modelo: POST /flow_automations/templates/:key/apply devolve o fluxo criado', async () => {
    const criado = { id: 'f1', name: MODELO.name, is_enabled: false };
    api.post.mockResolvedValueOnce({ data: { data: criado } });
    expect(await flowAutomationsService.applyTemplate('primeiro_contato')).toEqual(criado);
    expect(api.post).toHaveBeenCalledWith('/flow_automations/templates/primeiro_contato/apply');

    api.post.mockResolvedValueOnce({ data: criado });
    expect(await flowAutomationsService.applyTemplate('primeiro_contato')).toEqual(criado);
  });

  it('resposta sem o fluxo é erro (a tela não navega pra lugar nenhum)', () => {
    expect(() => appliedFlowFrom({ data: null })).toThrow();
    expect(() => appliedFlowFrom({ ok: true })).toThrow();
  });
});
