import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Automações · sprint 3 (03/10/2026): a aba Follow-up é a lista do construtor
// com os fluxos de follow-up. "Novo follow-up" cria pelo modelo (o servidor
// monta) e os funis antigos com fila aparecem numa faixa só pra ver.

const list = vi.hoisted(() => vi.fn());
const create = vi.hoisted(() => vi.fn());
const foldersList = vi.hoisted(() => vi.fn());
const getAll = vi.hoisted(() => vi.fn());
const getHistory = vi.hoisted(() => vi.fn());

vi.mock('@/services/flowAutomations/flowAutomationsService', () => ({
  flowAutomationsService: { list, create },
  flowAutomationFoldersService: { list: foldersList },
}));
vi.mock('@/services/followupSequences/followupSequencesService', () => ({
  followupSequencesService: { getAll, getHistory },
}));
vi.mock('@/components/flowAutomations/FlowTemplates', () => ({
  FlowTemplateList: () => null,
  FlowTemplatesDialog: () => null,
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import FlowAutomationsList from './FlowAutomationsList';

const renderAt = (kind: 'followup' | 'automation') =>
  render(
    <MemoryRouter initialEntries={['/lista']}>
      <Routes>
        <Route path="/lista" element={<FlowAutomationsList kind={kind} />} />
        <Route path="/automations/follow-ups/:id" element={<p>canvas do follow-up</p>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  [list, create, foldersList, getAll, getHistory].forEach(m => m.mockReset());
  list.mockResolvedValue([]);
  foldersList.mockResolvedValue([]);
  getAll.mockResolvedValue([]);
});

describe('aba Follow-up', () => {
  it('lista só os follow-ups, sem Modelos nem pastas', async () => {
    list.mockResolvedValue([{
      id: 'f1', name: 'Follow-up longo', kind: 'followup', is_enabled: true, archived_at: null,
      trigger: { event: 'lead.stage_changed', conditions: [], alternatives: [{ event: 'lead.tag_added', conditions: [] }] },
    }]);
    renderAt('followup');

    expect(await screen.findByText('Follow-up longo')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Follow-up' })).toBeTruthy();
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ kind: 'followup' }));
    expect(foldersList).not.toHaveBeenCalled();
    expect(screen.queryByText('Modelos')).toBeNull();
    // O cartão mostra todos os gatilhos.
    expect(screen.getByText('Etapa alterada ou Etiqueta adicionada')).toBeTruthy();
  });

  it('"Novo follow-up" cria com kind followup e abre o canvas do follow-up', async () => {
    create.mockResolvedValue({ id: 'novo', kind: 'followup' });
    renderAt('followup');

    fireEvent.click((await screen.findAllByRole('button', { name: /Novo follow-up/ }))[0]);

    await waitFor(() => expect(create).toHaveBeenCalledWith({ name: 'Novo follow-up', kind: 'followup' }));
    expect(await screen.findByText('canvas do follow-up')).toBeTruthy();
  });

  it('faixa dos funis antigos com fila: só os que têm mensagem programada (queued_count)', async () => {
    getAll.mockResolvedValue([
      { id: 's1', name: 'Follow-up longo', queued_count: 87 },
      { id: 's2', name: 'Follow-up automatico', queued_count: 0 },
      { id: 's3', name: 'Apto', queued_count: 13 },
    ]);
    renderAt('followup');

    expect(await screen.findByText(/Follow-up longo — 87 mensagens programadas/)).toBeTruthy();
    expect(screen.getByText(/Apto — 13 mensagens programadas/)).toBeTruthy();
    expect(screen.getAllByText('Terminando no formato antigo:')).toHaveLength(2);
    expect(screen.queryByText(/Follow-up automatico/)).toBeNull();
    // Uma leitura só: nada de histórico por funil.
    expect(getHistory).not.toHaveBeenCalled();
  });

  it('a aba Automações continua igual: sem kind, com pastas e Modelos', async () => {
    renderAt('automation');
    expect(await screen.findByRole('heading', { name: 'Automações' })).toBeTruthy();
    await waitFor(() => expect(foldersList).toHaveBeenCalled());
    expect(list.mock.calls[0][0]).not.toHaveProperty('kind');
    expect(screen.getByText('Modelos')).toBeTruthy();
    expect(getAll).not.toHaveBeenCalled();
  });
});
