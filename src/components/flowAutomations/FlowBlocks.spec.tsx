import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const forms = vi.hoisted(() => vi.fn());
const formQuestions = vi.hoisted(() => vi.fn());
const sendNumbers = vi.hoisted(() => vi.fn());
vi.mock('@/services/flowAutomations/flowAutomationsService', () => ({
  flowAutomationsService: { forms, formQuestions },
  flowAutomationFoldersService: {},
}));
vi.mock('@/services/numbers/numbersService', () => ({ default: { sendNumbers } }));

import { FormAnswerPicker } from './FormAnswerPicker';
import { FlowNodeConfigModal } from './FlowNodeConfigModal';
import { emptyFormAnswer, pickForm, type FormAnswerConfig } from '@/features/flowAutomations/formAnswer';
import type { AutomationResources } from '@/pages/Customer/Settings/LeadAutomations/LeadAutomationsEditors';
import type { FlowAutomationNode } from '@/types/flowAutomations';

const resources: AutomationResources = {
  labels: [], sequences: [], users: [], pipelines: [], stagesByPipeline: {}, quickReplies: [],
  adOrigins: [], formOrigins: [], messageFunnels: [], evolutionInstances: [],
  reloadFunnels: () => {}, reloadLabels: () => {}, loading: false,
};

beforeEach(() => {
  forms.mockReset();
  formQuestions.mockReset();
  sendNumbers.mockReset();
  sendNumbers.mockResolvedValue({ number_owner_rule: false, numbers: [] });
});

describe('Resposta do formulário', () => {
  it('lista os formulários com o rótulo Anúncio / Site', async () => {
    forms.mockResolvedValue([
      { source: 'meta', form_id: 'f1', name: 'Lançamento Vila Nova' },
      { source: 'site', form_id: 's1', name: 'Contato do site' },
    ]);
    render(<FormAnswerPicker value={emptyFormAnswer()} onChange={() => {}} />);
    expect(await screen.findByText('Lançamento Vila Nova')).toBeTruthy();
    expect(screen.getByText('Anúncio')).toBeTruthy();
    expect(screen.getByText('Site')).toBeTruthy();
  });

  it('se o Meta falhar, mostra o motivo e deixa digitar a pergunta', async () => {
    forms.mockResolvedValue([{ source: 'meta', form_id: 'f1', name: 'Lançamento Vila Nova' }]);
    formQuestions.mockResolvedValue({ questions: [], error: 'Não consegui ler as perguntas desse formulário no Meta agora' });
    const onChange = vi.fn();
    const value: FormAnswerConfig = pickForm(emptyFormAnswer(), { source: 'meta', form_id: 'f1', name: 'Lançamento Vila Nova' });
    render(<FormAnswerPicker value={value} onChange={onChange} />);
    expect(await screen.findByText('Não consegui ler as perguntas desse formulário no Meta agora')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Pergunta'), { target: { value: 'Qual o valor?' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ question_key: 'Qual o valor?', question_label: 'Qual o valor?' }));
  });

  it('múltipla escolha vira lista de opções pra marcar', async () => {
    forms.mockResolvedValue([{ source: 'meta', form_id: 'f1', name: 'Vila Nova' }]);
    formQuestions.mockResolvedValue({
      questions: [{ key: 'valor', label: 'Qual o valor?', type: 'x', options: [{ key: 'ate_300', value: 'Até R$ 300 mil' }] }],
      error: null,
    });
    const onChange = vi.fn();
    const value = { ...pickForm(emptyFormAnswer(), { source: 'meta', form_id: 'f1', name: 'Vila Nova' }), question_key: 'valor', question_label: 'Qual o valor?', match: 'any_of' as const };
    render(<FormAnswerPicker value={value} onChange={onChange} />);
    fireEvent.click(await screen.findByLabelText('Até R$ 300 mil'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ match: 'any_of', values: ['ate_300', 'Até R$ 300 mil'] }));
  });
});

const node = (patch: Partial<FlowAutomationNode>): FlowAutomationNode => ({
  id: 'n1', kind: 'wait_for_reply', label: null, config: {},
  next_node_id: null, next_yes_node_id: null, next_no_node_id: null, pos_x: null, pos_y: null, steps: [],
  ...patch,
});

describe('janela do bloco', () => {
  it('Aguardar resposta: "Sem limite" grava indefinite', async () => {
    const onSave = vi.fn();
    render(<FlowNodeConfigModal node={node({ config: { minutes: 30, indefinite: false } })} resources={resources} onClose={() => {}} onSave={onSave} />);
    expect(screen.getByText('Respondeu: o lead mandou qualquer mensagem depois da última que este fluxo enviou.')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Sem limite (espera até o lead responder)'));
    fireEvent.click(screen.getByText('Salvar'));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('n1', expect.objectContaining({ config: expect.objectContaining({ indefinite: true }) })));
  });

  it('Aguardar resposta: 2 horas vira 120 minutos', async () => {
    const onSave = vi.fn();
    render(<FlowNodeConfigModal node={node({ config: { minutes: 30, indefinite: false } })} resources={resources} onClose={() => {}} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText('Unidade'), { target: { value: 'h' } });
    fireEvent.change(screen.getByLabelText('Prazo'), { target: { value: '2' } });
    fireEvent.click(screen.getByText('Salvar'));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('n1', expect.objectContaining({ config: expect.objectContaining({ minutes: 120 }) })));
  });

  it('Mandar WhatsApp tem "Enviar pelo número"', async () => {
    render(<FlowNodeConfigModal node={node({ kind: 'send_whatsapp', config: { text: 'Oi' } })} resources={resources} onClose={() => {}} onSave={() => {}} />);
    expect(await screen.findByText('Enviar pelo número')).toBeTruthy();
    expect(screen.getByText('O número do responsável pelo lead')).toBeTruthy();
  });

  it('ação das Automações: o editor da regra, gravando { action_type, params }', async () => {
    const onSave = vi.fn();
    render(<FlowNodeConfigModal node={node({ kind: 'lead_action', config: { action_type: 'notify_broker', params: {} } })} resources={resources} onClose={() => {}} onSave={onSave} />);
    expect(screen.getByRole('heading', { name: 'Avisar corretor' })).toBeTruthy();
    fireEvent.click(screen.getByText('Salvar'));
    expect(screen.getByRole('alert').textContent).toBe('Falta preencher a mensagem.');
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.change(screen.getByPlaceholderText('Novo lead: {{nome}} — {{telefone}}'), { target: { value: 'Lead novo: {{nome}}' } });
    fireEvent.click(screen.getByText('Salvar'));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('n1', expect.objectContaining({
      config: { action_type: 'notify_broker', params: { message: 'Lead novo: {{nome}}' } },
    })));
  });

  it('bloco escondido abre com o aviso e sem Salvar', () => {
    render(<FlowNodeConfigModal node={node({ kind: 'http_call', config: { url: 'x' } })} resources={resources} onClose={() => {}} onSave={() => {}} />);
    expect(screen.getByText(/Este bloco volta na próxima versão/)).toBeTruthy();
    expect(screen.queryByText('Salvar')).toBeNull();
  });
});
