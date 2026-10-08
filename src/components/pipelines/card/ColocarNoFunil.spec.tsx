import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const addItemToPipeline = vi.fn();
vi.mock('@/services/pipelines/pipelinesService', () => ({
  pipelinesService: {
    getPipelines: async () => ({ data: [{ id: 'p1', name: 'Vendas' }] }),
    getPipelineStages: async () => ({ data: [{ id: 's1', position: 1 }] }),
    addItemToPipeline: (...a: unknown[]) => addItemToPipeline(...a),
  },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import ColocarNoFunil from './ColocarNoFunil';

beforeEach(() => addItemToPipeline.mockReset().mockResolvedValue({}));

async function escolher() {
  const lista = await screen.findByLabelText('Colocar no funil');
  await waitFor(() => expect(lista.querySelectorAll('option').length).toBeGreaterThan(1));
  fireEvent.change(lista, { target: { value: 'p1' } });
}

describe('ColocarNoFunil', () => {
  it('com conversa, coloca pela conversa (a origem sai do WhatsApp)', async () => {
    render(<ColocarNoFunil contactId="c9" conversationId="77" onColocado={() => {}} />);
    await escolher();
    await waitFor(() => expect(addItemToPipeline).toHaveBeenCalledWith('p1', { item_id: '77', type: 'conversation', pipeline_stage_id: 's1' }));
  });

  it('sem conversa, continua pelo contato', async () => {
    render(<ColocarNoFunil contactId="c9" onColocado={() => {}} />);
    await escolher();
    await waitFor(() => expect(addItemToPipeline).toHaveBeenCalledWith('p1', { item_id: 'c9', type: 'contact', pipeline_stage_id: 's1' }));
  });
});
