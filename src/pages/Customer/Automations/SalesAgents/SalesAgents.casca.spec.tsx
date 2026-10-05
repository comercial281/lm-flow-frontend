import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

// A casca da IA Vendedora (entrega 1): qual IA e qual tela abrem pelo endereço.
// As telas são trocadas por marcadores — cada uma tem o próprio spec; aqui só
// importa QUAL abre e com QUAL IA.
const list = vi.hoisted(() => vi.fn());
const diagnostics = vi.hoisted(() => vi.fn());
vi.mock('@/services/salesAgents/salesAgentsService', () => ({
  salesAgentsService: { list, diagnostics, create: vi.fn(), update: vi.fn(), destroy: vi.fn() },
}));
vi.mock('@/services/channels/inboxesService', () => ({ default: { list: vi.fn().mockResolvedValue({ data: [] }) } }));
vi.mock('@/hooks/useCan', () => ({ useCan: () => () => true }));
vi.mock('@/hooks/useIsSuperAdmin', () => ({ useIsSuperAdmin: () => false }));
const insights = vi.hoisted(() => ({ ligado: true }));
vi.mock('@/contexts/TenantFeaturesContext', () => ({ useClientToggle: () => insights.ligado }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const marcador = vi.hoisted(() => (nome: string) => ({ default: ({ agent }: { agent?: { name: string } }) => <p>{`tela ${nome}${agent ? ` · ${agent.name}` : ''}`}</p> }));
vi.mock('./telas/TelaVisaoGeral', () => marcador('visao-geral'));
vi.mock('./telas/TelaSugestoes', () => marcador('sugestoes'));
vi.mock('./telas/TelaRelatorioSemanal', () => marcador('relatorio-semanal'));
vi.mock('./telas/TelaConfigurar', () => marcador('configurar'));
vi.mock('./telas/TelaEnsinar', () => marcador('ensinar'));
vi.mock('./telas/TelaTestar', () => marcador('testar'));
vi.mock('./telas/TelaDiagnostico', () => marcador('diagnostico'));
const duplicada = vi.hoisted(() => ({ copia: null as null | Record<string, unknown> }));
vi.mock('@/components/salesAgents/DuplicateAgentDialog', () => ({
  default: ({ onDuplicated }: { onDuplicated: (c: unknown) => void }) => (
    <button type="button" onClick={() => onDuplicated(duplicada.copia)}>confirmar cópia</button>
  ),
}));

import SalesAgents from './SalesAgents';

const ia = (id: string, name: string, extra: Record<string, unknown> = {}) =>
  ({ id, name, enabled: true, inbox_id: 'inbox-1', triggers: [], trigger_keyword: null, trigger_match_mode: 'any', updated_at: '2026-10-05', ...extra });

function Endereco() {
  return <output aria-label="endereço">{useLocation().search}</output>;
}

function abrir(endereco: string) {
  render(
    <MemoryRouter initialEntries={[endereco]}>
      <Routes>
        <Route path="/ia-vendedora" element={<><SalesAgents /><Endereco /></>} />
      </Routes>
    </MemoryRouter>,
  );
}

const endereco = () => screen.getByLabelText('endereço').textContent;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  insights.ligado = true;
  list.mockResolvedValue([ia('ia-1', 'IA da Cheer'), ia('ia-2', 'IA Demo', { inbox_id: null })]);
  diagnostics.mockResolvedValue({ status: 'ok', items: [] });
});

describe('IA Vendedora · casca', () => {
  it('sem nada no endereço, abre a primeira IA na Visão geral', async () => {
    abrir('/ia-vendedora');
    expect(await screen.findByText('tela visao-geral · IA da Cheer')).toBeInTheDocument();
    await waitFor(() => expect(endereco()).toBe('?ia=ia-1'));
  });

  it('abre a última IA usada neste navegador', async () => {
    localStorage.setItem('lmflow:ia-vendedora:ultima', 'ia-2');
    abrir('/ia-vendedora');
    expect(await screen.findByText('tela visao-geral · IA Demo')).toBeInTheDocument();
  });

  // O assistente (/ia-vendedora/:id/assistente) devolve com ?agent=<id>.
  it('o ?agent= do assistente abre aquela IA em Configurar e vira ?ia=&tela=', async () => {
    abrir('/ia-vendedora?agent=ia-2');
    expect(await screen.findByText('tela configurar · IA Demo')).toBeInTheDocument();
    await waitFor(() => expect(endereco()).toBe('?ia=ia-2&tela=configurar'));
  });

  it('o selo da barra mostra o veredito da IA aberta', async () => {
    abrir('/ia-vendedora?ia=ia-2');
    expect(await screen.findByText('Parada: falta o número')).toBeInTheDocument();
  });

  it('o selo usa o Diagnóstico: número apagado vira parada', async () => {
    diagnostics.mockResolvedValue({ status: 'error', items: [{ key: 'inbox', label: 'Canal de WhatsApp', status: 'error', detail: 'O canal vinculado não existe mais.' }] });
    abrir('/ia-vendedora?ia=ia-1');
    expect(await screen.findByText('Parada: o número desta IA não existe mais')).toBeInTheDocument();
  });

  it('Sugestões sem a chave cai na Visão geral', async () => {
    insights.ligado = false;
    abrir('/ia-vendedora?ia=ia-1&tela=sugestoes');
    expect(await screen.findByText('tela visao-geral · IA da Cheer')).toBeInTheDocument();
    await waitFor(() => expect(endereco()).toBe('?ia=ia-1'));
  });

  it('IA que não existe mais no endereço cai na primeira', async () => {
    abrir('/ia-vendedora?ia=excluida&tela=testar');
    expect(await screen.findByText('tela testar · IA da Cheer')).toBeInTheDocument();
  });

  it('o menu troca a tela mantendo a IA', async () => {
    abrir('/ia-vendedora?ia=ia-2');
    await screen.findByText('tela visao-geral · IA Demo');
    await userEvent.click(screen.getByRole('button', { name: 'Ensinar' }));
    expect(await screen.findByText('tela ensinar · IA Demo')).toBeInTheDocument();
    await waitFor(() => expect(endereco()).toBe('?ia=ia-2&tela=ensinar'));
  });

  it('Duplicar abre a cópia em Configurar, sem voltar pra IA original', async () => {
    duplicada.copia = ia('ia-3', 'IA da Cheer (cópia)', { enabled: false });
    list.mockResolvedValueOnce([ia('ia-1', 'IA da Cheer'), ia('ia-2', 'IA Demo', { inbox_id: null })])
      .mockResolvedValue([ia('ia-1', 'IA da Cheer'), ia('ia-2', 'IA Demo', { inbox_id: null }), duplicada.copia]);
    abrir('/ia-vendedora?ia=ia-1');
    await screen.findByText('tela visao-geral · IA da Cheer');
    await userEvent.click(screen.getByRole('button', { name: 'Mais ações' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /Duplicar esta IA/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'confirmar cópia' }));
    expect(await screen.findByText('tela configurar · IA da Cheer (cópia)')).toBeInTheDocument();
    await waitFor(() => expect(endereco()).toBe('?ia=ia-3&tela=configurar'));
  });

  it('sem IA nenhuma: aviso e o botão Nova IA', async () => {
    list.mockResolvedValue([]);
    abrir('/ia-vendedora');
    expect(await screen.findByText('Nenhuma IA Vendedora criada ainda.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nova IA' })).toBeInTheDocument();
  });

  it('recusa do servidor vira o aviso de acesso, não "nenhuma IA"', async () => {
    list.mockRejectedValue({ response: { status: 403 } });
    abrir('/ia-vendedora');
    await waitFor(() => expect(screen.queryByText('Nenhuma IA Vendedora criada ainda.')).toBeNull());
    expect(await screen.findByText(/acesso|permissão/i)).toBeInTheDocument();
  });
});
