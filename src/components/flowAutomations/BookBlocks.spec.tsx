import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Book pelo site (05/10/2026): "Book do imóvel de interesse" no Enviar WhatsApp,
// os blocos "Passar para a IA" e "Desligar a IA" e o gatilho "Pediu o book no site".

vi.mock('@/services/flowAutomations/flowAutomationsService', () => ({
  flowAutomationsService: { forms: vi.fn(), formQuestions: vi.fn() },
  flowAutomationFoldersService: {},
}));
vi.mock('@/services/numbers/numbersService', () => ({
  default: { sendNumbers: vi.fn().mockResolvedValue({ number_owner_rule: false, numbers: [] }) },
}));

import { FlowNodePanel } from './FlowNodePanel';
import { summaryLine } from './FlowNodeCard';
import type { AutomationResources } from '@/pages/Customer/Settings/LeadAutomations/LeadAutomationsEditors';
import type { FlowAutomationNode } from '@/types/flowAutomations';
import { paletteItems } from '@/features/flowAutomations/palette';
import { blockDescription } from '@/features/flowAutomations/blockInfo';
import { nodeProblem } from '@/features/flowAutomations/readiness';
import { FLOW_TRIGGER_EVENTS, flowTriggerLabel } from '@/features/flowAutomations/trigger';

const resources = {
  labels: [], sequences: [], followupFlows: [], users: [], pipelines: [], stagesByPipeline: {}, quickReplies: [],
  adOrigins: [], formOrigins: [], messageFunnels: [], conversationFunnels: [], evolutionInstances: [],
  reloadFunnels: () => {}, reloadLabels: () => {}, loading: false,
} as unknown as AutomationResources;

const node = (patch: Partial<FlowAutomationNode>): FlowAutomationNode => ({
  id: 'n1', kind: 'send_whatsapp', label: null, config: {},
  next_node_id: null, next_yes_node_id: null, next_no_node_id: null, pos_x: null, pos_y: null, steps: [],
  ...patch,
});

describe('Enviar WhatsApp: "Book do imóvel de interesse"', () => {
  it('marcar grava media_source e limpa media_url', async () => {
    const onSave = vi.fn();
    render(<FlowNodePanel node={node({ config: { text: 'Oi {{nome}}' } })} resources={resources} onClose={() => {}} onSave={onSave} />);
    expect(screen.getByText('Pega sozinho o book (PDF) do empreendimento do lead. Acima de 16 MB vai como link.')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Book do imóvel de interesse'));
    fireEvent.click(screen.getByText('Salvar'));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][1].config).toMatchObject({ text: 'Oi {{nome}}', media_source: 'property_book', media_url: '' });
  });

  it('desmarcar volta pro texto comum', async () => {
    const onSave = vi.fn();
    render(<FlowNodePanel node={node({ config: { text: 'Oi', media_source: 'property_book', media_url: '' } })} resources={resources} onClose={() => {}} onSave={onSave} />);
    const box = screen.getByLabelText('Book do imóvel de interesse') as HTMLInputElement;
    expect(box.checked).toBe(true);
    fireEvent.click(box);
    fireEvent.click(screen.getByText('Salvar'));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][1].config.media_source).toBe('');
  });

  it('o cartão mostra o resumo e o bloco não pede texto', () => {
    expect(summaryLine(node({ config: { media_source: 'property_book', text: '' } }))).toBe('Manda o book do imóvel de interesse');
    expect(nodeProblem({ kind: 'send_whatsapp', config: { media_source: 'property_book', text: '' } })).toBeNull();
    expect(nodeProblem({ kind: 'send_whatsapp', config: { text: '' } })).toBe('Escreva a mensagem.');
  });
});

describe('blocos da IA', () => {
  it.each([
    ['hand_to_ai', 'Passar para a IA', 'A IA Vendedora do número da conversa passa a responder este lead, mesmo sem os gatilhos dela. Vale o horário de atendimento dela.'],
    ['disable_ai', 'Desligar a IA', "A IA para de responder este lead (igual a 'IA desligada' no card)."],
  ] as const)('%s está na paleta, grupo Lead, com a ajuda', (kind, label, help) => {
    const item = paletteItems().find(i => i.kind === kind);
    expect(item).toMatchObject({ label, group: 'contact', config: {} });
    expect(blockDescription({ kind })).toBe(help);
  });

  it('a janela só traz a explicação e salva sem config', async () => {
    const onSave = vi.fn();
    render(<FlowNodePanel node={node({ kind: 'disable_ai' })} resources={resources} onClose={() => {}} onSave={onSave} />);
    expect(screen.getByRole('heading', { name: 'Desligar a IA' })).toBeTruthy();
    expect(screen.getAllByText("A IA para de responder este lead (igual a 'IA desligada' no card).").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText('Salvar'));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('n1', { label: '', config: {} }));
  });

  it('o cartão diz o que o bloco faz', () => {
    expect(summaryLine(node({ kind: 'hand_to_ai' }))).toContain('IA Vendedora');
    expect(summaryLine(node({ kind: 'disable_ai' }))).toContain('para de responder');
  });
});

describe('gatilho "Pediu o book no site"', () => {
  it('está na lista e tem rótulo', () => {
    expect(FLOW_TRIGGER_EVENTS).toContain('lead.book_requested');
    expect(flowTriggerLabel('lead.book_requested')).toBe('Pediu o book no site');
  });
});
