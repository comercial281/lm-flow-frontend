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
const get = vi.hoisted(() => vi.fn());
const toggle = vi.hoisted(() => vi.fn());
const archive = vi.hoisted(() => vi.fn());
const destroy = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());

vi.mock('@/services/flowAutomations/flowAutomationsService', () => ({
  flowAutomationsService: { list, create, get, toggle, archive, destroy },
  flowAutomationFoldersService: { list: foldersList },
}));
vi.mock('@/services/followupSequences/followupSequencesService', () => ({
  followupSequencesService: { getAll, getHistory },
}));
vi.mock('@/components/flowAutomations/FlowTemplates', () => ({
  FlowTemplateList: () => null,
  FlowTemplatesDialog: () => null,
}));
vi.mock('@/features/flowAutomations/readiness', async importOriginal => ({
  ...(await importOriginal<typeof import('@/features/flowAutomations/readiness')>()),
  enableProblem: () => null,
}));
vi.mock('sonner', () => ({ toast: { error: toastError, success: toastSuccess } }));

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
  [list, create, foldersList, getAll, getHistory, get, toggle, archive, destroy, toastError, toastSuccess].forEach(m => m.mockReset());
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

// Follow-up: uma porta só (Fase 2): desligar com lead dentro avisa quantos saem.
const seguindo = (patch: Record<string, unknown> = {}) => ({
  id: 'f1', name: 'Pós-visita', kind: 'followup', is_enabled: true, archived_at: null, live_count: 3,
  trigger: { event: 'lead.stage_changed', conditions: [] },
  permissions: { can_edit: true },
  ...patch,
});

describe('desligar follow-up (Fase 2)', () => {
  it('desligar com leads dentro pede confirmação com a contagem', async () => {
    list.mockResolvedValue([seguindo()]);
    toggle.mockResolvedValue(seguindo({ is_enabled: false, stopped_count: 3, remaining: 0 }));
    renderAt('followup');

    fireEvent.click(await screen.findByTitle('Desligar'));
    expect(await screen.findByText('Desligar "Pós-visita"?')).toBeTruthy();
    expect(screen.getByText('3 leads vão sair do follow-up e os cards saem da coluna Follow-up.')).toBeTruthy();
    expect(toggle).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Desligar' }));
    await waitFor(() => expect(toggle).toHaveBeenCalledWith('f1'));
    expect(toastError).not.toHaveBeenCalled();
  });

  it('cancelar a confirmação não desliga', async () => {
    list.mockResolvedValue([seguindo()]);
    renderAt('followup');
    fireEvent.click(await screen.findByTitle('Desligar'));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByText('Desligar "Pós-visita"?')).toBeNull());
    expect(toggle).not.toHaveBeenCalled();
  });

  it('sem leads dentro desliga direto', async () => {
    list.mockResolvedValue([seguindo({ live_count: 0 })]);
    toggle.mockResolvedValue(seguindo({ is_enabled: false, live_count: 0, stopped_count: 0, remaining: 0 }));
    renderAt('followup');
    fireEvent.click(await screen.findByTitle('Desligar'));
    await waitFor(() => expect(toggle).toHaveBeenCalledWith('f1'));
    expect(screen.queryByText('Desligar "Pós-visita"?')).toBeNull();
  });

  it('sobrou lead saindo: avisa que o sistema termina em seguida', async () => {
    list.mockResolvedValue([seguindo()]);
    toggle.mockResolvedValue(seguindo({ is_enabled: false, stopped_count: 1, remaining: 2 }));
    renderAt('followup');
    fireEvent.click(await screen.findByTitle('Desligar'));
    fireEvent.click(await screen.findByRole('button', { name: 'Desligar' }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Desligado. 2 leads ainda saindo do follow-up; o sistema termina em seguida.'));
  });

  it('ligar não pergunta (mesmo com live_count)', async () => {
    list.mockResolvedValue([seguindo({ is_enabled: false })]);
    getAll.mockResolvedValue([]);
    // ligar confere o fluxo salvo primeiro
    get.mockResolvedValue(seguindo({ is_enabled: false, nodes: [] }));
    toggle.mockResolvedValue(seguindo({ is_enabled: true }));
    renderAt('followup');
    fireEvent.click(await screen.findByTitle('Ligar'));
    await waitFor(() => expect(toggle).toHaveBeenCalledWith('f1'));
    expect(screen.queryByText('Desligar "Pós-visita"?')).toBeNull();
  });

  it('apagar com lead dentro mostra a mensagem do servidor', async () => {
    list.mockResolvedValue([seguindo()]);
    destroy.mockRejectedValue({ response: { data: { errors: ['Este follow-up tem 3 lead(s) dentro. Desligue antes de apagar.'] } } });
    renderAt('followup');
    fireEvent.click(await screen.findByTitle('Excluir'));
    fireEvent.click(await screen.findByRole('button', { name: 'Excluir' }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Este follow-up tem 3 lead(s) dentro. Desligue antes de apagar.'));
  });
});
