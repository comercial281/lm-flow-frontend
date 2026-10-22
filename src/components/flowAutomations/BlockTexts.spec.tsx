import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/services/flowAutomations/flowAutomationsService', () => ({
  flowAutomationsService: {},
  flowAutomationFoldersService: {},
}));
vi.mock('@/services/numbers/numbersService', () => ({
  default: { sendNumbers: vi.fn().mockResolvedValue({ number_owner_rule: false, numbers: [] }) },
}));

import { FlowNodePanel } from './FlowNodePanel';
import { blockDescription } from '@/features/flowAutomations/blockInfo';
import { PipelineFilterEditor, type AutomationResources } from '@/features/flowAutomations/editores/LeadAutomationsEditors';
import { GROUP_COLORS } from '@/lib/flowAutomationGraph';
import type { FlowAutomationNode } from '@/types/flowAutomations';

const resources: AutomationResources = {
  labels: [], sequences: [], followupFlows: [], users: [], pipelines: [], stagesByPipeline: {}, quickReplies: [],
  adOrigins: [], formOrigins: [], messageFunnels: [], conversationFunnels: [], evolutionInstances: [],
  reloadFunnels: () => {}, reloadLabels: () => {}, loading: false,
};

const node = (patch: Partial<FlowAutomationNode>): FlowAutomationNode => ({
  id: 'n1', kind: 'send_whatsapp', label: null, config: {},
  next_node_id: null, next_yes_node_id: null, next_no_node_id: null, pos_x: null, pos_y: null, steps: [],
  ...patch,
});

const open = (patch: Partial<FlowAutomationNode>) =>
  render(<FlowNodePanel node={node(patch)} resources={resources} onClose={() => {}} onSave={() => {}} />);

beforeEach(() => vi.clearAllMocks());

describe('textos das janelas dos blocos', () => {
  it('Passar para a IA não repete o texto do topo e diz quem atende', () => {
    open({ kind: 'hand_to_ai' });
    expect(screen.getAllByText(blockDescription({ kind: 'hand_to_ai' }))).toHaveLength(1);
    expect(screen.getByText('Quem atende: a IA do número da conversa do lead. Se esse número não tiver IA ligada, nada acontece.')).toBeTruthy();
  });

  it('Desligar a IA diz como religar', () => {
    open({ kind: 'disable_ai' });
    expect(screen.getAllByText(blockDescription({ kind: 'disable_ai' }))).toHaveLength(1);
    expect(screen.getByText('Pra religar, use o bloco Passar para a IA ou o botão no card do lead.')).toBeTruthy();
  });

  it('Lead recuperado: um parágrafo só e a dica do caminho Respondeu', () => {
    open({ kind: 'followup_recovered' });
    expect(screen.getByRole('heading', { name: 'Lead recuperado' })).toBeTruthy();
    expect(screen.getByText('Faz o mesmo que o follow-up quando o lead responde: põe a etiqueta de recuperado, tira a de follow-up, conta no relatório, avisa a equipe e manda WhatsApp pro corretor.')).toBeTruthy();
    expect(screen.getByText('Use no caminho Respondeu do Aguardar resposta.')).toBeTruthy();
  });

  it('o filtro de funil do Início não tem travessão', () => {
    const { container } = render(
      <PipelineFilterEditor trigger="lead.created" condition={null} onChange={() => {}} resources={resources} />,
    );
    expect(container.textContent).not.toMatch(/[—–]/);
    expect(container.textContent).toContain('Em branco, vale pra todo lead do CRM. Escolhendo um funil, o fluxo só roda pro lead que está nele.');
  });

  it('o grupo Controle não é laranja como a Distribuição', () => {
    expect(GROUP_COLORS.control).toBe('#475569');
    expect(GROUP_COLORS.control).not.toBe(GROUP_COLORS.distribution);
  });
});
