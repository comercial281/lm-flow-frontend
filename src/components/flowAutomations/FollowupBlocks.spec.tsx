import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Automações · sprint 3 (03/10/2026): o que o follow-up precisa no construtor,
// valendo em qualquer fluxo. "Marcar progresso", "Só em horário comercial",
// "Marcar como recuperado", "Mover de etapa" por nome, "Iniciar follow-up" e
// "+ Ou quando…".

const sendNumbers = vi.hoisted(() => vi.fn());
vi.mock('@/services/flowAutomations/flowAutomationsService', () => ({
  flowAutomationsService: { forms: vi.fn(), formQuestions: vi.fn() },
  flowAutomationFoldersService: {},
}));
vi.mock('@/services/numbers/numbersService', () => ({ default: { sendNumbers } }));

import { FlowNodePanel } from './FlowNodePanel';
import { FlowSettingsDialog } from './FlowSettingsDialog';
import { FlowTriggerPanel } from './FlowTriggerPanel';
import { summaryLine } from './FlowNodeCard';
import type { AutomationResources } from '@/pages/Customer/Settings/LeadAutomations/LeadAutomationsEditors';
import type { FlowAutomation, FlowAutomationNode } from '@/types/flowAutomations';
import { paletteItems } from '@/features/flowAutomations/palette';
import { nodeProblem } from '@/features/flowAutomations/readiness';
import { progressLine } from '@/features/flowAutomations/progress';
import { RECOVERED_EFFECTS } from '@/features/flowAutomations/recovered';

const followupFlows = [
  { id: 'f1', name: 'Follow-up longo', is_enabled: true },
  { id: 'f2', name: 'Follow-up curto', is_enabled: false },
] as unknown as FlowAutomation[];

const resources: AutomationResources = {
  labels: [], sequences: [], followupFlows, users: [], pipelines: [], stagesByPipeline: {}, quickReplies: [],
  adOrigins: [], formOrigins: [], messageFunnels: [], conversationFunnels: [], evolutionInstances: [],
  reloadFunnels: () => {}, reloadLabels: () => {}, loading: false,
};

const node = (patch: Partial<FlowAutomationNode>): FlowAutomationNode => ({
  id: 'n1', kind: 'send_whatsapp', label: null, config: {},
  next_node_id: null, next_yes_node_id: null, next_no_node_id: null, pos_x: null, pos_y: null, steps: [],
  ...patch,
});

beforeEach(() => {
  sendNumbers.mockReset();
  sendNumbers.mockResolvedValue({ number_owner_rule: false, numbers: [] });
});

const savedConfig = (onSave: ReturnType<typeof vi.fn>) => onSave.mock.calls[0][1].config as Record<string, unknown>;

describe('Mandar WhatsApp: "Marcar progresso"', () => {
  it('grava o prefixo (limpo) e o número da mensagem', async () => {
    const onSave = vi.fn();
    render(<FlowNodePanel node={node({ config: { text: 'Oi' } })} resources={resources} onClose={() => {}} onSave={onSave} />);
    fireEvent.click(screen.getByLabelText('Marcar progresso'));
    fireEvent.change(screen.getByLabelText('Nome da etiqueta de progresso'), { target: { value: 'Follow Up Longo' } });
    fireEvent.change(screen.getByLabelText('Número da mensagem'), { target: { value: '2' } });
    expect(screen.getByText('follow-up-longo-msg-2')).toBeTruthy();
    fireEvent.click(screen.getByText('Salvar'));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(savedConfig(onSave)).toMatchObject({ text: 'Oi', progress_tag_prefix: 'follow-up-longo', progress_step: 2 });
  });

  it('desmarcar tira as duas chaves', async () => {
    const onSave = vi.fn();
    render(<FlowNodePanel node={node({ config: { text: 'Oi', progress_tag_prefix: 'fu', progress_step: 3 } })} resources={resources} onClose={() => {}} onSave={onSave} />);
    fireEvent.click(screen.getByLabelText('Marcar progresso'));
    fireEvent.click(screen.getByText('Salvar'));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(savedConfig(onSave)).not.toHaveProperty('progress_tag_prefix');
    expect(savedConfig(onSave)).not.toHaveProperty('progress_step');
  });

  it('marcado sem nome não salva, e o cartão mostra a etiqueta', () => {
    expect(nodeProblem({ kind: 'send_whatsapp', config: { text: 'Oi', progress_tag_prefix: '', progress_step: 1 } }))
      .toBe('Escreva o nome da etiqueta de progresso.');
    expect(progressLine({ progress_tag_prefix: 'fu', progress_step: 4 })).toBe('Marca o progresso: fu-msg-4');
    expect(progressLine({})).toBeNull();
  });
});

describe('"Só em horário comercial"', () => {
  it('Aguardar resposta grava business_hours', async () => {
    const onSave = vi.fn();
    render(<FlowNodePanel node={node({ kind: 'wait_for_reply', config: { minutes: 1440 } })} resources={resources} onClose={() => {}} onSave={onSave} />);
    fireEvent.click(screen.getByLabelText('Só em horário comercial (seg–sex 8h–20h, sáb 9h–18h)'));
    fireEvent.click(screen.getByText('Salvar'));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(savedConfig(onSave)).toMatchObject({ minutes: 1440, business_hours: true });
  });

  it('Esperar: o modo antigo "saindo em horário comercial" aparece marcado, e desmarcar volta pro tempo comum', async () => {
    const onSave = vi.fn();
    render(<FlowNodePanel node={node({ kind: 'wait', config: { mode: 'schedule', minutes: 60 } })} resources={resources} onClose={() => {}} onSave={onSave} />);
    const caixa = screen.getByLabelText('Só em horário comercial (seg–sex 8h–20h, sáb 9h–18h)') as HTMLInputElement;
    expect(caixa.checked).toBe(true);
    fireEvent.click(caixa);
    fireEvent.click(screen.getByText('Salvar'));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(savedConfig(onSave)).toMatchObject({ mode: 'interval', business_hours: false, minutes: 60 });
  });

  it('configurações do fluxo: a chave vai junto do "pode rodar de novo"', () => {
    const onSave = vi.fn();
    render(
      <FlowSettingsDialog
        open
        settings={{ reentry: { mode: 'hours', hours: 24 }, businessHoursOnly: false }}
        triggerEvent="lead.created"
        onClose={() => {}}
        onSave={onSave}
      />,
    );
    fireEvent.click(screen.getByLabelText('Só em horário comercial (seg–sex 8h–20h, sáb 9h–18h)'));
    fireEvent.click(screen.getByText('Salvar'));
    expect(onSave).toHaveBeenCalledWith({ reentry: { mode: 'hours', hours: 24 }, businessHoursOnly: true });
  });
});

describe('bloco "Marcar como recuperado pelo follow-up"', () => {
  it('está na paleta, no grupo Lead, sem config', () => {
    const item = paletteItems().find(i => i.kind === 'followup_recovered');
    expect(item).toMatchObject({ label: 'Marcar como recuperado pelo follow-up', group: 'contact', config: {} });
  });

  it('a janela lista os cinco efeitos e salva sem pedir nada', async () => {
    const onSave = vi.fn();
    render(<FlowNodePanel node={node({ kind: 'followup_recovered', config: {} })} resources={resources} onClose={() => {}} onSave={onSave} />);
    expect(screen.getByRole('heading', { name: 'Marcar como recuperado pelo follow-up' })).toBeTruthy();
    expect(RECOVERED_EFFECTS).toHaveLength(5);
    RECOVERED_EFFECTS.forEach(effect => expect(screen.getByText(effect)).toBeTruthy());
    fireEvent.click(screen.getByText('Salvar'));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('n1', { label: '', config: {} }));
  });

  it('o cartão diz o que ele faz', () => {
    expect(summaryLine(node({ kind: 'followup_recovered' }))).toContain('recuperado-pelo-follow-up');
  });
});

describe('"Mover de etapa" por nome de coluna', () => {
  it('grava stage_name e tira stage_id', async () => {
    const onSave = vi.fn();
    render(<FlowNodePanel node={node({ kind: 'move_stage', config: { stage_id: '' } })} resources={resources} onClose={() => {}} onSave={onSave} />);
    fireEvent.click(screen.getByLabelText('Coluna com este nome no funil do card'));
    fireEvent.change(screen.getByLabelText('Nome da coluna'), { target: { value: 'Em atendimento' } });
    fireEvent.click(screen.getByText('Salvar'));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(savedConfig(onSave)).toEqual({ stage_name: 'Em atendimento' });
  });

  it('o slug dos modelos antigos aparece como nome, e o cartão fala do funil do card', () => {
    expect(summaryLine(node({ kind: 'move_stage', config: { stage_slug: 'em-atendimento' } }))).toBe('Para a coluna "em-atendimento" do funil do card');
    // O motor não lê `stage_slug`: o bloco pede pra abrir e salvar.
    expect(nodeProblem({ kind: 'move_stage', config: { stage_slug: 'em-atendimento' } })).toBe('Abra o bloco e confirme o nome da coluna.');
    expect(nodeProblem({ kind: 'move_stage', config: { stage_name: ' ' } })).toBe('Escreva o nome da coluna.');
    expect(nodeProblem({ kind: 'move_stage', config: { stage_name: 'Visita' } })).toBeNull();
    expect(nodeProblem({ kind: 'move_stage', config: { stage_id: '' } })).toBe('Escolha a etapa.');
  });
});

describe('"Mover de etapa" de modelo antigo (stage_slug)', () => {
  it('salvar a janela grava como stage_name', async () => {
    const onSave = vi.fn();
    render(<FlowNodePanel node={node({ kind: 'move_stage', config: { stage_slug: 'em-atendimento' } })} resources={resources} onClose={() => {}} onSave={onSave} />);
    expect((screen.getByLabelText('Nome da coluna') as HTMLInputElement).value).toBe('em-atendimento');
    fireEvent.click(screen.getByText('Salvar'));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(savedConfig(onSave)).toEqual({ stage_name: 'em-atendimento' });
  });
});

describe('bloco "Iniciar follow-up"', () => {
  it('lista os fluxos de follow-up e grava flow_automation_id', async () => {
    const onSave = vi.fn();
    render(<FlowNodePanel node={node({ kind: 'lead_action', config: { action_type: 'start_followup_flow', params: {} } })} resources={resources} onClose={() => {}} onSave={onSave} />);
    expect(screen.getByRole('heading', { name: 'Iniciar follow-up' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Follow-up curto (desligado)' })).toBeTruthy();
    fireEvent.click(screen.getByText('Salvar'));
    expect(screen.getByRole('alert').textContent).toBe('Falta preencher o follow-up.');
    fireEvent.change(screen.getByLabelText('Qual follow-up'), { target: { value: 'f1' } });
    fireEvent.click(screen.getByText('Salvar'));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('n1', expect.objectContaining({
      config: { action_type: 'start_followup_flow', params: { flow_automation_id: 'f1' } },
    })));
  });
});

describe('gatilho: "+ Ou quando…"', () => {
  it('acrescenta outro gatilho, editado com o mesmo editor', () => {
    const onSave = vi.fn();
    render(
      <FlowTriggerPanel
        trigger={{ event: 'lead.created', conditions: [], alternatives: [] }}
        resources={resources}
        onClose={() => {}}
        onSave={onSave}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Ou quando/ }));
    // Sem escolher, não salva.
    fireEvent.click(screen.getByText('Salvar'));
    expect(screen.getByRole('alert').textContent).toBe('No "Ou quando": escolha o gatilho.');
    fireEvent.change(screen.getByLabelText('Ou quando 1'), { target: { value: 'lead.visit_completed' } });
    fireEvent.click(screen.getByText('Salvar'));
    expect(onSave).toHaveBeenCalledWith({
      event: 'lead.created',
      conditions: [],
      alternatives: [{ event: 'lead.visit_completed', conditions: [] }],
    });
  });

  it('o "Ou quando" pode ser tirado', () => {
    const onSave = vi.fn();
    render(
      <FlowTriggerPanel
        trigger={{ event: 'lead.created', conditions: [], alternatives: [{ event: 'lead.visit_completed', conditions: [] }] }}
        resources={resources}
        onClose={() => {}}
        onSave={onSave}
      />,
    );
    fireEvent.click(screen.getByLabelText('Tirar o "Ou quando" 1'));
    fireEvent.click(screen.getByText('Salvar'));
    expect(onSave).toHaveBeenCalledWith({ event: 'lead.created', conditions: [], alternatives: [] });
  });
});
