import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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

// No computador a caixa da lista do produto mede o rótulo escolhido (w-fit). Na
// linha do gatilho, cada lista tem largura fixa pelo maior rótulo: a linha não
// pula quando se troca a escolha, como o <select> nativo.
describe('gatilho no computador', () => {
  beforeEach(() => {
    Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
    Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
    Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false, media: '(pointer: coarse)', addEventListener: () => {}, removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
  });
  afterEach(() => {
    // @ts-expect-error: o jsdom não tem matchMedia; voltamos a não ter.
    delete window.matchMedia;
  });

  it('o tipo do gatilho tem largura fixa e troca pela lista do produto', async () => {
    render(<Harness />);
    // A lista não tem rótulo: acha-se a caixa pelo texto da escolha atual.
    const tipo = (await screen.findByText('Veio de um destes formulários')).closest('button')!;
    expect(tipo.className.split(/\s+/)).toContain('w-72');
    await userEvent.click(tipo);
    await userEvent.click(await screen.findByRole('option', { name: 'Origem do lead' }));
    const origem = (await screen.findByText('Só anúncios (FB/IG/Google)')).closest('button')!;
    expect(origem.className.split(/\s+/)).toContain('w-64');
  });
});
