import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Mensagens prontas (12/10/2026, modelo Zap Voice; antes "Disparar funil" da
// sprint 4): os funis de conversa separados por tipo, Ver (prévia no próprio
// item) e Enviar na linha. Aqui, a JANELA do campo (celular e card do lead).

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
import { MensagensProntas } from './MensagensProntas';

const no = (id: string, kind: string, config: Record<string, unknown>, next: string | null = null) => ({
  id, kind, label: null, config, next_node_id: next, next_yes_node_id: null, next_no_node_id: null, pos_x: null, pos_y: null, steps: [],
});

const sequencia = [
  no('m1', 'send_whatsapp', { text: 'Oi {{nome}}, tudo bem?' }, 'w1'),
  no('w1', 'wait', { mode: 'interval', minutes: 0, seconds: 10 }, 'm2'),
  no('m2', 'send_whatsapp', { text: 'Você ainda procura imóvel?' }),
];

const funnel = (id: string, name: string, patch: Record<string, unknown> = {}) => ({
  id, name, kind: 'conversation', is_enabled: true, archived_at: null, team: false, guide_pending: [], ...patch,
});
const comBlocos = (id: string, name: string, nodes: ReturnType<typeof no>[], patch: Record<string, unknown> = {}) =>
  funnel(id, name, { initial_node_id: nodes[0].id, nodes, ...patch });

const renderPanel = () => {
  const onClose = vi.fn();
  const onStarted = vi.fn();
  render(
    <MemoryRouter initialEntries={['/conversations/7']}>
      <Routes>
        <Route
          path="/conversations/:id"
          element={<DispararFunilPanel isOpen onClose={onClose} conversationId={7} onStarted={onStarted} />}
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

describe('Mensagens prontas (janela)', () => {
  it('pede a lista com os blocos e separa por tipo', async () => {
    list.mockResolvedValue([
      comBlocos('t', 'Link do book', [no('a', 'send_whatsapp', { text: 'Segue o book' })]),
      comBlocos('a', 'É confiável?', [no('a', 'send_whatsapp', { media_kind: 'audio' })]),
      comBlocos('i', 'Fachada', [no('a', 'send_whatsapp', { media_kind: 'image' })]),
      comBlocos('f', 'Reaquecer lead', sequencia),
    ]);
    renderPanel();
    expect(await screen.findByText('Link do book')).toBeTruthy();
    expect(list).toHaveBeenCalledWith({ kind: 'conversation', withNodes: true });
    const nomes = (rotulo: string) =>
      within(screen.getByRole('region', { name: rotulo })).getAllByRole('listitem').map(li => li.querySelector('p')?.textContent);
    expect(nomes('Mensagens')).toEqual(['Link do book']);
    expect(nomes('Áudios')).toEqual(['É confiável?']);
    expect(nomes('Mídias')).toEqual(['Fachada']);
    expect(nomes('Funis')).toEqual(['Reaquecer lead']);
    expect(screen.getByText('2 mensagens · 10 segundos')).toBeTruthy();

    fireEvent.click(screen.getByRole('radio', { name: 'Áudios' }));
    expect(screen.queryByText('Link do book')).toBeNull();
    expect(screen.getByText('É confiável?')).toBeTruthy();
  });

  it('busca pelo nome; sem resultado, Limpar filtros volta tudo', async () => {
    list.mockResolvedValue([comBlocos('f1', 'Reaquecer lead parado', sequencia), comBlocos('f2', 'Pós-visita', sequencia)]);
    renderPanel();
    await screen.findByText('Reaquecer lead parado');
    fireEvent.change(screen.getByLabelText('Buscar mensagem pronta'), { target: { value: 'pós' } });
    expect(screen.queryByText('Reaquecer lead parado')).toBeNull();
    expect(screen.getByText('Pós-visita')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Buscar mensagem pronta'), { target: { value: 'nada' } });
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(screen.getByText('Reaquecer lead parado')).toBeTruthy();
  });

  it('Ver abre a prévia no próprio item, sem pedir o funil de novo', async () => {
    list.mockResolvedValue([comBlocos('f1', 'Reaquecer lead parado', sequencia)]);
    renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: 'Ver "Reaquecer lead parado"' }));
    const linhas = within(screen.getByRole('list', { name: 'Sequência do funil' })).getAllByRole('listitem').map(li => li.textContent);
    expect(linhas).toEqual(['Oi {{nome}}, tudo bem?', 'Espera 10 segundos', 'Você ainda procura imóvel?']);
    expect(get).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Esconder "Reaquecer lead parado"' }));
    expect(screen.queryByRole('list', { name: 'Sequência do funil' })).toBeNull();
  });

  it('lista sem os blocos (servidor antigo): é funil e o Ver busca a sequência', async () => {
    list.mockResolvedValue([funnel('f1', 'Reaquecer lead parado', { message_count: 2 })]);
    get.mockResolvedValue({ ...funnel('f1', 'Reaquecer lead parado'), initial_node_id: 'm1', nodes: sequencia });
    renderPanel();
    expect(await screen.findByText('2 mensagens')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ver "Reaquecer lead parado"' }));
    await waitFor(() => expect(get).toHaveBeenCalledWith('f1'));
    expect(await screen.findByRole('list', { name: 'Sequência do funil' })).toBeTruthy();
  });

  it('Enviar na linha inicia no servidor com a conversa, avisa a faixa e fecha a janela', async () => {
    list.mockResolvedValue([comBlocos('f1', 'Reaquecer lead parado', sequencia)]);
    start.mockResolvedValue({ started: true, message: '"Reaquecer lead parado" iniciado para este lead.' });
    const { onClose, onStarted } = renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: 'Enviar "Reaquecer lead parado"' }));
    await waitFor(() => expect(start).toHaveBeenCalledWith({ conversationId: '7' }, 'f1'));
    expect(toast.success).toHaveBeenCalledWith('"Reaquecer lead parado" iniciado para este lead.');
    expect(onStarted).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('lead que já está no funil: aviso, não erro', async () => {
    list.mockResolvedValue([comBlocos('f1', 'Reaquecer lead parado', sequencia)]);
    start.mockResolvedValue({ started: false, message: 'Este lead já está em "Reaquecer lead parado".' });
    renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: 'Enviar "Reaquecer lead parado"' }));
    await waitFor(() => expect(toast.info).toHaveBeenCalledWith('Este lead já está em "Reaquecer lead parado".'));
  });

  it('a recusa do servidor aparece como veio', async () => {
    list.mockResolvedValue([comBlocos('f1', 'Reaquecer lead parado', sequencia)]);
    start.mockRejectedValue({ response: { status: 422, data: { errors: ['Não deu pra iniciar "Reaquecer lead parado": o fluxo está desligado ou arquivado.'] } } });
    renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: 'Enviar "Reaquecer lead parado"' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
      'Não deu pra iniciar "Reaquecer lead parado": o fluxo está desligado ou arquivado.',
    ));
  });

  it('passo a passo pela metade: "Termine de montar" leva pro canvas e não tem Enviar', async () => {
    list.mockResolvedValue([
      funnel('f1', 'Apresentação do imóvel', { is_enabled: false, guide_pending: [{ node_id: 'n', step: 2, total: 3, title: 'x' }] }),
    ]);
    renderPanel();
    const termine = await screen.findByRole('button', { name: 'Termine de montar' });
    expect(screen.queryByRole('button', { name: /Enviar/ })).toBeNull();
    fireEvent.click(termine);
    expect(await screen.findByText('canvas do funil')).toBeTruthy();
  });

  it('desligado aparece apagado e sem Enviar', async () => {
    list.mockResolvedValue([comBlocos('f1', 'Antigo', sequencia, { is_enabled: false })]);
    renderPanel();
    expect(await screen.findByText('Desligado: ligue em Funis de mensagem')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Enviar/ })).toBeNull();
  });

  it('com meus e da equipe, filtra por dono', async () => {
    list.mockResolvedValue([
      comBlocos('f1', 'Meu funil', sequencia),
      comBlocos('f3', 'Pedir documentos', sequencia, { team: true, owner_name: 'Gestor' }),
    ]);
    renderPanel();
    await screen.findByText('Meu funil');
    fireEvent.click(screen.getByRole('radio', { name: 'Da equipe' }));
    expect(screen.queryByText('Meu funil')).toBeNull();
    expect(screen.getByText('Pedir documentos')).toBeTruthy();
  });

  it('sem nenhuma, leva pra Funis de mensagem', async () => {
    list.mockResolvedValue([]);
    renderPanel();
    expect(await screen.findByText('Nenhuma mensagem pronta ainda')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Abrir Funis de mensagem' })).toBeTruthy();
  });

  it('falha ao carregar mostra o erro com Tentar de novo', async () => {
    list.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce([comBlocos('f1', 'Voltou', sequencia)]);
    renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Voltou')).toBeTruthy();
  });
});

describe('Mensagens prontas (lateral)', () => {
  const renderLateral = (props: Partial<Parameters<typeof MensagensProntas>[0]> = {}) => {
    const aoFechar = vi.fn();
    const onStarted = vi.fn();
    const utils = render(
      <MemoryRouter>
        <MensagensProntas ativo onde="lateral" conversationId={7} aoFechar={aoFechar} aoVoltar={vi.fn()} onStarted={onStarted} {...props} />
        <button type="button">fora do painel</button>
      </MemoryRouter>,
    );
    return { aoFechar, onStarted, ...utils };
  };

  it('enviar não fecha a lateral (dá pra mandar outra em seguida)', async () => {
    list.mockResolvedValue([comBlocos('f1', 'Link do book', [no('a', 'send_whatsapp', { text: 'Segue o book' })])]);
    start.mockResolvedValue({ started: true, message: 'ok' });
    const { aoFechar, onStarted } = renderLateral();
    fireEvent.click(await screen.findByRole('button', { name: 'Enviar "Link do book"' }));
    await waitFor(() => expect(onStarted).toHaveBeenCalled());
    expect(aoFechar).not.toHaveBeenCalled();
  });

  it('Esc só fecha com o cursor dentro do painel; Esc já tratado por outra janela é ignorado', async () => {
    list.mockResolvedValue([comBlocos('f1', 'Link do book', [no('a', 'send_whatsapp', { text: 'Segue o book' })])]);
    const { aoFechar } = renderLateral();
    await screen.findByText('Link do book');
    const busca = screen.getByLabelText('Buscar mensagem pronta');
    expect(document.activeElement).toBe(busca); // abre com o cursor na busca

    screen.getByRole('button', { name: 'fora do painel' }).focus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(aoFechar).not.toHaveBeenCalled();

    busca.focus();
    const tratado = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true, bubbles: true });
    tratado.preventDefault();
    document.dispatchEvent(tratado);
    expect(aoFechar).not.toHaveBeenCalled();

    fireEvent.keyDown(busca, { key: 'Escape' });
    expect(aoFechar).toHaveBeenCalled();
  });

  it('conversa travada: aviso e Enviar desligado', async () => {
    list.mockResolvedValue([comBlocos('f1', 'Link do book', [no('a', 'send_whatsapp', { text: 'Segue o book' })])]);
    renderLateral({ bloqueado: true });
    const enviar = await screen.findByRole('button', { name: 'Enviar "Link do book"' });
    expect(enviar.hasAttribute('disabled')).toBe(true);
    expect(screen.getByText(/Nesta conversa não dá pra enviar agora/)).toBeTruthy();
  });

  it('envio que volta depois da troca de conversa não fala "este lead" do lead novo', async () => {
    list.mockResolvedValue([comBlocos('f1', 'Link do book', [no('a', 'send_whatsapp', { text: 'Segue o book' })])]);
    let responder: (v: unknown) => void = () => {};
    start.mockReturnValue(new Promise(r => { responder = r; }));
    const { rerender, onStarted } = renderLateral();
    fireEvent.click(await screen.findByRole('button', { name: 'Enviar "Link do book"' }));
    rerender(
      <MemoryRouter>
        <MensagensProntas ativo onde="lateral" conversationId={8} aoFechar={vi.fn()} aoVoltar={vi.fn()} onStarted={onStarted} />
        <button type="button">fora do painel</button>
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: 'Enviar "Link do book"' }).hasAttribute('disabled')).toBe(false);
    responder({ started: true, message: '"Link do book" iniciado para este lead.' });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('"Link do book" enviado pro lead da conversa anterior.'));
    expect(start).toHaveBeenCalledWith({ conversationId: '7' }, 'f1');
    expect(onStarted).not.toHaveBeenCalled();
  });
});
