import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('@/hooks/useIsSuperAdmin', () => ({ useIsSuperAdmin: () => false }));
const svc = vi.hoisted(() => ({ listar: vi.fn() }));
vi.mock('@/services/externalLeadPages/externalLeadPagesService', () => ({ externalLeadPagesService: svc }));

import { ConditionEditor, formatConditionSummary, type AutomationResources } from './LeadAutomationsEditors';

const resources = {
  labels: [], followupFlows: [], users: [], pipelines: [], stagesByPipeline: {}, quickReplies: [],
  adOrigins: [], formOrigins: [], messageFunnels: [], conversationFunnels: [], evolutionInstances: [],
  roletas: [], reloadFunnels: () => {}, reloadLabels: () => {}, loading: false,
} as unknown as AutomationResources;

const paginas = [{ id: 'p1', name: 'LP Centro' }, { id: 'p2', name: 'LP Norte' }];

beforeEach(() => { vi.clearAllMocks(); svc.listar.mockResolvedValue(paginas); });

describe('gatilho "Quais páginas?"', () => {
  it('condição site_page_id mostra a origem do site e a página marcada', async () => {
    render(<ConditionEditor trigger="lead.created" condition={{ field: 'site_page_id', operator: 'in', value: ['p1'] }} onChange={vi.fn()} resources={resources} />);
    expect(screen.getByDisplayValue('Formulário do site / landing')).toBeInTheDocument();
    const p1 = await screen.findByRole('checkbox', { name: /LP Centro/ });
    expect(p1).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /LP Norte/ })).not.toBeChecked();
    expect(screen.getByText('Nenhuma marcada = qualquer página ou landing.')).toBeInTheDocument();
  });

  it('marcar emite site_page_id in; desmarcar tudo volta pra source eq formulario_site', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<ConditionEditor trigger="lead.created" condition={{ field: 'source', operator: 'eq', value: 'formulario_site' }} onChange={onChange} resources={resources} />);
    fireEvent.click(await screen.findByRole('checkbox', { name: /LP Norte/ }));
    expect(onChange).toHaveBeenCalledWith({ field: 'site_page_id', operator: 'in', value: ['p2'] });
    rerender(<ConditionEditor trigger="lead.created" condition={{ field: 'site_page_id', operator: 'in', value: ['p2'] }} onChange={onChange} resources={resources} />);
    fireEvent.click(await screen.findByRole('checkbox', { name: /LP Norte/ }));
    expect(onChange).toHaveBeenLastCalledWith({ field: 'source', operator: 'eq', value: 'formulario_site' });
  });

  it('lista vazia mostra o texto de ajuda', async () => {
    svc.listar.mockResolvedValue([]);
    render(<ConditionEditor trigger="lead.created" condition={{ field: 'source', operator: 'eq', value: 'formulario_site' }} onChange={vi.fn()} resources={resources} />);
    expect(await screen.findByText('Nenhuma página ligada ainda — veja Integrações → Sites e landing pages.')).toBeInTheDocument();
  });

  it('falha (403) esconde a lista sem gritar e o seletor de origem segue', async () => {
    svc.listar.mockRejectedValue({ response: { status: 403 } });
    render(<ConditionEditor trigger="lead.created" condition={{ field: 'source', operator: 'eq', value: 'formulario_site' }} onChange={vi.fn()} resources={resources} />);
    await waitFor(() => expect(svc.listar).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText('Quais páginas? (opcional)')).toBeNull());
    expect(screen.getByDisplayValue('Formulário do site / landing')).toBeInTheDocument();
  });

  it('não carrega as páginas fora da origem do site', () => {
    render(<ConditionEditor trigger="lead.created" condition={{ field: 'source', operator: 'eq', value: 'organico' }} onChange={vi.fn()} resources={resources} />);
    expect(svc.listar).not.toHaveBeenCalled();
  });

  it('resumo do gatilho', () => {
    expect(formatConditionSummary('lead.created', { field: 'site_page_id', operator: 'in', value: ['p1', 'p2'] }, resources)).toBe('Formulário do site / landing · 2 páginas');
    expect(formatConditionSummary('lead.created', { field: 'site_page_id', operator: 'in', value: ['p1'] }, resources)).toBe('Formulário do site / landing · 1 página');
    expect(formatConditionSummary('lead.created', { field: 'source', operator: 'eq', value: 'formulario_site' }, resources)).toBe('Origem: Formulário do site / landing');
  });
});
