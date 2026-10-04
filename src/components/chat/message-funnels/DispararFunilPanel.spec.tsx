import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Automações · sprint 4 (04/10/2026): o "Disparar funil" do campo de mensagem.
// Lista Meus funis / Da equipe, prévia da sequência e o disparo no servidor.

const list = vi.hoisted(() => vi.fn());
const get = vi.hoisted(() => vi.fn());
const start = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), info: vi.fn() }));

vi.mock('@/services/flowAutomations/flowAutomationsService', () => ({
  flowAutomationsService: { list, get },
  flowAutomationFoldersService: {},
}));
vi.mock('@/services/flowAutomations/flowAutomationInstancesService', () => ({
  flowAutomationInstancesService: { start },
}));
vi.mock('sonner', () => ({ toast }));

import { DispararFunilPanel } from './DispararFunilPanel';

const funnel = (id: string, name: string, patch: Record<string, unknown> = {}) => ({
  id, name, kind: 'conversation', is_enabled: true, archived_at: null, team: false, guide_pending: [], ...patch,
});

const nodes = [
  { id: 'm1', kind: 'send_whatsapp', label: null, config: { text: 'Oi {{nome}}, tudo bem?' }, next_node_id: 'w1', next_yes_node_id: null, next_no_node_id: null, pos_x: null, pos_y: null, steps: [] },
  { id: 'w1', kind: 'wait', label: null, config: { mode: 'interval', minutes: 0, seconds: 10 }, next_node_id: 'm2', next_yes_node_id: null, next_no_node_id: null, pos_x: null, pos_y: null, steps: [] },
  { id: 'm2', kind: 'send_whatsapp', label: null, config: { text: 'Você ainda procura imóvel?' }, next_node_id: null, next_yes_node_id: null, next_no_node_id: null, pos_x: null, pos_y: null, steps: [] },
];

const renderPanel = (props: Partial<Parameters<typeof DispararFunilPanel>[0]> = {}) => {
  const onClose = vi.fn();
  const onStarted = vi.fn();
  render(
    <MemoryRouter initialEntries={['/conversations/7']}>
      <Routes>
        <Route
          path="/conversations/:id"
          element={<DispararFunilPanel isOpen onClose={onClose} conversationId={7} onStarted={onStarted} {...props} />}
        />
        <Route path="/automations/message-funnels/:id" element={<p>canvas do funil</p>} />
      </Routes>
    </MemoryRouter>,
  );
  return { onClose, onStarted };
};

beforeEach(() => {
  list.mockReset();
  get.mockReset();
  start.mockReset();
  Object.values(toast).forEach(fn => fn.mockReset());
});

describe('Disparar funil', () => {
  it('lista os meus e os da equipe, com busca', async () => {
    list.mockResolvedValue([
      funnel('f1', 'Reaquecer lead parado'),
      funnel('f2', 'Pós-visita'),
      funnel('f3', 'Pedir documentos', { team: true, owner_name: 'Gestor' }),
    ]);
    renderPanel();
    expect(await screen.findByText('Reaquecer lead parado')).toBeTruthy();
    expect(screen.queryByText('Pedir documentos')).toBeNull();
    fireEvent.change(screen.getByLabelText('Buscar funil'), { target: { value: 'pós' } });
    expect(screen.queryByText('Reaquecer lead parado')).toBeNull();
    expect(screen.getByText('Pós-visita')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Buscar funil'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('tab', { name: /Da equipe/ }));
    expect(screen.getByText('Pedir documentos')).toBeTruthy();
  });

  it('clicar mostra a prévia; Disparar inicia no servidor com a conversa e atualiza a faixa', async () => {
    list.mockResolvedValue([funnel('f1', 'Reaquecer lead parado')]);
    get.mockResolvedValue({ ...funnel('f1', 'Reaquecer lead parado'), initial_node_id: 'm1', nodes });
    start.mockResolvedValue({ started: true, message: '"Reaquecer lead parado" iniciado para este lead.' });
    const { onClose, onStarted } = renderPanel();
    fireEvent.click(await screen.findByText('Reaquecer lead parado'));
    const sequencia = await screen.findByRole('list', { name: 'Sequência do funil' });
    const linhas = within(sequencia).getAllByRole('listitem').map(li => li.textContent);
    expect(linhas).toEqual(['Oi {{nome}}, tudo bem?', 'Espera 10 segundos', 'Você ainda procura imóvel?']);
    fireEvent.click(screen.getByRole('button', { name: 'Disparar' }));
    await waitFor(() => expect(start).toHaveBeenCalledWith({ conversationId: '7' }, 'f1'));
    expect(toast.success).toHaveBeenCalledWith('"Reaquecer lead parado" iniciado para este lead.');
    expect(onStarted).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('lead que já está no funil: aviso, não erro', async () => {
    list.mockResolvedValue([funnel('f1', 'Reaquecer lead parado')]);
    get.mockResolvedValue({ ...funnel('f1', 'Reaquecer lead parado'), initial_node_id: 'm1', nodes });
    start.mockResolvedValue({ started: false, message: 'Este lead já está em "Reaquecer lead parado".' });
    renderPanel();
    fireEvent.click(await screen.findByText('Reaquecer lead parado'));
    fireEvent.click(await screen.findByRole('button', { name: 'Disparar' }));
    await waitFor(() => expect(toast.info).toHaveBeenCalledWith('Este lead já está em "Reaquecer lead parado".'));
  });

  it('a recusa do servidor aparece como veio', async () => {
    list.mockResolvedValue([funnel('f1', 'Reaquecer lead parado')]);
    get.mockResolvedValue({ ...funnel('f1', 'Reaquecer lead parado'), initial_node_id: 'm1', nodes });
    start.mockRejectedValue({ response: { status: 422, data: { errors: ['Não deu pra iniciar "Reaquecer lead parado": o fluxo está desligado ou arquivado.'] } } });
    renderPanel();
    fireEvent.click(await screen.findByText('Reaquecer lead parado'));
    fireEvent.click(await screen.findByRole('button', { name: 'Disparar' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
      'Não deu pra iniciar "Reaquecer lead parado": o fluxo está desligado ou arquivado.',
    ));
  });

  it('funil com o passo a passo pela metade mostra "Termine de montar", que leva pro canvas', async () => {
    list.mockResolvedValue([
      funnel('f1', 'Apresentação do imóvel', { is_enabled: false, guide_pending: [{ node_id: 'n', step: 2, total: 3, title: 'x' }] }),
    ]);
    renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: 'Termine de montar' }));
    expect(await screen.findByText('canvas do funil')).toBeTruthy();
    expect(get).not.toHaveBeenCalled();
  });

  it('sem funil meu e com da equipe, abre na equipe', async () => {
    list.mockResolvedValue([funnel('f3', 'Pedir documentos', { team: true })]);
    renderPanel();
    expect(await screen.findByText('Pedir documentos')).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Da equipe/ }).getAttribute('aria-selected')).toBe('true');
  });
});
