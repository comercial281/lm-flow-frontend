import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/services/leadAds/leadAdsFormsService', () => ({
  leadAdsFormsService: { getAll: vi.fn().mockResolvedValue([{ form_id: '111', form_name: 'Capri', page_name: null, is_active: true }]) },
}));
vi.mock('@/services/pipelines/pipelinesService', () => ({
  pipelinesService: { getPipelines: vi.fn().mockResolvedValue({ data: [] }), getPipelineStages: vi.fn() },
}));

import { TriggersSection } from './SalesAgents';
import type { SalesAgent } from '@/services/salesAgents/salesAgentsService';

function Harness() {
  const [agent, setAgent] = useState({ id: 'a1', triggers: [{ type: 'form', form_ids: [] }], trigger_match_mode: 'any' } as unknown as SalesAgent);
  return <TriggersSection agent={agent} onSave={(p) => setAgent((a) => ({ ...a, ...p }))} />;
}

// A caixinha marca quando o servidor devolve a lista. Se ela "desmarca sozinha"
// em produção, quem descartou foi o servidor — e a tela passou a avisar isso.
describe('gatilho de formulário', () => {
  it('marca o formulário ao clicar', async () => {
    render(<Harness />);
    const box = await screen.findByRole('checkbox');
    fireEvent.click(box);
    await waitFor(() => expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true));
  });
});
