import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const svc = vi.hoisted(() => ({
  list: vi.fn(),
  unreadCount: vi.fn(),
  show: vi.fn(),
  open: vi.fn(),
  reply: vi.fn(),
}));
vi.mock('@/services/support/supportService', async orig => ({
  ...(await orig<typeof import('@/services/support/supportService')>()),
  supportService: svc,
}));

import SupportWidget from './SupportWidget';
import { openSupport } from './openSupport';
import { useAuthStore } from '@/store/authStore';

const detalhe = {
  id: 't1', kind: 'question', status: 'open', subject: 'O lead não chegou pra mim', faq_topic: 'lead-nao-chegou',
  page_url: '/dashboard', last_message_at: '2026-10-04T10:00:00Z', created_at: '2026-10-04T10:00:00Z', unread: false,
  messages: [{ id: 'm1', author_side: 'customer', author_name: 'Tony', body: 'Socorro', created_at: '2026-10-04T10:00:00Z', images: [] }],
};

function montar(caminho = '/dashboard') {
  return render(
    <MemoryRouter initialEntries={[caminho]}>
      <SupportWidget />
    </MemoryRouter>,
  );
}

describe('SupportWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ currentUser: { id: 'u1', name: 'Tony Marques', email: 't@x.test' } } as never);
    svc.unreadCount.mockResolvedValue(0);
    svc.list.mockResolvedValue([]);
    svc.show.mockResolvedValue(detalhe);
    svc.open.mockResolvedValue(detalhe);
  });

  it('abre o card com a saudação pelo primeiro nome', async () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir ajuda e suporte' }));
    expect(await screen.findByText('Olá, Tony 👋')).toBeInTheDocument();
    expect(screen.getByText('Como podemos ajudar?')).toBeInTheDocument();
  });

  it('contador mostra chamados com resposta não lida', async () => {
    svc.unreadCount.mockResolvedValue(2);
    montar();
    expect(await screen.findByText('2')).toBeInTheDocument();
    // O nome acessível da bolinha leva a contagem (o número visual é aria-hidden).
    expect(screen.getByRole('button', { name: /Abrir ajuda e suporte, 2 com resposta nova/ })).toBeInTheDocument();
  });

  it('a bolinha some em Conversas, mas o menu do avatar ainda abre o card', async () => {
    montar('/conversations/123');
    expect(screen.queryByRole('button', { name: 'Abrir ajuda e suporte' })).toBeNull();
    act(() => openSupport());
    expect(await screen.findByText('Como podemos ajudar?')).toBeInTheDocument();
  });

  it('em /conversations-old a bolinha continua', () => {
    montar('/conversations-old');
    expect(screen.getByRole('button', { name: 'Abrir ajuda e suporte' })).toBeInTheDocument();
  });

  it('roteiro → "Não, falar com o time" abre chamado com a pergunta como assunto', async () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir ajuda e suporte' }));
    fireEvent.click(await screen.findByRole('button', { name: 'O lead não chegou pra mim' }));
    fireEvent.click(screen.getByRole('button', { name: 'Não recebi aviso nenhum' }));
    fireEvent.click(screen.getByRole('button', { name: 'Não, falar com o time' }));
    expect(screen.getByText('Me conta sua dúvida que o time responde por aqui.')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Socorro' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    await waitFor(() =>
      expect(svc.open).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'question', body: 'Socorro', subject: 'O lead não chegou pra mim', faqTopic: 'lead-nao-chegou', pageUrl: '/dashboard' }),
      ),
    );
    expect(await screen.findByText('Recebemos! O time responde por aqui e você também recebe por e-mail.')).toBeInTheDocument();
  });

  it('busca sem resultado oferece falar com o time com o texto digitado', async () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir ajuda e suporte' }));
    fireEvent.change(await screen.findByPlaceholderText('Qual é a sua dúvida?'), { target: { value: 'boleto atrasado' } });
    expect(screen.getByText('Não achei essa dúvida. Quer falar com o time?')).toBeInTheDocument();
    // Há dois "Falar com o time": o do topo e o da busca sem resultado (o último).
    fireEvent.click(screen.getAllByRole('button', { name: 'Falar com o time' }).at(-1)!);
    expect(screen.getByRole('textbox')).toHaveValue('boleto atrasado');
  });

  it('Reportar um bug abre o chamado de Bug', async () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir ajuda e suporte' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Reportar um bug' }));
    expect(screen.getByText('Me conta o que aconteceu e em qual tela. Se puder, manda um print.')).toBeInTheDocument();
  });

  it('Mensagens vazio convida a falar com o time', async () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir ajuda e suporte' }));
    fireEvent.click(await screen.findByRole('tab', { name: /Mensagens/ }));
    expect(await screen.findByText('Você ainda não abriu nenhum chamado.')).toBeInTheDocument();
  });

  it('erro ao listar aparece como erro, não como lista vazia', async () => {
    svc.list.mockRejectedValue({ response: { data: { error: 'fora do ar' } } });
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir ajuda e suporte' }));
    fireEvent.click(await screen.findByRole('tab', { name: /Mensagens/ }));
    expect(await screen.findByText('fora do ar')).toBeInTheDocument();
    expect(screen.queryByText('Você ainda não abriu nenhum chamado.')).toBeNull();
  });

  it('?suporte=<id> abre o card direto no chamado', async () => {
    montar('/dashboard?suporte=t1');
    expect(await screen.findByText('Socorro')).toBeInTheDocument();
    expect(svc.show).toHaveBeenCalledWith('t1');
  });

  it('chamado resolvido mostra a faixa e deixa escrever de novo', async () => {
    svc.show.mockResolvedValue({ ...detalhe, status: 'resolved' });
    montar('/dashboard?suporte=t1');
    expect(await screen.findByText('Este chamado foi resolvido.')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('Esc fecha o card', async () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir ajuda e suporte' }));
    const card = await screen.findByRole('dialog', { name: 'Ajuda e suporte' });
    fireEvent.keyDown(card, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('fechar e reabrir mantém o texto digitado e tira o card da árvore de acessibilidade', async () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir ajuda e suporte' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Reportar um bug' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'rascunho' } });
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir ajuda e suporte' }));
    expect(await screen.findByRole('dialog', { name: 'Ajuda e suporte' })).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('rascunho');
  });

  it('"Recebemos!" não volta depois de fechar e reabrir', async () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir ajuda e suporte' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Reportar um bug' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Socorro' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(await screen.findByText(/Recebemos!/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Abrir ajuda e suporte' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByText(/Recebemos!/)).toBeNull();
  });

  it('ao fechar, o foco volta pra quem o tinha ao abrir', async () => {
    montar('/conversations/1');
    const antes = document.createElement('button');
    document.body.appendChild(antes);
    antes.focus();
    act(() => openSupport());
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(document.activeElement).toBe(antes);
    antes.remove();
  });

  it('Esc no document fecha o card (o menu do avatar devolve o foco ao avatar)', async () => {
    montar('/conversations/1');
    const avatar = document.createElement('button');
    document.body.appendChild(avatar);
    act(() => openSupport());
    await screen.findByRole('dialog');
    avatar.focus();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    avatar.remove();
  });

  it('reabrir o card recarrega a lista de Mensagens', async () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: /Abrir ajuda e suporte/ }));
    fireEvent.click(await screen.findByRole('tab', { name: /Mensagens/ }));
    await screen.findByText('Você ainda não abriu nenhum chamado.');
    expect(svc.list).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    fireEvent.click(screen.getByRole('button', { name: /Abrir ajuda e suporte/ }));
    await waitFor(() => expect(svc.list).toHaveBeenCalledTimes(2));
  });

  it('tocar de novo na aba Mensagens recarrega a lista', async () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: /Abrir ajuda e suporte/ }));
    fireEvent.click(await screen.findByRole('tab', { name: /Mensagens/ }));
    await screen.findByText('Você ainda não abriu nenhum chamado.');
    fireEvent.click(screen.getByRole('tab', { name: /Mensagens/ }));
    await waitFor(() => expect(svc.list).toHaveBeenCalledTimes(2));
  });

  it('o chamado abre rolado até a última mensagem', async () => {
    const topo = vi.fn();
    const proto = HTMLElement.prototype;
    Object.defineProperty(proto, 'scrollHeight', { configurable: true, get: () => 900 });
    Object.defineProperty(proto, 'scrollTop', { configurable: true, get: () => 0, set: topo });
    try {
      montar('/dashboard?suporte=t1');
      await screen.findByText('Socorro');
      expect(topo).toHaveBeenCalledWith(900);
    } finally {
      delete (proto as unknown as Record<string, unknown>).scrollHeight;
      delete (proto as unknown as Record<string, unknown>).scrollTop;
    }
  });
});
