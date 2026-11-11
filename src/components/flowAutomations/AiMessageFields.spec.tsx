import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';

// Bloco "Mensagem com IA" (11/11/2026): a janela (instrução, reserva, Testar) e o cartão.

const aiMessagePreview = vi.hoisted(() => vi.fn());
const aiMessageLeads = vi.hoisted(() => vi.fn());
vi.mock('@/services/flowAutomations/flowAutomationsService', () => ({
  flowAutomationsService: { aiMessagePreview, aiMessageLeads },
  flowAutomationFoldersService: {},
}));
const sendNumbers = vi.hoisted(() => vi.fn());
vi.mock('@/services/numbers/numbersService', () => ({ default: { sendNumbers } }));

import { AiMessageFields } from './AiMessageFields';
import { FlowNodeCard, type FlowNodeCardData } from './FlowNodeCard';
import { FlowNodePanel } from './FlowNodePanel';
import type { AutomationResources } from '@/features/flowAutomations/editores/LeadAutomationsEditors';
import { formularioDoGatilho } from '@/features/flowAutomations/aiMessage';
import { nodeProblem } from '@/features/flowAutomations/readiness';
import type { FlowAutomationNode, FlowNodeConfig } from '@/types/flowAutomations';

const LEADS = [
  { id: 'c1', name: 'Rodrigo Teste', form_name: 'Formulário Vila Nova', created_at: '2026-11-10T12:00:00Z' },
  { id: 'c2', name: 'Marina Exemplo', form_name: null, created_at: '2026-11-09T12:00:00Z' },
];

let last: FlowNodeConfig = {};
function Janela({ start = { instruction: 'Oi ', fallback_text: 'Olá, esse é o seu WhatsApp?' }, readOnly = false, formId = null }: {
  start?: FlowNodeConfig;
  readOnly?: boolean;
  formId?: string | null;
}) {
  const [config, setConfig] = useState<FlowNodeConfig>(start);
  last = config;
  return (
    <AiMessageFields
      config={config}
      onChange={setConfig}
      readOnly={readOnly}
      automationId="flow-1"
      formId={formId}
      numeroDoFluxo={<p>Sai pelo número do fluxo</p>}
    />
  );
}

async function escolherLead(id = 'c1') {
  const seletor = await screen.findByLabelText('Lead pra testar');
  await screen.findByRole('option', { name: /Rodrigo Teste/ });
  fireEvent.change(seletor, { target: { value: id } });
}

beforeEach(() => {
  aiMessagePreview.mockReset();
  aiMessageLeads.mockReset();
  aiMessageLeads.mockResolvedValue(LEADS);
  sendNumbers.mockReset();
  sendNumbers.mockResolvedValue({ number_owner_rule: false, numbers: [] });
  last = {};
});

describe('janela da Mensagem com IA', () => {
  it('mostra instrução e mensagem reserva com a barra de variáveis', async () => {
    render(<Janela />);
    expect(screen.getByLabelText(/Instrução para a IA/)).toHaveValue('Oi ');
    expect(screen.getByLabelText(/Mensagem reserva/)).toHaveValue('Olá, esse é o seu WhatsApp?');
    expect(screen.getAllByText('Inserir variável:')).toHaveLength(2);
    expect(screen.getByText('Diga quem fala, o tom, o que citar do formulário e como terminar. A IA lê sozinha as respostas do formulário do lead.')).toBeInTheDocument();
    expect(screen.getByText('Sai se a IA não responder.')).toBeInTheDocument();
    expect(screen.getByText('O próximo bloco precisa combinar com a pergunta que a instrução manda fazer.')).toBeInTheDocument();
    expect(screen.getByText('Sai pelo número do fluxo')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Não mandar se a IA já estiver conversando/ })).toBeInTheDocument();
    await screen.findByRole('option', { name: /Rodrigo Teste/ });
  });

  it('tocar numa variável põe no cursor da instrução', async () => {
    render(<Janela />);
    const instrucao = screen.getByLabelText(/Instrução para a IA/) as HTMLTextAreaElement;
    instrucao.focus();
    instrucao.setSelectionRange(3, 3);
    fireEvent.click(screen.getAllByRole('button', { name: 'Nome {{nome}}' })[0]);
    expect(last.instruction).toBe('Oi {{nome}}');
    expect(last.fallback_text).toBe('Olá, esse é o seu WhatsApp?');
    await screen.findByRole('option', { name: /Rodrigo Teste/ });
  });

  it('lista os leads do formulário do gatilho', async () => {
    render(<Janela formId="form-9" />);
    await screen.findByRole('option', { name: /Rodrigo Teste · Formulário Vila Nova/ });
    expect(aiMessageLeads).toHaveBeenCalledWith('flow-1', 'form-9');
  });

  it('formulário novo sem lead: busca de novo sem filtro e avisa', async () => {
    aiMessageLeads.mockResolvedValueOnce([]).mockResolvedValueOnce(LEADS);
    render(<Janela formId="form-novo" />);
    await screen.findByRole('option', { name: /Rodrigo Teste/ });
    expect(aiMessageLeads).toHaveBeenNthCalledWith(1, 'flow-1', 'form-novo');
    expect(aiMessageLeads).toHaveBeenNthCalledWith(2, 'flow-1');
    expect(screen.getByText('Ainda não há lead deste formulário: mostrando leads de outros formulários.')).toBeInTheDocument();
  });

  it('formulário com lead não busca de novo nem avisa', async () => {
    render(<Janela formId="form-9" />);
    await screen.findByRole('option', { name: /Rodrigo Teste/ });
    expect(aiMessageLeads).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Ainda não há lead deste formulário/)).toBeNull();
  });

  it('a barra da instrução não oferece Telefone, E-mail nem Respostas; a da reserva segue completa', async () => {
    render(<Janela />);
    const [daInstrucao, daReserva] = screen.getAllByRole('button', { name: 'Mais variáveis' });
    fireEvent.click(daInstrucao);
    expect(screen.queryByRole('button', { name: /Telefone/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /E-mail/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Respostas form/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Data {{data}}' })).toBeInTheDocument();
    fireEvent.click(daReserva);
    expect(screen.getByRole('button', { name: /Telefone/ })).toBeInTheDocument();
    await screen.findByRole('option', { name: /Rodrigo Teste/ });
  });

  it('Testar mensagem manda a instrução da tela e mostra o balão', async () => {
    aiMessagePreview.mockResolvedValue({
      text: 'Oi Rodrigo, aqui é a *Bianca*. Esse é o seu WhatsApp?',
      source: 'ia',
      reason_text: null,
      answers: { 'Qual região?': 'Zona Leste', 'Vai usar FGTS?': 'Sim' },
    });
    render(<Janela />);
    fireEvent.change(screen.getByLabelText(/Instrução para a IA/), { target: { value: 'Apresente-se como Bianca.' } });
    await escolherLead();
    fireEvent.click(screen.getByRole('button', { name: 'Testar mensagem' }));
    expect(await screen.findByTestId('bolha-do-whatsapp')).toHaveTextContent('Oi Rodrigo, aqui é a Bianca. Esse é o seu WhatsApp?');
    expect(screen.getByText('Bianca').tagName).toBe('STRONG');
    expect(aiMessagePreview).toHaveBeenCalledWith('flow-1', {
      instruction: 'Apresente-se como Bianca.',
      fallback_text: 'Olá, esse é o seu WhatsApp?',
      contact_id: 'c1',
      send_from_inbox_id: null,
    });
    const respostas = screen.getByRole('button', { name: 'Respostas que a IA leu (2)' });
    expect(respostas).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Zona Leste')).toBeNull();
    fireEvent.click(respostas);
    expect(screen.getByText('Zona Leste')).toBeInTheDocument();
  });

  it('Gerar de novo chama outra vez', async () => {
    aiMessagePreview
      .mockResolvedValueOnce({ text: 'Primeira versão', source: 'ia', reason_text: null, answers: {} })
      .mockResolvedValueOnce({ text: 'Segunda versão', source: 'ia', reason_text: null, answers: {} });
    render(<Janela />);
    await escolherLead();
    fireEvent.click(screen.getByRole('button', { name: 'Testar mensagem' }));
    expect(await screen.findByText('Primeira versão')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Gerar de novo' }));
    expect(await screen.findByText('Segunda versão')).toBeInTheDocument();
    expect(aiMessagePreview).toHaveBeenCalledTimes(2);
  });

  it('saiu a reserva: mostra o Aviso com o motivo', async () => {
    aiMessagePreview.mockResolvedValue({
      text: 'Olá, esse é o seu WhatsApp?', source: 'reserva', reason_text: 'A IA demorou, saiu a mensagem reserva.', answers: {},
    });
    render(<Janela />);
    await escolherLead();
    fireEvent.click(screen.getByRole('button', { name: 'Testar mensagem' }));
    expect(await screen.findByText('A IA demorou, saiu a mensagem reserva.')).toBeInTheDocument();
    expect(screen.getByTestId('bolha-do-whatsapp')).toHaveTextContent('Olá, esse é o seu WhatsApp?');
  });

  it('limite por hora: mostra a frase do servidor', async () => {
    aiMessagePreview.mockRejectedValue(new Error('Limite de 60 testes por hora neste fluxo. Libera às 15:40.'));
    render(<Janela />);
    await escolherLead();
    fireEvent.click(screen.getByRole('button', { name: 'Testar mensagem' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Limite de 60 testes por hora neste fluxo. Libera às 15:40.');
    expect(screen.queryByTestId('bolha-do-whatsapp')).toBeNull();
  });

  it('lista de leads que falhou mostra a frase do erro', async () => {
    aiMessageLeads.mockRejectedValue(new Error('Não deu pra testar agora. Tente de novo em instantes.'));
    render(<Janela />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Não deu pra testar agora. Tente de novo em instantes.');
    expect(screen.getByRole('button', { name: 'Testar mensagem' })).toBeDisabled();
  });

  it('abre no lead mais novo, pronto pra testar', async () => {
    render(<Janela />);
    await screen.findByRole('option', { name: /Rodrigo Teste/ });
    expect(screen.getByLabelText('Lead pra testar')).toHaveValue('c1');
    expect(screen.getByRole('button', { name: 'Testar mensagem' })).toBeEnabled();
  });

  it('sem lead nenhum o botão fica desligado', async () => {
    aiMessageLeads.mockResolvedValue([]);
    render(<Janela />);
    expect(await screen.findByText('Nenhum lead com respostas de formulário ainda.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Testar mensagem' })).toBeDisabled();
  });

  it('mexer na instrução depois do teste some com o balão', async () => {
    aiMessagePreview.mockResolvedValue({ text: 'Primeira versão', source: 'reserva', reason_text: 'A IA demorou, saiu a mensagem reserva.', answers: { 'Qual região?': 'Zona Leste' } });
    render(<Janela />);
    await escolherLead();
    fireEvent.click(screen.getByRole('button', { name: 'Testar mensagem' }));
    expect(await screen.findByTestId('bolha-do-whatsapp')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Instrução para a IA/), { target: { value: 'Outra instrução.' } });
    expect(screen.queryByTestId('bolha-do-whatsapp')).toBeNull();
    expect(screen.queryByText('A IA demorou, saiu a mensagem reserva.')).toBeNull();
    expect(screen.queryByRole('button', { name: /Respostas que a IA leu/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Testar mensagem' })).toBeEnabled();
  });

  it('resposta que chega depois de mexer na reserva é descartada', async () => {
    let soltar: (v: unknown) => void = () => {};
    aiMessagePreview.mockReturnValue(new Promise(res => { soltar = res; }));
    render(<Janela />);
    await escolherLead();
    fireEvent.click(screen.getByRole('button', { name: 'Testar mensagem' }));
    expect(screen.getByRole('button', { name: 'Escrevendo…' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Mensagem reserva/), { target: { value: 'Nova reserva' } });
    await act(async () => { soltar({ text: 'Texto velho', source: 'ia', reason_text: null, answers: {} }); });
    expect(screen.queryByText('Texto velho')).toBeNull();
    expect(screen.getByRole('button', { name: 'Testar mensagem' })).toBeEnabled();
  });

  it('sem o fluxo salvo: avisa no lugar do Testar', () => {
    render(<AiMessageFields config={{ instruction: 'Oi', fallback_text: 'Oi' }} onChange={() => {}} readOnly={false} automationId="" />);
    expect(screen.getByText('Salve o fluxo pra testar a mensagem.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Testar mensagem' })).toBeNull();
    expect(aiMessageLeads).not.toHaveBeenCalled();
  });

  it('somente leitura no modo guiado: campos desligados e sem Testar', () => {
    render(<Janela readOnly />);
    expect(screen.getByLabelText(/Instrução para a IA/)).toBeDisabled();
    expect(screen.getByLabelText(/Mensagem reserva/)).toBeDisabled();
    expect(screen.queryByText('Inserir variável:')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Testar mensagem' })).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(aiMessageLeads).not.toHaveBeenCalled();
  });
});

describe('formulário do gatilho pro Testar', () => {
  it('um formulário só no gatilho: filtra por ele', () => {
    expect(formularioDoGatilho({ event: 'lead.created', conditions: [{ field: 'form_id', operator: 'in', value: ['f1'] }] })).toBe('f1');
  });

  it('nenhum ou mais de um formulário: sem filtro', () => {
    expect(formularioDoGatilho({ event: 'lead.created', conditions: [] })).toBeNull();
    expect(formularioDoGatilho({ event: 'lead.created', conditions: [{ field: 'form_id', operator: 'in', value: ['f1', 'f2'] }] })).toBeNull();
    expect(formularioDoGatilho({
      event: 'lead.created',
      conditions: [{ field: 'form_id', operator: 'in', value: ['f1'] }],
      alternatives: [{ event: 'lead.created', conditions: [{ field: 'form_id', operator: 'in', value: ['f2'] }] }],
    })).toBeNull();
  });
});

const bloco = (config: FlowNodeConfig): FlowAutomationNode => ({
  id: 'n1', kind: 'ai_message', label: null, config,
  next_node_id: null, next_yes_node_id: null, next_no_node_id: null,
  pos_x: 0, pos_y: 0, steps: [],
});

function renderCard(node: FlowAutomationNode, problem: string | null = null) {
  const data: FlowNodeCardData = {
    node, lookups: {}, problem,
    onEdit: vi.fn(), onDuplicate: vi.fn(), onRemove: vi.fn(), onAddFrom: vi.fn(), onRename: vi.fn(),
  };
  return render(
    <ReactFlowProvider>
      <FlowNodeCard {...({ id: node.id, data, selected: false } as never)} />
    </ReactFlowProvider>,
  );
}

const resources: AutomationResources = {
  labels: [], followupFlows: [], users: [], pipelines: [], stagesByPipeline: {}, quickReplies: [],
  adOrigins: [], formOrigins: [], messageFunnels: [], conversationFunnels: [], evolutionInstances: [],
  reloadFunnels: () => {}, reloadLabels: () => {}, loading: false,
};

describe('janela do bloco no construtor', () => {
  it('abre com o Testar do fluxo, a linha do número e não salva sem a reserva', async () => {
    const onSave = vi.fn();
    render(
      <FlowNodePanel
        node={bloco({ instruction: 'Apresente-se.', fallback_text: '' })}
        resources={resources}
        onClose={() => {}}
        onSave={onSave}
        automationId="flow-1"
        formId="form-9"
        numeroDoFluxo={{ mode: 'owner', final: null }}
      />,
    );
    await screen.findByRole('option', { name: /Rodrigo Teste/ });
    expect(aiMessageLeads).toHaveBeenCalledWith('flow-1', 'form-9');
    expect(screen.getByTestId('sai-pelo-numero-do-fluxo')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(screen.getByText('Escreva a mensagem reserva.')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe('janela do bloco no modo guiado', () => {
  it('fluxo antigo sem número do fluxo: nada de escolher o número', () => {
    render(
      <FlowNodePanel node={bloco({ instruction: 'Oi', fallback_text: 'Oi' })} resources={resources} onClose={() => {}} onSave={() => {}} guided automationId="flow-1" />,
    );
    expect(screen.queryByText('Enviar pelo número')).toBeNull();
    expect(sendNumbers).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Testar mensagem' })).toBeNull();
  });

  it('com número do fluxo: só a linha', () => {
    render(
      <FlowNodePanel
        node={bloco({ instruction: 'Oi', fallback_text: 'Oi' })} resources={resources} onClose={() => {}} onSave={() => {}}
        guided automationId="flow-1" numeroDoFluxo={{ mode: 'owner', final: null }}
      />,
    );
    expect(screen.getByTestId('sai-pelo-numero-do-fluxo')).toBeInTheDocument();
  });
});

describe('cartão da Mensagem com IA', () => {
  it('resumo é o começo da instrução', () => {
    renderCard(bloco({
      instruction: 'Você é a Bianca.\nApresente-se pelo nome.',
      fallback_text: 'Oi',
      send_from: 'owner',
      send_from_inbox_id: '',
    }));
    expect(screen.getByText('Você é a Bianca. Apresente-se pelo nome.')).toBeInTheDocument();
    expect(screen.getByText('Pelo número do responsável pelo lead')).toBeInTheDocument();
  });

  it('sem instrução: Escreva a instrução', () => {
    renderCard(bloco({ instruction: '  ', fallback_text: '' }));
    expect(screen.getByText('Escreva a instrução')).toBeInTheDocument();
  });

  it('incompleto: borda amarela e o que falta, pela régua de sempre (readiness)', () => {
    const node = bloco({ instruction: 'Oi', fallback_text: '' });
    const { container } = renderCard(node, nodeProblem(node));
    expect(container.querySelector('.fluxo-bloco')).toHaveClass('border-amber-500');
    expect(screen.getByText('Escreva a mensagem reserva.')).toBeInTheDocument();
  });
});
