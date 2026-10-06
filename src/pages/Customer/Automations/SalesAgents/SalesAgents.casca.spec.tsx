import { useState } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { limparPendentes, marcarPendente } from '@/hooks/useAlteracoesNaoSalvas';
import { esquecerSalvos } from './configurar/useGravarNaHora';

// A casca da IA Vendedora (entrega 1): qual IA e qual tela abrem pelo endereço.
// As telas são trocadas por marcadores — cada uma tem o próprio spec; aqui só
// importa QUAL abre e com QUAL IA.
const list = vi.hoisted(() => vi.fn());
const diagnostics = vi.hoisted(() => vi.fn());
const create = vi.hoisted(() => vi.fn());
const update = vi.hoisted(() => vi.fn());
vi.mock('@/services/salesAgents/salesAgentsService', () => ({
  salesAgentsService: { list, diagnostics, create, update, destroy: vi.fn() },
}));
vi.mock('@/services/channels/inboxesService', () => ({ default: { list: vi.fn().mockResolvedValue({ data: [] }) } }));
vi.mock('@/hooks/useCan', () => ({ useCan: () => () => true }));
const equipe = vi.hoisted(() => ({ sim: false }));
vi.mock('@/hooks/useIsSuperAdmin', () => ({ useIsSuperAdmin: () => equipe.sim }));
// `roteiro` = a chave `ia_playbook` do cliente (vê o Motor); `ligado` = `ia_insights`; o resto, desligado.
const insights = vi.hoisted(() => ({ ligado: true, roteiro: false }));
vi.mock('@/contexts/TenantFeaturesContext', () => ({
  useClientToggle: (chave: string) => (chave === 'ia_playbook' ? insights.roteiro : chave === 'ia_insights' ? insights.ligado : false),
}));
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
// O Ensinar do mock grava (`aoSalvo`) e relê a lista (`onCountChange`) quando o
// teste manda: é por ele que os testes de respostas fora de ordem entram na casca.
const ensinar = vi.hoisted(() => ({ salvo: null as null | Record<string, unknown> }));
vi.mock('./telas/TelaEnsinar', () => ({
  default: ({ agent, aoSalvo, onCountChange }: { agent: { name: string }; aoSalvo: (a: unknown) => void; onCountChange: () => void }) => (
    <div>
      <p>{`tela ensinar · ${agent.name}`}</p>
      <button type="button" onClick={() => aoSalvo(ensinar.salvo)}>simular salvo</button>
      <button type="button" onClick={() => onCountChange()}>recarregar lista</button>
    </div>
  ),
}));
// Testar guarda a conversa em estado próprio: o mock imita isso, pra provar que
// trocar de IA não leva a conversa da anterior junto.
vi.mock('./telas/TestarJanela', () => ({
  default: function TestarJanelaMock({ agent, aoFechar }: { agent: { name: string }; aoFechar: () => void }) {
    const [texto, setTexto] = useState('');
    return (
      <div role="dialog" aria-label="Testar a IA">
        <p>{`janela testar · ${agent.name}`}</p>
        <input aria-label="mensagem de teste" value={texto} onChange={(e) => setTexto(e.target.value)} />
        <button type="button" onClick={aoFechar}>Fechar</button>
      </div>
    );
  },
}));
vi.mock('./telas/TelaMotor', () => marcador('motor'));
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
  insights.roteiro = false;
  equipe.sim = false;
  // O "último salvo" é por módulo: sem limpar, a IA de um teste vazaria pro próximo.
  esquecerSalvos();
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
    abrir('/ia-vendedora?ia=excluida&tela=ensinar');
    expect(await screen.findByText('tela ensinar · IA de Vendas')).toBeInTheDocument();
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
  // Ruling F6: trocar de IA FECHA o Testar; reaberto, começa vazio.
  it('ao trocar de IA, o Testar fecha e, reaberto, começa vazio (sem a conversa da anterior)', async () => {
    abrir('/ia-vendedora?ia=ia-1');
    await screen.findByText('tela visao-geral · IA de Vendas');
    await userEvent.click(screen.getByRole('button', { name: 'Testar' }));
    await screen.findByText('janela testar · IA de Vendas');
    // `fireEvent.change`, não `userEvent.type`: com o foco no campo, a remontagem da
    // janela durante o fechamento do seletor (Radix) devolve o foco fora do act().
    fireEvent.change(screen.getByLabelText('mensagem de teste'), { target: { value: 'oi, tem 2 quartos?' } });
    expect(screen.getByLabelText('mensagem de teste')).toHaveValue('oi, tem 2 quartos?');
    await userEvent.click(screen.getByRole('button', { name: /IA de Vendas/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /IA Demo/ }));
    await screen.findByText('tela visao-geral · IA Demo');
    expect(screen.queryByText(/janela testar/)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Testar' }));
    await screen.findByText('janela testar · IA Demo');
    expect(screen.getByLabelText('mensagem de teste')).toHaveValue('');
  });

  it('?tela=testar sem IA nenhuma não deixa a janela armada pra IA criada depois', async () => {
    list.mockResolvedValue([]);
    create.mockResolvedValue(ia('ia-nova', 'Nova IA', { enabled: false, inbox_id: null }));
    abrir('/ia-vendedora?tela=testar');
    await userEvent.click(await screen.findByRole('button', { name: 'Nova IA' }));
    expect(await screen.findByText('tela configurar · Nova IA')).toBeInTheDocument();
    expect(screen.queryByText(/janela testar/)).toBeNull();
  });

  it('Testar abre a janela por cima da tela, e Fechar some com ela sem mudar o endereço', async () => {
    abrir('/ia-vendedora?ia=ia-1&tela=ensinar');
    await screen.findByText('tela ensinar · IA de Vendas');
    await userEvent.click(screen.getByRole('button', { name: 'Testar' }));
    expect(await screen.findByRole('dialog', { name: 'Testar a IA' })).toBeInTheDocument();
    expect(screen.getByText('tela ensinar · IA de Vendas')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByRole('dialog', { name: 'Testar a IA' })).toBeNull();
    expect(endereco()).toBe('?ia=ia-1&tela=ensinar');
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

  it('Nova IA cria o rascunho e abre o Configurar (na primeira página com pendência)', async () => {
    list.mockResolvedValue([]);
    create.mockResolvedValue(ia('ia-nova', 'Nova IA', { enabled: false, inbox_id: null }));
    abrir('/ia-vendedora');
    await userEvent.click(await screen.findByRole('button', { name: 'Nova IA' }));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ enabled: false, inbox_id: null, persona_kind: 'assistant', reach: 'qualify' }));
    await waitFor(() => expect(endereco()).toBe('?ia=ia-nova&tela=configurar'));
  });

  it('Nova IA pela barra, com outras IAs na conta, também abre o Configurar dela', async () => {
    create.mockResolvedValue(ia('ia-nova', 'Nova IA', { enabled: false, inbox_id: null }));
    abrir('/ia-vendedora?ia=ia-1');
    await screen.findByText('tela visao-geral · IA de Vendas');
    // "Nova IA" mora no seletor de IA (o botão com o nome da IA aberta).
    await userEvent.click(screen.getByRole('button', { name: /IA de Vendas/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /Nova IA/ }));
    await waitFor(() => expect(endereco()).toBe('?ia=ia-nova&tela=configurar'));
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

describe('endereços antigos e telas fora do menu (onda 3)', () => {
  it('?passo=3 vira a página Abertura do Configurar', async () => {
    list.mockResolvedValue([ia('ia-1', 'IA de Vendas')]);
    abrir('/ia-vendedora?ia=ia-1&tela=configurar&passo=3');
    await screen.findByText('tela configurar · IA de Vendas');
    await waitFor(() => expect(endereco()).toBe('?ia=ia-1&tela=configurar&pagina=abertura'));
  });

  it('?tela=testar abre a Visão geral com o Testar por cima', async () => {
    list.mockResolvedValue([ia('ia-1', 'IA de Vendas')]);
    abrir('/ia-vendedora?ia=ia-1&tela=testar');
    expect(await screen.findByText('janela testar · IA de Vendas')).toBeInTheDocument();
    expect(screen.getByText('tela visao-geral · IA de Vendas')).toBeInTheDocument();
    await waitFor(() => expect(endereco()).toBe('?ia=ia-1'));
  });

  it('?tela=diagnostico sem ser da equipe cai na Visão geral', async () => {
    list.mockResolvedValue([ia('ia-1', 'IA de Vendas')]);
    abrir('/ia-vendedora?ia=ia-1&tela=diagnostico');
    expect(await screen.findByText('tela visao-geral · IA de Vendas')).toBeInTheDocument();
    expect(screen.queryByText(/tela diagnostico/)).toBeNull();
  });

  it('a equipe abre o Diagnóstico pelo "⋯"', async () => {
    equipe.sim = true;
    list.mockResolvedValue([ia('ia-1', 'IA de Vendas')]);
    abrir('/ia-vendedora?ia=ia-1');
    await screen.findByText('tela visao-geral · IA de Vendas');
    await userEvent.click(screen.getByRole('button', { name: 'Mais ações' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /Diagnóstico/ }));
    expect(await screen.findByText('tela diagnostico · IA de Vendas')).toBeInTheDocument();
    await waitFor(() => expect(endereco()).toBe('?ia=ia-1&tela=diagnostico'));
  });

  it('?tela=motor sem ser da equipe e sem o roteiro liberado cai na Visão geral', async () => {
    list.mockResolvedValue([ia('ia-1', 'IA de Vendas')]);
    abrir('/ia-vendedora?ia=ia-1&tela=motor');
    expect(await screen.findByText('tela visao-geral · IA de Vendas')).toBeInTheDocument();
    expect(screen.queryByText(/tela motor/)).toBeNull();
  });

  it('cliente com o roteiro liberado (ia_playbook) abre o Motor', async () => {
    insights.roteiro = true;
    list.mockResolvedValue([ia('ia-1', 'IA de Vendas')]);
    abrir('/ia-vendedora?ia=ia-1&tela=motor');
    expect(await screen.findByText('tela motor · IA de Vendas')).toBeInTheDocument();
  });

  it('em Configurar não há o título duplo da casca', async () => {
    list.mockResolvedValue([ia('ia-1', 'IA de Vendas')]);
    abrir('/ia-vendedora?ia=ia-1&tela=configurar&pagina=canal');
    await screen.findByText('tela configurar · IA de Vendas');
    expect(screen.queryByRole('heading', { level: 1, name: 'Configurar' })).toBeNull();
  });
});

describe('chave Ligada da barra (onda 3)', () => {
  it('ligar grava enabled na hora e a IA salva vira a aberta', async () => {
    list.mockResolvedValue([ia('ia-1', 'IA de Vendas', { enabled: false })]);
    update.mockResolvedValue(ia('ia-1', 'IA de Vendas', { enabled: true, updated_at: '2026-10-06' }));
    abrir('/ia-vendedora?ia=ia-1');
    await screen.findByText('tela visao-geral · IA de Vendas');
    await userEvent.click(screen.getByRole('switch', { name: 'Ligar ou desligar a IA' }));
    expect(update).toHaveBeenCalledWith('ia-1', { enabled: true });
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Ligar ou desligar a IA' })).toBeChecked());
  });

  it('IA sem número: a chave trava e o clique abre a página Canal do Configurar', async () => {
    list.mockResolvedValue([ia('ia-1', 'IA de Vendas', { enabled: false, inbox_id: null })]);
    abrir('/ia-vendedora?ia=ia-1');
    await screen.findByText('tela visao-geral · IA de Vendas');
    expect(screen.getByRole('switch', { name: 'Ligar ou desligar a IA' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Não dá pra ligar: Falta o número de WhatsApp. Abrir Canal' }));
    await waitFor(() => expect(endereco()).toBe('?ia=ia-1&tela=configurar&pagina=canal'));
    expect(update).not.toHaveBeenCalled();
  });

  it('a recusa do servidor volta a chave e mostra o motivo escrito', async () => {
    const { toast } = await import('sonner');
    list.mockResolvedValue([ia('ia-1', 'IA de Vendas', { enabled: false })]);
    update.mockRejectedValue({ response: { status: 422, data: { error: { code: 'x', message: 'O número está desconectado.' } } } });
    abrir('/ia-vendedora?ia=ia-1');
    await screen.findByText('tela visao-geral · IA de Vendas');
    await userEvent.click(screen.getByRole('switch', { name: 'Ligar ou desligar a IA' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('O número está desconectado.'));
    expect(screen.getByRole('switch', { name: 'Ligar ou desligar a IA' })).not.toBeChecked();
  });
});

describe('respostas fora de ordem (último salvo da IA)', () => {
  const nome = () => screen.getByRole('button', { name: /^IA / }).textContent;

  it('a resposta mais velha da chave Ligada não desfaz a gravação mais nova de uma página', async () => {
    list.mockResolvedValue([ia('ia-1', 'IA de Vendas', { enabled: false })]);
    let soltarLigar: (v: unknown) => void = () => {};
    update.mockReturnValue(new Promise((res) => { soltarLigar = res; }));
    abrir('/ia-vendedora?ia=ia-1&tela=ensinar');
    await screen.findByText('tela ensinar · IA de Vendas');
    await userEvent.click(screen.getByRole('switch', { name: 'Ligar ou desligar a IA' }));
    // A página grava DEPOIS no servidor (resposta mais nova) e chega ANTES.
    ensinar.salvo = ia('ia-1', 'IA Renomeada', { enabled: true, updated_at: '2026-10-06T10:01:00Z' });
    await userEvent.click(screen.getByRole('button', { name: 'simular salvo' }));
    await screen.findByText('tela ensinar · IA Renomeada');
    soltarLigar(ia('ia-1', 'IA de Vendas', { enabled: true, updated_at: '2026-10-06T10:00:00Z' }));
    await waitFor(() => expect(update).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByText('tela ensinar · IA Renomeada')).toBeInTheDocument();
    expect(nome()).toContain('IA Renomeada');
  });

  // Revisão final da onda 3 (I2): o texto pendente da IA anterior grava no desmonte,
  // DEPOIS da troca. A resposta atualiza a lista, mas não traz a IA anterior de volta.
  it('gravação atrasada da IA anterior não volta a tela pra ela depois de trocar de IA', async () => {
    list.mockResolvedValue([ia('ia-1', 'IA de Vendas'), ia('ia-2', 'IA Demo')]);
    abrir('/ia-vendedora?ia=ia-1&tela=ensinar');
    await screen.findByText('tela ensinar · IA de Vendas');
    await userEvent.click(screen.getByRole('button', { name: /IA de Vendas/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /IA Demo/ }));
    await screen.findByText('tela ensinar · IA Demo');
    await userEvent.click(screen.getByRole('button', { name: 'Testar' }));
    fireEvent.change(await screen.findByLabelText('mensagem de teste'), { target: { value: 'oi' } });
    ensinar.salvo = ia('ia-1', 'IA de Vendas Renomeada', { updated_at: '2026-10-06T10:01:00Z' });
    fireEvent.click(screen.getByRole('button', { name: 'simular salvo' }));
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByText('tela ensinar · IA Demo')).toBeInTheDocument();
    // Nem uma piscada na IA anterior: o Testar aberto nesta IA continua aberto, com o texto.
    expect(screen.getByLabelText('mensagem de teste')).toHaveValue('oi');
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(endereco()).toContain('ia=ia-2');
    expect(nome()).toContain('IA Demo');
    // A lista do seletor recebeu a IA anterior salva.
    await userEvent.click(screen.getByRole('button', { name: /IA Demo/ }));
    expect(await screen.findByRole('menuitem', { name: /IA de Vendas Renomeada/ })).toBeInTheDocument();
  });

  it('reler a lista não troca a IA aberta por uma cópia mais velha que a última salva', async () => {
    list.mockResolvedValueOnce([ia('ia-1', 'IA de Vendas')])
      .mockResolvedValueOnce([ia('ia-1', 'IA de Vendas')]);
    abrir('/ia-vendedora?ia=ia-1&tela=ensinar');
    await screen.findByText('tela ensinar · IA de Vendas');
    ensinar.salvo = ia('ia-1', 'IA Renomeada', { updated_at: '2026-10-06T10:01:00Z' });
    await userEvent.click(screen.getByRole('button', { name: 'simular salvo' }));
    await screen.findByText('tela ensinar · IA Renomeada');
    await userEvent.click(screen.getByRole('button', { name: 'recarregar lista' }));
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    await new Promise((r) => setTimeout(r, 0));
    expect(await screen.findByText('tela ensinar · IA Renomeada')).toBeInTheDocument();
    expect(nome()).toContain('IA Renomeada');
  });
});
