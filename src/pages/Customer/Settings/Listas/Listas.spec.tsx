// src/pages/Customer/Settings/Listas/Listas.spec.tsx
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { ListKey, ListOption } from '@/services/listOptions/listOptionsService';

// Minha imobiliária › Listas (E1 do funil). Cada teste é uma regra da tela:
// carregar ≠ erro ≠ vazio, criar, renomear, arquivar só com confirmação,
// reordenar, e só o gestor mexe.

const svc = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), update: vi.fn(), reorder: vi.fn() }));
const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
const perm = vi.hoisted(() => ({ podeMudar: true }));
// A aba Categorias de tarefa nasce escondida (abasDasListas.ts); os testes dela ligam a chave.
const chave = vi.hoisted(() => ({ categorias: false }));

vi.mock('@/services/listOptions/listOptionsService', () => ({ listOptionsService: svc }));
vi.mock('sonner', () => ({ toast: toasts }));
vi.mock('./abasDasListas', () => ({
  get CATEGORIAS_DE_TAREFA_NA_TELA() { return chave.categorias; },
}));
vi.mock('@/hooks/useCan', () => ({
  useCan: () => (r: string, a: string) => (`${r}.${a}` === 'pipelines.update' ? perm.podeMudar : true),
}));

import Listas from './Listas';

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
});

const op = (id: string, label: string, position: number, extra: Partial<ListOption> = {}, list_key: ListKey = 'loss_reasons'): ListOption => ({
  id, list_key, label, position, active: true, meta_exclusion: false, ...extra,
});
const MOTIVOS = [
  op('m2', 'Desistiu', 1),
  op('m1', 'Adiou a compra', 0),
  op('m3', 'Sem perfil ou sem crédito', 2, { meta_exclusion: true }),
  op('m9', 'Velho motivo', 3, { active: false }),
];
const CATEGORIAS = [op('c1', 'Follow-up', 0, {}, 'task_categories'), op('c2', 'Oferta ativa', 1, {}, 'task_categories')];

// <span>, não <output>: o <output> tem papel "status" e confundiria o teste do carregando.
function Endereco() {
  return <span data-testid="endereco">{useLocation().search}</span>;
}

const abrir = (endereco = '/settings/listas') =>
  render(
    <MemoryRouter initialEntries={[endereco]}>
      <Routes>
        <Route path="/settings/listas" element={<><Listas /><Endereco /></>} />
      </Routes>
    </MemoryRouter>,
  );

const linhas = () => within(screen.getByRole('list', { name: 'Motivos de perda' })).getAllByRole('listitem');

beforeEach(() => {
  vi.clearAllMocks();
  perm.podeMudar = true;
  chave.categorias = false;
  svc.list.mockImplementation(async (key: ListKey) => (key === 'loss_reasons' ? MOTIVOS : CATEGORIAS));
});

describe('Listas', () => {
  it('cabeçalho da casa, só Motivos de perda (Categorias escondida); ordem gravada, arquivadas à parte', async () => {
    abrir();

    expect(screen.getByRole('heading', { level: 1, name: 'Listas' })).toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.queryByText(/categoria de uma tarefa/)).not.toBeInTheDocument();

    await screen.findByRole('list', { name: 'Motivos de perda' });
    expect(svc.list).toHaveBeenCalledWith('loss_reasons', { includeInactive: true });
    expect(linhas().map(l => (within(l).getByRole('textbox') as HTMLInputElement).value))
      .toEqual(['Adiou a compra', 'Desistiu', 'Sem perfil ou sem crédito']);
    expect(within(screen.getByRole('region', { name: 'Arquivadas' })).getByText('Velho motivo')).toBeInTheDocument();
  });

  it('carregando mostra o aviso, e não a lista vazia', () => {
    svc.list.mockReturnValue(new Promise(() => {}));
    abrir();
    expect(screen.getByRole('status')).toHaveTextContent('Carregando…');
    expect(screen.queryByText('Nenhum motivo de perda ainda')).not.toBeInTheDocument();
  });

  it('não carregou: erro com "Tentar de novo", nunca a lista vazia', async () => {
    svc.list.mockRejectedValueOnce(new Error('Network Error'));
    abrir();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('Nenhum motivo de perda ainda')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByRole('list', { name: 'Motivos de perda' })).toBeInTheDocument();
  });

  it('lista sem nenhuma ativa: estado vazio que ensina, e dá pra criar a primeira', async () => {
    svc.list.mockResolvedValue([]);
    abrir();
    expect(await screen.findByText('Nenhum motivo de perda ainda')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Novo motivo' })).toBeInTheDocument();
  });

  it('adicionar cria no fim, limpa o campo e avisa', async () => {
    svc.create.mockResolvedValue(op('m5', 'Mudou de ideia', 4));
    abrir();
    await screen.findByRole('list', { name: 'Motivos de perda' });

    await userEvent.type(screen.getByRole('textbox', { name: 'Novo motivo' }), '  Mudou de ideia {Enter}');

    expect(svc.create).toHaveBeenCalledWith('loss_reasons', { label: 'Mudou de ideia' });
    await waitFor(() => expect(linhas()).toHaveLength(4));
    expect(screen.getByRole('textbox', { name: 'Novo motivo' })).toHaveValue('');
    expect(toasts.success).toHaveBeenCalledWith('Opção criada');
  });

  it('renomear grava ao sair do campo; recusa do servidor volta o nome e diz por quê', async () => {
    svc.update.mockResolvedValueOnce(op('m1', 'Adiou a compra do imóvel', 0));
    abrir();
    const campo = await screen.findByRole('textbox', { name: 'Renomear Adiou a compra' });

    await userEvent.clear(campo);
    await userEvent.type(campo, 'Adiou a compra do imóvel');
    await userEvent.tab();
    expect(svc.update).toHaveBeenCalledWith('m1', { label: 'Adiou a compra do imóvel' });

    svc.update.mockRejectedValueOnce({ response: { data: { error: { message: 'Já existe uma opção com esse nome nesta lista.' } } } });
    const outro = screen.getByRole('textbox', { name: 'Renomear Desistiu' });
    await userEvent.clear(outro);
    await userEvent.type(outro, 'Adiou a compra do imóvel');
    await userEvent.tab();
    await waitFor(() => expect(toasts.error).toHaveBeenCalledWith('Já existe uma opção com esse nome nesta lista.'));
    expect(outro).toHaveValue('Desistiu');
  });

  it('Esc desiste da edição sem gravar', async () => {
    abrir();
    const campo = await screen.findByRole('textbox', { name: 'Renomear Desistiu' });
    await userEvent.type(campo, ' agora{Escape}');
    expect(campo).toHaveValue('Desistiu');
    expect(svc.update).not.toHaveBeenCalled();
  });

  it('arquivar pede confirmação; cancelar não grava, confirmar manda pras Arquivadas', async () => {
    svc.update.mockResolvedValueOnce(op('m2', 'Desistiu', 1, { active: false }));
    abrir();
    await screen.findByRole('list', { name: 'Motivos de perda' });

    await userEvent.click(screen.getByRole('button', { name: 'Arquivar Desistiu' }));
    let dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText('Arquivar opção')).toBeInTheDocument();
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    expect(svc.update).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Arquivar Desistiu' }));
    dialogo = await screen.findByRole('dialog');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Arquivar' }));

    await waitFor(() => expect(svc.update).toHaveBeenCalledWith('m2', { active: false }));
    await waitFor(() => expect(linhas()).toHaveLength(2));
    expect(within(screen.getByRole('region', { name: 'Arquivadas' })).getByText('Desistiu')).toBeInTheDocument();
  });

  it('desarquivar volta a opção pra lista', async () => {
    svc.update.mockResolvedValueOnce(op('m9', 'Velho motivo', 3));
    abrir();
    await screen.findByRole('list', { name: 'Motivos de perda' });

    await userEvent.click(screen.getByRole('button', { name: 'Desarquivar Velho motivo' }));

    expect(svc.update).toHaveBeenCalledWith('m9', { active: true });
    await waitFor(() => expect(linhas()).toHaveLength(4));
    expect(screen.queryByRole('region', { name: 'Arquivadas' })).not.toBeInTheDocument();
  });

  it('↓ muda a ordem e grava só as ativas, na ordem nova; erro volta como estava', async () => {
    svc.reorder.mockResolvedValueOnce([
      op('m2', 'Desistiu', 0), op('m1', 'Adiou a compra', 1), op('m3', 'Sem perfil ou sem crédito', 2, { meta_exclusion: true }),
      op('m9', 'Velho motivo', 3, { active: false }),
    ]);
    abrir();
    await screen.findByRole('list', { name: 'Motivos de perda' });

    await userEvent.click(screen.getByRole('button', { name: 'Descer Adiou a compra' }));

    expect(svc.reorder).toHaveBeenCalledWith('loss_reasons', ['m2', 'm1', 'm3']);
    await waitFor(() => expect(within(linhas()[0]).getByRole('textbox')).toHaveValue('Desistiu'));

    svc.reorder.mockRejectedValueOnce(new Error('Network Error'));
    await userEvent.click(screen.getByRole('button', { name: 'Descer Desistiu' }));
    await waitFor(() => expect(toasts.error).toHaveBeenCalledWith('Não deu pra mudar a ordem. Tente de novo.'));
    expect(within(linhas()[0]).getByRole('textbox')).toHaveValue('Desistiu');
  });

  it('a chave da Meta grava na hora, só nos motivos de perda', async () => {
    svc.update.mockResolvedValueOnce(op('m2', 'Desistiu', 1, { meta_exclusion: true }));
    abrir();

    const chave = await screen.findByRole('switch', { name: 'Avisar a Meta como lead ruim quando o motivo for Desistiu' });
    expect(screen.getByRole('switch', { name: 'Avisar a Meta como lead ruim quando o motivo for Sem perfil ou sem crédito' }))
      .toBeChecked();
    await userEvent.click(chave);
    expect(svc.update).toHaveBeenCalledWith('m2', { meta_exclusion: true });
  });

  it('Categorias escondida: ?aba=categorias cai nos motivos de perda', async () => {
    abrir('/settings/listas?aba=categorias');
    expect(await screen.findByRole('list', { name: 'Motivos de perda' })).toBeInTheDocument();
    expect(svc.list).not.toHaveBeenCalledWith('task_categories', expect.anything());
  });

  it('com a aba ligada: as duas abas, Motivos de perda escolhida', () => {
    chave.categorias = true;
    abrir();
    expect(screen.getByRole('tab', { name: 'Motivos de perda' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Categorias de tarefa' })).toHaveAttribute('aria-selected', 'false');
  });

  it('aba Categorias de tarefa (ligada): vai pro endereço, carrega a outra lista e não tem a chave da Meta', async () => {
    chave.categorias = true;
    abrir();
    await screen.findByRole('list', { name: 'Motivos de perda' });

    await userEvent.click(screen.getByRole('tab', { name: 'Categorias de tarefa' }));

    expect(screen.getByTestId('endereco')).toHaveTextContent('?aba=categorias');
    expect(await screen.findByRole('list', { name: 'Categorias de tarefa' })).toBeInTheDocument();
    expect(svc.list).toHaveBeenLastCalledWith('task_categories', { includeInactive: true });
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Nova categoria' })).toBeInTheDocument();
  });

  it('o endereço ?aba=categorias abre direto na aba (ligada)', async () => {
    chave.categorias = true;
    abrir('/settings/listas?aba=categorias');
    expect(await screen.findByRole('list', { name: 'Categorias de tarefa' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Categorias de tarefa' })).toHaveAttribute('aria-selected', 'true');
  });

  it('quem não é gestor só lê: sem editar, sem adicionar, sem arquivadas', async () => {
    perm.podeMudar = false;
    abrir();
    await screen.findByRole('list', { name: 'Motivos de perda' });

    expect(svc.list).toHaveBeenCalledWith('loss_reasons', { includeInactive: false });
    expect(screen.getByText(/Só o gestor muda esta lista\./)).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Arquivar|Subir|Descer|Arrastar/ })).not.toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Avisar a Meta como lead ruim quando o motivo for Desistiu' })).toBeDisabled();
  });
});
