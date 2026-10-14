import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Visit } from '@/services/visits/visitsService';
import type { PipelineItem } from '@/types/analytics';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const addLabels = vi.fn();
vi.mock('@/services/conversations/conversationService', () => ({
  conversationAPI: { addLabels: (...a: unknown[]) => addLabels(...a) },
}));
vi.mock('@/services/chat/chatService', () => ({
  chatService: { toggleSalesAgent: vi.fn(), getSalesAgentStatus: vi.fn() },
}));

// A janela de agendar de verdade busca horários e corretores: aqui só importa
// o que ela devolve ao criar (`criarNaJanela` simula a visita salva).
let criarNaJanela: (v: Visit) => void = () => {};
vi.mock('@/components/visits/ScheduleVisitDialog', () => ({
  ScheduleVisitDialog: (p: { open: boolean; onCreated: (v: Visit) => void }) => {
    if (p.open) criarNaJanela = p.onCreated;
    return p.open ? <div data-testid="janela">Janela de agendar</div> : null;
  },
}));

import LeadQuickActions from './LeadQuickActions';

const item = {
  id: 'i1',
  pipeline_id: 'p1',
  conversation: { id: 'conv1', contact: { id: 'c1', name: 'Maria Teste' } },
} as unknown as PipelineItem;

const visita = (status: Visit['status']): Visit => ({
  id: 'v1',
  property_id: null,
  contact_id: 'c1',
  status,
  scheduled_at: new Date(2026, 9, 9, 15, 0).toISOString(),
  created_at: '',
  updated_at: '',
});

beforeEach(() => {
  vi.clearAllMocks();
  addLabels.mockResolvedValue(undefined);
});

async function criar(status: Visit['status']) {
  const onVisitaCriada = vi.fn();
  const user = userEvent.setup();
  render(
    <LeadQuickActions item={item} nomeExibido="Maria Teste" abrindoConversa={false} onAbrirConversa={vi.fn()} onVisitaCriada={onVisitaCriada} />,
  );
  await user.click(screen.getByRole('button', { name: /Agendar visita/ }));
  await screen.findByTestId('janela');
  act(() => { criarNaJanela(visita(status)); });
  return onVisitaCriada;
}

describe('LeadQuickActions: etiqueta da visita', () => {
  it('visita agendada põe a etiqueta "visita-agendada" na conversa', async () => {
    const onVisitaCriada = await criar('scheduled');
    expect(addLabels).toHaveBeenCalledWith('conv1', ['visita-agendada']);
    expect(onVisitaCriada).toHaveBeenCalledTimes(1);
  });

  it('visita registrada como realizada não ganha a etiqueta de agendada', async () => {
    const onVisitaCriada = await criar('completed');
    expect(addLabels).not.toHaveBeenCalled();
    expect(onVisitaCriada).toHaveBeenCalledTimes(1);
  });
});

describe('LeadQuickActions: modo compacto', () => {
  const comIa = (status: 'active' | 'idle' | 'handoff' | 'none') =>
    ({ ...item, sales_agent: { status, label: '' } }) as unknown as PipelineItem;
  const montar = (it: PipelineItem, compacto = true) =>
    render(<LeadQuickActions item={it} nomeExibido="Maria Teste" abrindoConversa={false} onAbrirConversa={vi.fn()} compacto={compacto} />);

  it('IA que dá pra ligar mostra "IA: ligar" sem cara de desligado', () => {
    montar(comIa('idle'));
    const botao = screen.getByRole('button', { name: /IA: ligar/ });
    expect(botao).not.toBeDisabled();
    expect(botao.className).not.toMatch(/(^|\s)opacity-50/);
    expect(botao).toHaveAttribute('aria-pressed', 'false');
    expect(botao.className).toContain('aria-pressed:bg-primary/10');
  });

  it('IA ligada: "IA ligada" marcada; sem IA no número: desligado com o motivo', () => {
    const { unmount } = montar(comIa('active'));
    expect(screen.getByRole('button', { name: /IA ligada/ })).toHaveAttribute('aria-pressed', 'true');
    unmount();
    montar(comIa('none'));
    const sem = screen.getByRole('button', { name: /Sem IA/ });
    expect(sem).toBeDisabled();
    expect(sem).toHaveAttribute('title', 'Nenhuma IA ligada no número deste lead.');
  });

  it('fileira baixa de 3 botões (h-10); sem compacto continuam os tijolos da página', () => {
    const { unmount } = montar(comIa('idle'));
    expect(screen.getByRole('button', { name: /Agendar visita/ }).className).toContain('h-10');
    unmount();
    montar(comIa('idle'), false);
    expect(screen.getByRole('button', { name: /Agendar visita/ }).className).toContain('aspect-square');
  });
});
