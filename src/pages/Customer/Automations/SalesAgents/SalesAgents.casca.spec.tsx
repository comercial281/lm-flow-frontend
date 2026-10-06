import { useState } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { limparPendentes, marcarPendente } from '@/hooks/useAlteracoesNaoSalvas';

// A casca da IA Vendedora (entrega 1): qual IA e qual tela abrem pelo endereço.
// As telas são trocadas por marcadores — cada uma tem o próprio spec; aqui só
// importa QUAL abre e com QUAL IA.
const list = vi.hoisted(() => vi.fn());
const diagnostics = vi.hoisted(() => vi.fn());
const create = vi.hoisted(() => vi.fn());
vi.mock('@/services/salesAgents/salesAgentsService', () => ({
  salesAgentsService: { list, diagnostics, create, update: vi.fn(), destroy: vi.fn() },
}));
vi.mock('@/services/channels/inboxesService', () => ({ default: { list: vi.fn().mockResolvedValue({ data: [] }) } }));
vi.mock('@/hooks/useCan', () => ({ useCan: () => () => true }));
vi.mock('@/hooks/useIsSuperAdmin', () => ({ useIsSuperAdmin: () => false }));
const insights = vi.hoisted(() => ({ ligado: true }));
vi.mock('@/contexts/TenantFeaturesContext', () => ({ useClientToggle: (k: string) => (k === 'ia_insights' ? insights.ligado : false) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const marcador = vi.hoisted(() => (nome: string) => ({ default: ({ agent }: { agent?: { name: string } }) => <p>{`tela ${nome}${agent ? ` · ${agent.name}` : ''}`}</p> }));
// A Visão geral expõe o que a casca lhe passa sobre o Diagnóstico (o texto de
// verdade é testado no spec da própria tela).
vi.mock('./telas/TelaVisaoGeral', () => ({
  default: ({ agent, falhou }: { agent: { name: string }; falhou?: boolean }) => (
    <div><p>{`tela visao-geral · ${agent.name}`}</p>{falhou && <p>diagnóstico falhou</p>}</div>
  ),
}));
vi.mock('./telas/TelaSugestoes', () => marcador('sugestoes'));
vi.mock('./telas/TelaRelatorioSemanal', () => marcador('relatorio-semanal'));
vi.mock('./telas/TelaConfigurar', () => marcador('configurar'));
vi.mock('./telas/TelaEnsinar', () => marcador('ensinar'));
// Testar guarda a conversa em estado próprio: o mock imita isso, pra provar que
// trocar de IA não leva a conversa da anterior junto.
vi.mock('./telas/TelaTestar', () => ({
  default: function TelaTestarMock({ agent }: { agent: { name: string } }) {
    const [texto, setTexto] = useState('');
    return (
      <div>
        <p>{`tela testar · ${agent.name}`}</p>
        <input aria-label="mensagem de teste" value={texto} onChange={(e) => setTexto(e.target.value)} />
      </div>
    );
  },
}));
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
  list.mockResolvedValue([ia('ia-1', 'IA de Vendas'), ia('ia-2', 'IA Demo', { inbox_id: null })]);
  diagnostics.mockResolvedValue({ status: 'ok', items: [] });
});

describe('IA Vendedora · casca', () => {
  it('sem nada no endereço, abre a primeira IA na Visão geral', async () => {
    abrir('/ia-vendedora');
    expect(await screen.findByText('tela visao-geral · IA de Vendas')).toBeInTheDocument();
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
    expect(await screen.findByText('tela visao-geral · IA de Vendas')).toBeInTheDocument();
    await waitFor(() => expect(endereco()).toBe('?ia=ia-1'));
  });

  it('IA que não existe mais no endereço cai na primeira', async () => {
    abrir('/ia-vendedora?ia=excluida&tela=testar');
    expect(await screen.findByText('tela testar · IA de Vendas')).toBeInTheDocument();
  });

  it('o menu troca a tela mantendo a IA', async () => {
    abrir('/ia-vendedora?ia=ia-2');
    await screen.findByText('tela visao-geral · IA Demo');
    await userEvent.click(screen.getByRole('button', { name: 'Ensinar' }));
    expect(await screen.findByText('tela ensinar · IA Demo')).toBeInTheDocument();
    await waitFor(() => expect(endereco()).toBe('?ia=ia-2&tela=ensinar'));
  });

  it('Duplicar abre a cópia em Configurar, sem voltar pra IA original', async () => {
    duplicada.copia = ia('ia-3', 'IA de Vendas (cópia)', { enabled: false });
    // A recarga da lista fica pendente: a cópia já tem de ser a IA aberta.
    let soltar: (v: unknown) => void = () => {};
    list.mockResolvedValueOnce([ia('ia-1', 'IA de Vendas'), ia('ia-2', 'IA Demo', { inbox_id: null })])
      .mockReturnValueOnce(new Promise((res) => { soltar = res; }))
      .mockResolvedValue([ia('ia-1', 'IA de Vendas'), ia('ia-2', 'IA Demo', { inbox_id: null }), duplicada.copia]);
    abrir('/ia-vendedora?ia=ia-1');
    await screen.findByText('tela visao-geral · IA de Vendas');
    await userEvent.click(screen.getByRole('button', { name: 'Mais ações' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /Duplicar esta IA/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'confirmar cópia' }));
    expect(await screen.findByText('tela configurar · IA de Vendas (cópia)')).toBeInTheDocument();
    soltar([ia('ia-1', 'IA de Vendas'), ia('ia-2', 'IA Demo', { inbox_id: null }), duplicada.copia]);
    await waitFor(() => expect(endereco()).toBe('?ia=ia-3&tela=configurar'));
  });

  it('ao trocar de IA, o selo não herda o veredito da anterior enquanto o Diagnóstico novo não chega', async () => {
    const erro = { status: 'error', items: [{ key: 'inbox', label: 'Canal de WhatsApp', status: 'error', detail: 'O canal vinculado não existe mais.' }] };
    // IA B com número: a configuração sozinha não a deixa parada.
    list.mockResolvedValue([ia('ia-1', 'IA de Vendas'), ia('ia-2', 'IA Demo')]);
    let soltar: (v: unknown) => void = () => {};
    diagnostics.mockResolvedValueOnce(erro).mockReturnValueOnce(new Promise((res) => { soltar = res; }));
    abrir('/ia-vendedora?ia=ia-1');
    expect(await screen.findByText('Parada: o número desta IA não existe mais')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /IA de Vendas/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /IA Demo/ }));
    await screen.findByText('tela visao-geral · IA Demo');
    expect(screen.queryByText('Parada: o número desta IA não existe mais')).toBeNull();
    soltar({ status: 'ok', items: [] });
  });

  // Trocar de IA remonta a tela: a conversa do Testar (e os números/sugestões)
  // da IA anterior nunca aparecem na nova.
  it('ao trocar de IA, o Testar começa vazio (sem a conversa da anterior)', async () => {
    abrir('/ia-vendedora?ia=ia-1&tela=testar');
    await screen.findByText('tela testar · IA de Vendas');
    await userEvent.type(screen.getByLabelText('mensagem de teste'), 'oi, tem 2 quartos?');
    expect(screen.getByLabelText('mensagem de teste')).toHaveValue('oi, tem 2 quartos?');
    await userEvent.click(screen.getByRole('button', { name: /IA de Vendas/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /IA Demo/ }));
    await screen.findByText('tela testar · IA Demo');
    expect(screen.getByLabelText('mensagem de teste')).toHaveValue('');
  });

  it('Diagnóstico que falha: a Visão geral não diz "Nada pendente"', async () => {
    diagnostics.mockRejectedValue({ response: { status: 502 } });
    abrir('/ia-vendedora?ia=ia-1');
    await screen.findByText('tela visao-geral · IA de Vendas');
    await waitFor(() => expect(diagnostics).toHaveBeenCalled());
    expect(await screen.findByText('diagnóstico falhou')).toBeInTheDocument();
  });

  it('a falha do Diagnóstico de uma IA não vale pra outra, e some quando o Diagnóstico volta', async () => {
    list.mockResolvedValue([ia('ia-1', 'IA de Vendas'), ia('ia-2', 'IA Demo')]);
    diagnostics.mockRejectedValueOnce({ response: { status: 502 } }).mockResolvedValue({ status: 'ok', items: [] });
    abrir('/ia-vendedora?ia=ia-1');
    expect(await screen.findByText('diagnóstico falhou')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /IA de Vendas/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /IA Demo/ }));
    await screen.findByText('tela visao-geral · IA Demo');
    await waitFor(() => expect(screen.queryByText('diagnóstico falhou')).toBeNull());
  });

  it('sem IA nenhuma: aviso e o botão Nova IA', async () => {
    list.mockResolvedValue([]);
    abrir('/ia-vendedora');
    expect(await screen.findByText('Nenhuma IA Vendedora criada ainda.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nova IA' })).toBeInTheDocument();
  });

  it('Nova IA cria o rascunho e abre o passo 1 do Configurar', async () => {
    list.mockResolvedValue([]);
    create.mockResolvedValue(ia('ia-nova', 'Nova IA', { enabled: false, inbox_id: null }));
    abrir('/ia-vendedora');
    await userEvent.click(await screen.findByRole('button', { name: 'Nova IA' }));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ enabled: false, inbox_id: null, persona_kind: 'assistant', reach: 'qualify' }));
    await waitFor(() => expect(endereco()).toBe('?ia=ia-nova&tela=configurar&passo=1'));
  });

  it('Nova IA pela barra, com outras IAs na conta, também abre o passo 1 dela', async () => {
    create.mockResolvedValue(ia('ia-nova', 'Nova IA', { enabled: false, inbox_id: null }));
    abrir('/ia-vendedora?ia=ia-1');
    await screen.findByText('tela visao-geral · IA de Vendas');
    // "Nova IA" mora no seletor de IA (o botão com o nome da IA aberta).
    await userEvent.click(screen.getByRole('button', { name: /IA de Vendas/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /Nova IA/ }));
    await waitFor(() => expect(endereco()).toBe('?ia=ia-nova&tela=configurar&passo=1'));
    expect(await screen.findByText('tela configurar · Nova IA')).toBeInTheDocument();
  });

  it('com um passo pela metade, trocar de IA pergunta antes e não troca sem o ok', async () => {
    abrir('/ia-vendedora?ia=ia-1');
    await screen.findByText('tela visao-geral · IA de Vendas');
    marcarPendente('passo-em-edicao', true);
    await userEvent.click(screen.getByRole('button', { name: /IA de Vendas/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /IA Demo/ }));
    expect(await screen.findByText('Sair sem salvar?')).toBeInTheDocument();
    expect(endereco()).toBe('?ia=ia-1');
    limparPendentes();
  });

  it('recusa do servidor vira o aviso de acesso, não "nenhuma IA"', async () => {
    list.mockRejectedValue({ response: { status: 403 } });
    abrir('/ia-vendedora');
    await waitFor(() => expect(screen.queryByText('Nenhuma IA Vendedora criada ainda.')).toBeNull());
    expect(await screen.findByText(/acesso|permissão/i)).toBeInTheDocument();
  });
});
