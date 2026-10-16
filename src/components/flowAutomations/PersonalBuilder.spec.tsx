import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { FlowTriggerPanel } from './FlowTriggerPanel';
import { FlowBlocksPanel } from './FlowBlocksPanel';
import { FLOW_TRIGGER_GROUPS } from '@/features/flowAutomations/trigger';
import { personalTriggerGroups, personalBlockState, PERSONAL_TRIGGERS } from '@/features/flowAutomations/personal';
import { podeSoltarBloco } from '@/features/flowAutomations/palette';
import type { AutomationResources } from '@/pages/Customer/Settings/LeadAutomations/LeadAutomationsEditors';

const resources: AutomationResources = {
  labels: [], sequences: [], followupFlows: [], users: [{ id: 'u1', name: 'Ana' }], pipelines: [], stagesByPipeline: {}, quickReplies: [],
  adOrigins: [], formOrigins: [], messageFunnels: [], conversationFunnels: [], evolutionInstances: [],
  reloadFunnels: () => {}, reloadLabels: () => {}, loading: false,
} as unknown as AutomationResources;

const trig = (event: string) => ({ event, conditions: [] }) as never;

describe('construtor do corretor', () => {
  it('o seletor do gatilho oferece exatamente os gatilhos do cargo', () => {
    render(
      <FlowTriggerPanel trigger={trig('lead.created')} resources={resources} onClose={() => {}} onSave={() => {}}
        soGatilhos={personalTriggerGroups(FLOW_TRIGGER_GROUPS)} />,
    );
    const sel = screen.getByLabelText('Gatilho') as HTMLSelectElement;
    const values = Array.from(sel.options).map(o => o.value).filter(Boolean);
    expect([...values].sort()).toEqual([...PERSONAL_TRIGGERS].sort());
    expect(values).not.toContain('flow_called');
  });

  it('gatilho salvo fora da lista: opção marcada Indisponível e aviso (principal)', () => {
    render(
      <FlowTriggerPanel trigger={trig('flow_called')} resources={resources} onClose={() => {}} onSave={() => {}}
        soGatilhos={personalTriggerGroups(FLOW_TRIGGER_GROUPS)} />,
    );
    const sel = screen.getByLabelText('Gatilho') as HTMLSelectElement;
    expect(Array.from(sel.options).some(o => o.value === 'flow_called' && /\(Indisponível\)$/.test(o.text))).toBe(true);
    expect(screen.getByText('Este gatilho não está disponível pro seu cargo. Escolha outro.')).toBeTruthy();
  });

  it('gatilho salvo fora da lista em "Ou quando": mesma marca e aviso', () => {
    const t = { event: 'lead.created', conditions: [], alternatives: [{ event: 'flow_called', conditions: [] }] } as never;
    render(
      <FlowTriggerPanel trigger={t} resources={resources} onClose={() => {}} onSave={() => {}}
        soGatilhos={personalTriggerGroups(FLOW_TRIGGER_GROUPS)} />,
    );
    const sel = screen.getByLabelText('Ou quando 1') as HTMLSelectElement;
    expect(Array.from(sel.options).some(o => /\(Indisponível\)$/.test(o.text))).toBe(true);
    expect(screen.getAllByText('Este gatilho não está disponível pro seu cargo. Escolha outro.')).toHaveLength(1);
  });

  it('sem restrição (gestor): gatilho fora da lista não ganha aviso', () => {
    render(<FlowTriggerPanel trigger={trig('flow_called')} resources={resources} onClose={() => {}} onSave={() => {}} />);
    expect(screen.queryByText(/não está disponível pro seu cargo/)).toBeNull();
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
