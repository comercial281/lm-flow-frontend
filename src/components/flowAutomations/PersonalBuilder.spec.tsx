import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { FlowTriggerPanel } from './FlowTriggerPanel';
import { FlowBlocksPanel } from './FlowBlocksPanel';
import { FLOW_TRIGGER_GROUPS } from '@/features/flowAutomations/trigger';
import { personalTriggerGroups, personalBlockState } from '@/features/flowAutomations/personal';
import { podeSoltarBloco } from '@/features/flowAutomations/palette';
import type { AutomationResources } from '@/pages/Customer/Settings/LeadAutomations/LeadAutomationsEditors';

const resources: AutomationResources = {
  labels: [], sequences: [], followupFlows: [], users: [{ id: 'u1', name: 'Ana' }], pipelines: [], stagesByPipeline: {}, quickReplies: [],
  adOrigins: [], formOrigins: [], messageFunnels: [], conversationFunnels: [], evolutionInstances: [],
  reloadFunnels: () => {}, reloadLabels: () => {}, loading: false,
} as unknown as AutomationResources;

const trig = (event: string) => ({ event, conditions: [] }) as never;

describe('construtor do corretor', () => {
  it('o seletor do gatilho só oferece os gatilhos do cargo', () => {
    render(
      <FlowTriggerPanel trigger={trig('lead.created')} resources={resources} onClose={() => {}} onSave={() => {}}
        soGatilhos={personalTriggerGroups(FLOW_TRIGGER_GROUPS).filter(g => g.label === 'Atendimento')} />,
    );
    const sel = screen.getByLabelText('Gatilho') as HTMLSelectElement;
    const values = Array.from(sel.options).map(o => o.value);
    expect(values).not.toContain('flow_called');
    expect(values).toContain('lead.roleta_accepted');
    expect(values).not.toContain('lead.visit_scheduled');
    expect(values).not.toContain('lead.stage_changed');
  });

  it('semFiltroDeQuemAceitou esconde "Só quando quem aceitou for"', () => {
    const { rerender } = render(
      <FlowTriggerPanel trigger={trig('lead.roleta_accepted')} resources={resources} onClose={() => {}} onSave={() => {}} />,
    );
    expect(screen.getByText(/Só quando quem aceitou for/)).toBeTruthy();
    rerender(
      <FlowTriggerPanel trigger={trig('lead.roleta_accepted')} resources={resources} onClose={() => {}} onSave={() => {}}
        semFiltroDeQuemAceitou />,
    );
    expect(screen.queryByText(/Só quando quem aceitou for/)).toBeNull();
  });

  const estado = (item: Parameters<typeof personalBlockState>[0]) =>
    personalBlockState(item, { temNumero: false, temIA: false });

  it('a paleta não mostra "Avisar no grupo" (fora)', () => {
    render(<FlowBlocksPanel onPick={() => {}} onClose={() => {}} estadoDoBloco={estado} />);
    expect(screen.queryByText('Avisar no grupo')).toBeNull();
    expect(screen.getByText('Esperar')).toBeTruthy();
  });

  it('"Mandar WhatsApp" indisponível: desabilitado, com texto, e clique não chama onPick', () => {
    const onPick = vi.fn();
    render(<FlowBlocksPanel onPick={onPick} onClose={() => {}} estadoDoBloco={estado} />);
    const btn = screen.getByRole('button', { name: /Mandar WhatsApp/ }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.draggable).toBe(false);
    expect(within(btn).getByText('Indisponível')).toBeTruthy();
    fireEvent.click(btn);
    expect(onPick).not.toHaveBeenCalled();
  });

  it('soltar bloco indisponível ou fora não cria nó', () => {
    expect(podeSoltarBloco({ key: 'send_whatsapp' } as never, estado)).toBe(false);
    expect(podeSoltarBloco({ key: 'wait' } as never, estado)).toBe(true);
    expect(podeSoltarBloco({ key: 'wait' } as never, undefined)).toBe(true);
  });
});
