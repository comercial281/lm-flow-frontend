import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import NumeroOficial from './NumeroOficial';

const s = vi.hoisted(() => ({
  getById: vi.fn(),
  disconnectCloud: vi.fn(),
  iniciar: vi.fn(),
  hook: vi.fn(),
  pode: true,
  liberado: true,
}));
vi.mock('@/contexts/PermissionsContext', () => ({ usePermissions: () => ({ can: () => s.pode }) }));

vi.mock('@/services/channels/inboxesService', () => ({ default: { getById: s.getById } }));
vi.mock('@/services/channels/whatsappService', () => ({ default: { disconnectCloud: s.disconnectCloud } }));
vi.mock('@/components/channels/settings/MessageTemplateForm', () => ({ default: () => <div>lista de modelos</div> }));
vi.mock('@/components/channels/forms/whatsapp/useConexaoOficial', () => ({
  useConexaoOficial: (o: unknown) => {
    s.hook(o);
    return { liberado: s.liberado, pronto: true, carregando: false, erro: null, iniciar: s.iniciar };
  },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const caixa = (nuvem: Record<string, unknown> | null) => ({
  data: {
    id: '9',
    name: 'Loja',
    channel_type: 'Channel::Whatsapp',
    provider: 'whatsapp_cloud',
    whatsapp_cloud: nuvem && {
      connected: true,
      verified_name: 'Loja Exemplo',
      display_phone_number: '+55 11 90000-0000',
      connected_at: '2026-10-20T15:00:00Z',
      waba_id: 'w123',
      mode: 'coexistence',
      ...nuvem,
    },
  },
});

const tela = () =>
  render(
    <MemoryRouter initialEntries={['/channels/9/oficial']}>
      <Routes>
        <Route path="/channels/:id/oficial" element={<NumeroOficial />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  s.pode = true;
  s.liberado = true;
  s.getById.mockResolvedValue(caixa({}));
  s.disconnectCloud.mockResolvedValue({ inbox_id: '9' });
});

describe('NumeroOficial', () => {
  it('mostra nome, selo, nome que o lead vê, data e os três botões', async () => {
    tela();
    expect(await screen.findByRole('heading', { name: 'Loja Exemplo' })).toBeInTheDocument();
    expect(screen.getByText('API oficial')).toBeInTheDocument();
    expect(screen.getByText(/O lead vê o nome Loja Exemplo/)).toBeInTheDocument();
    expect(screen.getByText(/Conectado em 20\/10\/2026/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Abrir no painel da Meta/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reconectar/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Desconectar' })).toBeInTheDocument();
    expect(screen.getByText('lista de modelos')).toBeInTheDocument();
  });

  it('abre o painel da Meta com o id da conta', async () => {
    const abrir = vi.spyOn(window, 'open').mockReturnValue(null);
    tela();
    await userEvent.click(await screen.findByRole('button', { name: /Abrir no painel da Meta/ }));
    expect(abrir).toHaveBeenCalledWith(
      'https://business.facebook.com/wa/manage/home/?waba_id=w123',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('Reconectar chama o fluxo com a caixa e o caminho gravado', async () => {
    tela();
    await userEvent.click(await screen.findByRole('button', { name: /Reconectar/ }));
    expect(s.iniciar).toHaveBeenCalledWith('coexistence');
    expect(s.hook).toHaveBeenCalledWith(expect.objectContaining({ inboxId: '9' }));
  });

  it('Desconectar confirma, chama o servidor e mostra o aviso de número parado', async () => {
    tela();
    await userEvent.click(await screen.findByRole('button', { name: 'Desconectar' }));
    expect(
      await screen.findByText('As conversas continuam aqui. Pra voltar a receber, é só Reconectar.'),
    ).toBeInTheDocument();
    s.getById.mockResolvedValue(caixa({ connected: false }));
    await userEvent.click(screen.getAllByRole('button', { name: 'Desconectar' }).pop()!);
    await waitFor(() => expect(s.disconnectCloud).toHaveBeenCalledWith('9'));
    expect(
      await screen.findByText('Este número não está recebendo mensagens. Reconecte pra voltar a atender.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Desconectar' })).toBeNull();
  });

  it('cancelar a confirmação não desconecta', async () => {
    tela();
    await userEvent.click(await screen.findByRole('button', { name: 'Desconectar' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
    expect(s.disconnectCloud).not.toHaveBeenCalled();
  });

  it('canal que não é oficial não mostra a página de gestão', async () => {
    s.getById.mockResolvedValue(caixa(null));
    tela();
    expect(await screen.findByText('Este canal não é um número da API oficial.')).toBeInTheDocument();
  });

  it('sem permissão de editar a caixa, Reconectar e Desconectar não aparecem', async () => {
    s.pode = false;
    tela();
    await screen.findByRole('heading', { name: 'Loja Exemplo' });
    expect(screen.queryByRole('button', { name: /Reconectar/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Desconectar' })).toBeNull();
    expect(screen.getByRole('button', { name: /Abrir no painel da Meta/ })).toBeInTheDocument();
  });

  it('conexão não liberada troca o Reconectar pelo aviso', async () => {
    s.liberado = false;
    tela();
    await screen.findByRole('heading', { name: 'Loja Exemplo' });
    expect(screen.queryByRole('button', { name: /Reconectar/ })).toBeNull();
    expect(
      screen.getByText('A conexão com a API oficial ainda não está liberada neste LM Flow.'),
    ).toBeInTheDocument();
  });
});
