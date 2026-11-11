import { describe, it, expect, vi, beforeEach } from 'vitest';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/services/core/api', () => ({ default: api }));

import { flowAutomationsService } from '@/services/flowAutomations/flowAutomationsService';

const PREVIEW = { text: 'Oi, tudo bem?', source: 'ia' as const, reason_text: null, answers: { regiao: 'Zona Sul' } };
const LEAD = { id: 'lead-1', name: 'Maria Teste', form_name: 'Formulário de exemplo', created_at: '2026-11-10T12:00:00Z' };
const BODY = { instruction: 'Apresente-se pelo nome.', fallback_text: 'Oi! Podemos conversar?', contact_id: 'contact-1', send_from_inbox_id: null };

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
});

describe('Mensagem com IA: serviço do Testar', () => {
  it('aiMessagePreview manda o corpo exato pela rota de prévia e desembrulha data', async () => {
    api.post.mockResolvedValueOnce({ data: { success: true, data: PREVIEW } });

    expect(await flowAutomationsService.aiMessagePreview('flow-1', BODY)).toEqual(PREVIEW);
    expect(api.post).toHaveBeenCalledWith('/flow_automations/flow-1/ai_message_preview', BODY);
  });

  it('aiMessageLeads lista pela rota de leads com form_id e desembrulha data', async () => {
    api.get.mockResolvedValueOnce({ data: { success: true, data: [LEAD] } });

    expect(await flowAutomationsService.aiMessageLeads('flow-1', 'form-9')).toEqual([LEAD]);
    expect(api.get).toHaveBeenCalledWith('/flow_automations/flow-1/ai_message_leads', { params: { form_id: 'form-9' } });
  });

  it('aiMessageLeads sem formulário não manda form_id', async () => {
    api.get.mockResolvedValueOnce({ data: { success: true, data: [] } });

    expect(await flowAutomationsService.aiMessageLeads('flow-1')).toEqual([]);
    expect(api.get).toHaveBeenCalledWith('/flow_automations/flow-1/ai_message_leads', { params: {} });
  });

  it('erro 429 vira Error com a frase do servidor, não com o erro genérico do cliente HTTP', async () => {
    const frase = 'Limite de 60 testes por hora neste fluxo. Libera às 14:30.';
    api.post.mockRejectedValueOnce(Object.assign(new Error('Request failed with status code 429'), {
      response: { status: 429, data: { errors: [frase] } },
    }));

    await expect(flowAutomationsService.aiMessagePreview('flow-1', BODY)).rejects.toThrow(frase);
  });

  it('erro 422 também mostra a frase do servidor', async () => {
    api.post.mockRejectedValueOnce(Object.assign(new Error('Request failed with status code 422'), {
      response: { status: 422, data: { errors: ['Escreva a instrução do bloco.'] } },
    }));

    await expect(flowAutomationsService.aiMessagePreview('flow-1', BODY)).rejects.toThrow('Escreva a instrução do bloco.');
  });

  it('sem frase do servidor (ex.: rede caiu), o erro original segue', async () => {
    api.post.mockRejectedValueOnce(new Error('Network Error'));

    await expect(flowAutomationsService.aiMessagePreview('flow-1', BODY)).rejects.toThrow('Network Error');
  });
});
