// src/components/pipelines/card/LeadDetailsTab.spec.tsx
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import LeadDetailsTab from './LeadDetailsTab';

const list = vi.hoisted(() => vi.fn());
vi.mock('@/services/contacts/leadTimelineService', () => ({ leadTimelineService: { list } }));
vi.mock('@/services/notes/notesService', () => ({
  notesService: { getByContact: vi.fn().mockResolvedValue([]), create: vi.fn(), delete: vi.fn() },
}));
vi.mock('@/components/chat/contact-sidebar/AiUnderstandingPanel', () => ({ default: () => null }));
vi.mock('./OutrasInformacoes', () => ({ default: () => null }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const item = {
  id: 'i1',
  pipeline_id: 'p1',
  stage_id: 's1',
  contact: { id: 'c1', name: 'Maria Souza', custom_attributes: {} },
} as never;

beforeEach(() => {
  list.mockReset().mockResolvedValue({
    events: [
      { id: 'mov-1', category: 'alteracao', kind: 'stage_changed', title: 'Mudou de etapa', detail: 'Novo → 1º contato',
        actor: 'Ana', occurred_at: '2026-10-07T12:00:00.000000Z', pipeline_name: 'Leads (Marketing)', tone: 'neutral' },
      { id: 'note-1', category: 'observacao', kind: 'note_added', title: 'Observação adicionada', detail: 'Ligar às 18h',
        actor: 'Ana', occurred_at: '2026-10-07T11:00:00.000000Z', pipeline_name: null, tone: 'neutral' },
    ],
    next_before: null,
  });
});

describe('LeadDetailsTab › Histórico da janela', () => {
  it('mostra o Histórico novo, compacto, e as Observações continuam numa caixa separada', async () => {
    render(
      <LeadDetailsTab item={item} mostrarImoveis={false} mostrarObservacoes versaoHistorico="0" funilAtual="Leads (Marketing)" />,
    );

    const historico = await screen.findByRole('region', { name: 'Histórico do lead' });
    expect(await within(historico).findByText('Mudou de etapa')).toBeInTheDocument();
    expect(within(historico).queryByText('Ligar às 18h')).not.toBeInTheDocument();
    expect(within(historico).queryByRole('button', { name: 'Observações' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Observações' })).toBeInTheDocument();
    expect(list).toHaveBeenCalledWith('c1', { category: 'resumo' });
  });

  it('sem a função de Observações do cliente, só o Histórico', async () => {
    render(<LeadDetailsTab item={item} mostrarImoveis={false} mostrarObservacoes={false} versaoHistorico="0" />);

    await screen.findByRole('region', { name: 'Histórico do lead' });
    expect(screen.queryByRole('heading', { name: 'Observações' })).not.toBeInTheDocument();
  });
});
