// Maradona, 04/11/2026: a etiqueta de progresso aparecia como "não existe mais", a
// pessoa escolhia outra e o lead com ela encerrava o follow-up sem receber nada.
// As condições de retomada e o nome da etiqueta saem da mão de quem edita.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';

const sendNumbers = vi.hoisted(() => vi.fn());
vi.mock('@/services/flowAutomations/flowAutomationsService', () => ({
  flowAutomationsService: { forms: vi.fn(), formQuestions: vi.fn() },
  flowAutomationFoldersService: {},
}));
vi.mock('@/services/numbers/numbersService', () => ({ default: { sendNumbers } }));

import type { FlowAutomationNode } from '@/types/flowAutomations';
import type { AutomationResources } from '@/features/flowAutomations/editores/LeadAutomationsEditors';
import { ehCondicaoAutomatica, CONDICAO_AUTOMATICA_AVISO } from '@/features/flowAutomations/progress';
import { FlowNodeCard, type FlowNodeCardData } from './FlowNodeCard';
import { FlowNodePanel } from './FlowNodePanel';
import { FlowSettingsDialog, type FlowSettings } from './FlowSettingsDialog';

const node = (over: Partial<FlowAutomationNode> = {}): FlowAutomationNode => ({
  id: 'n1', kind: 'condition', label: 'Continuar da mensagem 3',
  config: { criterion: 'has_label', label: 'polo-msg-2' },
  next_node_id: null, next_yes_node_id: null, next_no_node_id: null,
  pos_x: 0, pos_y: 0, steps: [], ...over,
});

const resources: AutomationResources = {
  labels: [], followupFlows: [], users: [], pipelines: [], stagesByPipeline: {}, quickReplies: [],
  adOrigins: [], formOrigins: [], messageFunnels: [], conversationFunnels: [], evolutionInstances: [],
  reloadFunnels: () => {}, reloadLabels: () => {}, loading: false,
};

function renderCard(n: FlowAutomationNode, extra: Partial<FlowNodeCardData> = {}) {
  const data: FlowNodeCardData = {
    node: n, lookups: {} as FlowNodeCardData['lookups'], problem: null,
    onEdit: vi.fn(), onDuplicate: vi.fn(), onRemove: vi.fn(), onAddFrom: vi.fn(), onRename: vi.fn(),
    ...extra,
  };
  return render(
    <ReactFlowProvider>
      <FlowNodeCard {...({ id: n.id, data, selected: false } as never)} />
    </ReactFlowProvider>,
  );
}

beforeEach(() => {
  sendNumbers.mockReset();
  sendNumbers.mockResolvedValue({ number_owner_rule: false, numbers: [] });
});

describe('ehCondicaoAutomatica', () => {
  it('reconhece a condição de progresso dentro do follow-up', () => {
    expect(ehCondicaoAutomatica(node(), 'followup')).toBe(true);
  });

  it('condição com outra etiqueta continua editável, inclusive a que precisa de conserto', () => {
    const outra = node({ config: { criterion: 'has_label', label: 'reativação polo paulista' } });
    expect(ehCondicaoAutomatica(outra, 'followup')).toBe(false);
  });

  it('fora do follow-up nada é travado', () => {
    expect(ehCondicaoAutomatica(node(), 'automation')).toBe(false);
    expect(ehCondicaoAutomatica(node(), 'conversation')).toBe(false);
  });

  it('só vale pra bloco de condição por etiqueta', () => {
    expect(ehCondicaoAutomatica(node({ kind: 'send_whatsapp' }), 'followup')).toBe(false);
    expect(ehCondicaoAutomatica(node({ config: { criterion: 'replied', window_hours: 24 } }), 'followup')).toBe(false);
  });
});

describe('cartão da condição automática', () => {
  const travado = { edit: false, duplicate: false, remove: false, add: false, rename: false };

  it('explica o que ela faz, no lugar do nome da etiqueta', () => {
    renderCard(node(), { condicaoAutomatica: true, allow: travado });
    expect(screen.getByText(CONDICAO_AUTOMATICA_AVISO)).toBeInTheDocument();
    expect(screen.queryByText(/polo-msg-2/)).not.toBeInTheDocument();
  });

  it('não oferece editar, duplicar nem excluir', () => {
    renderCard(node(), { condicaoAutomatica: true, allow: travado });
    expect(screen.queryByRole('button', { name: /Editar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Duplicar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Excluir/ })).not.toBeInTheDocument();
  });

  it('condição comum continua mostrando a etiqueta', () => {
    renderCard(node());
    expect(screen.getByText(/polo-msg-2/)).toBeInTheDocument();
    expect(screen.queryByText(CONDICAO_AUTOMATICA_AVISO)).not.toBeInTheDocument();
  });
});

describe('nome da etiqueta na mensagem do follow-up', () => {
  const mensagem = node({
    kind: 'send_whatsapp', label: 'Mensagem 3',
    config: { text: 'Oi', progress_tag_prefix: 'polo', progress_step: 3 },
  });

  it('o cartão da mensagem do follow-up não mostra o nome da etiqueta', () => {
    renderCard(mensagem, { ocultarProgresso: true });
    expect(screen.queryByText(/polo-msg-3/)).not.toBeInTheDocument();
  });

  it('o cartão da mensagem da automação continua mostrando', () => {
    renderCard(mensagem);
    expect(screen.getByText(/polo-msg-3/)).toBeInTheDocument();
  });

  it('o painel da mensagem do follow-up não oferece "Marcar progresso"', () => {
    render(<FlowNodePanel node={mensagem} resources={resources} onClose={vi.fn()} onSave={vi.fn()} flowKind="followup" />);
    expect(screen.queryByText(/Marcar progresso/i)).not.toBeInTheDocument();
  });

  it('o painel da mensagem da automação continua oferecendo', () => {
    render(<FlowNodePanel node={mensagem} resources={resources} onClose={vi.fn()} onSave={vi.fn()} flowKind="automation" />);
    expect(screen.getByText(/Marcar progresso/i)).toBeInTheDocument();
  });
});

describe('campo "Nome da etiqueta" nas Configurações do follow-up', () => {
  const base: FlowSettings = { reentry: { mode: 'hours', hours: 24 }, businessHoursOnly: false };
  const abrir = (settings: FlowSettings, onSave = vi.fn()) => {
    render(<FlowSettingsDialog open settings={settings} triggerEvent="lead.created" onClose={() => {}} onSave={onSave} />);
    return onSave;
  };

  it('no follow-up mostra o nome atual', () => {
    abrir({ ...base, progressTag: { name: 'polo-copia', leadsInside: 0 } });
    expect(screen.getByLabelText('Nome da etiqueta')).toHaveValue('polo-copia');
  });

  it('salvar devolve o nome limpo', () => {
    const onSave = abrir({ ...base, progressTag: { name: 'polo-copia', leadsInside: 0 } });
    fireEvent.change(screen.getByLabelText('Nome da etiqueta'), { target: { value: 'Polo Paulista' } });
    fireEvent.click(screen.getByText('Salvar'));
    expect(onSave.mock.calls[0][0].progressTagName).toBe('polo-paulista');
  });

  it('nome vazio não salva', () => {
    const onSave = abrir({ ...base, progressTag: { name: 'polo', leadsInside: 0 } });
    fireEvent.change(screen.getByLabelText('Nome da etiqueta'), { target: { value: '  ' } });
    expect(screen.getByText('Salvar')).toBeDisabled();
    fireEvent.click(screen.getByText('Salvar'));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('com lead dentro o campo trava e diz por quê', () => {
    abrir({ ...base, progressTag: { name: 'polo', leadsInside: 3 } });
    expect(screen.getByLabelText('Nome da etiqueta')).toBeDisabled();
    expect(screen.getByText(/3 leads/)).toBeInTheDocument();
  });

  it('fora do follow-up o campo não aparece', () => {
    abrir(base);
    expect(screen.queryByLabelText('Nome da etiqueta')).not.toBeInTheDocument();
  });
});
