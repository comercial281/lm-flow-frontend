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
import { FlowNodePanel } from './FlowNodePanel';
import { emptyFormAnswer, pickForm, type FormAnswerConfig } from '@/features/flowAutomations/formAnswer';
import type { AutomationResources } from '@/features/flowAutomations/editores/LeadAutomationsEditors';
import type { FlowAutomationNode } from '@/types/flowAutomations';

const resources: AutomationResources = {
  labels: [], followupFlows: [], users: [], pipelines: [], stagesByPipeline: {}, quickReplies: [],
  adOrigins: [], formOrigins: [], messageFunnels: [], conversationFunnels: [], evolutionInstances: [],
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

describe('etiquetas com o catálogo fora do ar', () => {
  const falhou = { ...resources, erros: { labels: true }, recarregar: () => {} };
  it('Aplicar etiqueta: etiqueta salva não vira "não existe mais" e oferece Tentar de novo', () => {
    render(<FlowNodePanel node={node({ kind: 'add_label', config: { labels: ['quente'] } })} resources={falhou} onClose={() => {}} onSave={() => {}} />);
    expect(screen.queryByText('não existe mais')).toBeNull();
    expect(screen.getByText('Tentar de novo')).toBeTruthy();
  });
  it('Condição Tem a etiqueta: mesmo cuidado', () => {
    render(<FlowNodePanel node={node({ kind: 'condition', config: { criterion: 'has_label', label: 'quente' } })} resources={falhou} onClose={() => {}} onSave={() => {}} />);
    expect(screen.queryByText('não existe mais')).toBeNull();
    expect(screen.getByText('Tentar de novo')).toBeTruthy();
  });
  it('carregando: mostra o carregando, nunca "Nenhuma etiqueta ainda"', () => {
    render(<FlowNodePanel node={node({ kind: 'condition', config: { criterion: 'has_label' } })} resources={{ ...resources, loading: true }} onClose={() => {}} onSave={() => {}} />);
    expect(screen.getByText('Carregando as etiquetas…')).toBeTruthy();
    expect(screen.queryByText(/Nenhuma etiqueta ainda/)).toBeNull();
  });
});

describe('janela do bloco', () => {
  it('Aguardar resposta: "Sem limite" grava indefinite', async () => {
    const onSave = vi.fn();
    render(<FlowNodePanel node={node({ config: { minutes: 30, indefinite: false } })} resources={resources} onClose={() => {}} onSave={onSave} />);
    expect(screen.getByRole('radiogroup', { name: 'Até quando esperar?' })).toBeTruthy();
    expect(screen.getByText('Respondeu')).toBeTruthy();
    expect(screen.getByText('Não respondeu')).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'Sem limite' }));
    expect(screen.getByText('Respondeu')).toBeTruthy();
    expect(screen.queryByText('Não respondeu')).toBeNull();
    fireEvent.click(screen.getByText('Salvar'));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('n1', expect.objectContaining({ config: expect.objectContaining({ indefinite: true }) })));
  });

  it('Esperar: escolha em botões e unidade no singular com 1', () => {
    render(<FlowNodePanel node={node({ kind: 'wait', config: { mode: 'interval', minutes: 1440 } })} resources={resources} onClose={() => {}} onSave={() => {}} />);
    expect(screen.getByRole('radiogroup', { name: 'Esperar como?' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Por um tempo' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Até uma data e hora' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'dia' })).toBeTruthy();
  });

  it('Aguardar resposta: 2 horas vira 120 minutos', async () => {
    const onSave = vi.fn();
    render(<FlowNodePanel node={node({ config: { minutes: 30, indefinite: false } })} resources={resources} onClose={() => {}} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText('Unidade'), { target: { value: 'h' } });
    fireEvent.change(screen.getByLabelText('Prazo'), { target: { value: '2' } });
    fireEvent.click(screen.getByText('Salvar'));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('n1', expect.objectContaining({ config: expect.objectContaining({ minutes: 120 }) })));
  });

  it('Condição: rótulo, saídas Sim e Não e a frase do Não vazio', () => {
    render(<FlowNodePanel node={node({ kind: 'condition', config: { criterion: 'has_email' } })} resources={resources} onClose={() => {}} onSave={() => {}} />);
    expect(screen.getByText('Seguir pelo Sim quando')).toBeTruthy();
    expect(screen.getByText('Sim')).toBeTruthy();
    expect(screen.getByText('Não')).toBeTruthy();
    expect(screen.getByText('Sem nada ligado no Não, o fluxo para aqui pra esse lead.')).toBeTruthy();
  });

  it('Só continuar se com critério abre com a janela da Condição', () => {
    render(<FlowNodePanel node={node({ kind: 'filter_label', config: { criterion: 'has_email' } })} resources={resources} onClose={() => {}} onSave={() => {}} />);
    expect(screen.getByText('Seguir pelo Sim quando')).toBeTruthy();
    expect(screen.getByText('Sim')).toBeTruthy();
  });

  it('Só continuar se com critério: título e descrição já são os da Condição', () => {
    render(<FlowNodePanel node={node({ kind: 'filter_label', config: { criterion: 'has_email' } })} resources={resources} onClose={() => {}} onSave={() => {}} />);
    expect(screen.getByText('Condição')).toBeTruthy();
    expect(screen.getByText('Confere algo do lead e segue pelo Sim ou pelo Não.')).toBeTruthy();
    expect(screen.queryByText('Só continuar se')).toBeNull();
  });

  it('Só continuar se com critério no modo guiado abre como sempre', () => {
    render(<FlowNodePanel guided node={node({ kind: 'filter_label', config: { criterion: 'has_email' } })} resources={resources} onClose={() => {}} onSave={() => {}} />);
    expect(screen.getByText('Só continua se')).toBeTruthy();
    expect(screen.queryByText('Sim')).toBeNull();
    expect(screen.queryByText('Seguir pelo Sim quando')).toBeNull();
  });

  it('Só continuar se legado (só etiquetas) abre como sempre', () => {
    render(<FlowNodePanel node={node({ kind: 'filter_label', config: { labels: ['x'], mode: 'any' } })} resources={resources} onClose={() => {}} onSave={() => {}} />);
    expect(screen.getByText('Só continua se')).toBeTruthy();
    expect(screen.queryByText('Sim')).toBeNull();
  });

  it('Mensagem tem "Enviar pelo número"', async () => {
    render(<FlowNodePanel node={node({ kind: 'send_whatsapp', config: { text: 'Oi' } })} resources={resources} onClose={() => {}} onSave={() => {}} />);
    expect(await screen.findByText('Enviar pelo número')).toBeTruthy();
    expect(screen.getByText('O número do responsável pelo lead')).toBeTruthy();
    expect(screen.getByLabelText('Marcar progresso')).toBeTruthy();
    expect(screen.getByText('A mensagem sai marcada como automática, igual o Follow-up.')).toBeTruthy();
  });

  it('Mensagem no funil de conversa: a sequência sem book, e só a frase do número da conversa', () => {
    render(<FlowNodePanel node={node({ kind: 'send_whatsapp', config: { text: 'Oi' } })} resources={resources} onClose={() => {}} onSave={() => {}} flowKind="conversation" />);
    expect(screen.getByText('Itens em sequência (1)')).toBeTruthy();
    expect(screen.getByText('Sai pelo número da conversa em que você disparar o funil.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Book do imóvel' })).toBeNull();
    expect(screen.queryByText('Enviar pelo número')).toBeNull();
    expect(screen.queryByLabelText('Marcar progresso')).toBeNull();
  });

  it('ação das Automações: o editor da regra, gravando { action_type, params }', async () => {
    const onSave = vi.fn();
    render(<FlowNodePanel node={node({ kind: 'lead_action', config: { action_type: 'notify_broker', params: {} } })} resources={resources} onClose={() => {}} onSave={onSave} />);
    expect(screen.getByRole('heading', { name: 'Notificação' })).toBeTruthy();
    fireEvent.click(screen.getByText('Salvar'));
    expect(screen.getByRole('alert').textContent).toBe('Falta preencher a mensagem.');
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.change(screen.getByPlaceholderText('Novo lead: {{nome}} — {{telefone}}'), { target: { value: 'Lead novo: {{nome}}' } });
    fireEvent.click(screen.getByText('Salvar'));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('n1', expect.objectContaining({
      config: { action_type: 'notify_broker', params: { message: 'Lead novo: {{nome}}' } },
    })));
  });

  it('Notificação: trocar Avisar quem para O gestor grava notify_gestor e mantém a mensagem', async () => {
    const onSave = vi.fn();
    render(<FlowNodePanel node={node({ kind: 'lead_action', config: { action_type: 'notify_broker', params: { message: 'Lead novo' } } })} resources={resources} onClose={() => {}} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText('Avisar quem'), { target: { value: 'gestor' } });
    fireEvent.click(screen.getByText('Salvar'));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('n1', expect.objectContaining({
      config: { action_type: 'notify_gestor', params: { message: 'Lead novo' } },
    })));
  });

  it('Notificação: grupo -> pessoa -> grupo devolve o grupo e o número gravados', async () => {
    const onSave = vi.fn();
    const config = { action_type: 'notify_group', params: { group_jid: 'g1@g.us', instance: 'inst-1', message: 'Lead novo' } };
    render(<FlowNodePanel node={node({ kind: 'lead_action', config })} resources={resources} onClose={() => {}} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText('Avisar quem'), { target: { value: 'pessoa' } });
    fireEvent.change(screen.getByLabelText('Avisar quem'), { target: { value: 'grupo' } });
    fireEvent.click(screen.getByText('Salvar'));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('n1', expect.objectContaining({
      config: { action_type: 'notify_group', params: { group_jid: 'g1@g.us', instance: 'inst-1', message: 'Lead novo' } },
    })));
  });

  it('Notificação no modo guiado: "Avisar quem" e "Por onde" travados, os campos seguem', () => {
    render(<FlowNodePanel guided node={node({ kind: 'lead_action', config: { action_type: 'notify_push', params: { user_ids: ['u1'], title: 'T', message: 'Oi' } } })} resources={resources} onClose={() => {}} onSave={() => {}} />);
    expect((screen.getByLabelText('Avisar quem') as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByLabelText('Por onde') as HTMLSelectElement).disabled).toBe(true);
    const mensagem = screen.getByDisplayValue('Oi') as HTMLTextAreaElement | HTMLInputElement;
    expect(mensagem.disabled).toBe(false);
  });

  it('bloco antigo notify_push abre com Uma pessoa da equipe + Aviso no app', () => {
    render(<FlowNodePanel node={node({ kind: 'lead_action', config: { action_type: 'notify_push', params: { user_ids: ['u1'], message: 'Oi' } } })} resources={resources} onClose={() => {}} onSave={() => {}} />);
    expect((screen.getByLabelText('Avisar quem') as HTMLSelectElement).value).toBe('pessoa');
    expect((screen.getByLabelText('Por onde') as HTMLSelectElement).value).toBe('app');
    expect(screen.getByText('Uma pessoa da equipe')).toBeTruthy();
    expect(screen.getByText('Aviso no app')).toBeTruthy();
  });

  // 06/10/2026: o fim do Follow-up padrão. Sem o editor das regras (que não conhece a
  // ação e trocaria o action_type por vazio), e o Salvar devolve a config intacta.
  it('Marcar follow-up encerrado: abre com o nome, sem campos, e salva sem perder a ação', async () => {
    const onSave = vi.fn();
    render(<FlowNodePanel node={node({ kind: 'lead_action', config: { action_type: 'followup_ended', params: {} } })} resources={resources} onClose={() => {}} onSave={onSave} />);
    expect(screen.getByRole('heading', { name: 'Marcar follow-up encerrado' })).toBeTruthy();
    expect(screen.getByText('Sem configuração adicional.')).toBeTruthy();
    fireEvent.click(screen.getByText('Salvar'));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('n1', expect.objectContaining({
      config: { action_type: 'followup_ended', params: {} },
    })));
  });

  it('Mensagem com um texto: abre com o foco no texto, não no "Duplicar" do item', async () => {
    render(<FlowNodePanel node={node({ kind: 'send_whatsapp', config: { text: 'Oi' } })} resources={resources} onClose={() => {}} onSave={() => {}} />);
    await screen.findByText('Enviar pelo número');
    expect(document.activeElement?.tagName).toBe('TEXTAREA');
    expect((document.activeElement as HTMLTextAreaElement).value).toBe('Oi');
  });

  it('bloco renomeado: o nome dado vira o título e o tipo vai pra frente da descrição', () => {
    render(<FlowNodePanel node={node({ label: 'Lembrete do sábado' })} resources={resources} onClose={() => {}} onSave={() => {}} />);
    const janela = screen.getByRole('dialog', { name: 'Lembrete do sábado' });
    expect(janela).toBeTruthy();
    expect(screen.getByText(/^Aguardar resposta · /)).toBeTruthy();
  });

  it('bloco sem nome dado: o título é o tipo do bloco', () => {
    render(<FlowNodePanel node={node({ label: '  ' })} resources={resources} onClose={() => {}} onSave={() => {}} />);
    expect(screen.getByRole('dialog', { name: 'Aguardar resposta' })).toBeTruthy();
    expect(screen.queryByText(/^Aguardar resposta · /)).toBeNull();
  });

  it('bloco escondido abre com o aviso e sem Salvar', () => {
    render(<FlowNodePanel node={node({ kind: 'http_call', config: { url: 'x' } })} resources={resources} onClose={() => {}} onSave={() => {}} />);
    expect(screen.getByText(/Este bloco volta na próxima versão/)).toBeTruthy();
    expect(screen.queryByText('Salvar')).toBeNull();
  });
});
