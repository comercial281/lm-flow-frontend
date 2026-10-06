import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const settings = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn() }));
const users = vi.hoisted(() => ({ getUsers: vi.fn() }));
const grupos = vi.hoisted(() => ({ getGroups: vi.fn() }));
const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast: toasts }));
vi.mock('@/services/users/usersService', () => ({ default: users }));
vi.mock('@/services/leadAutomation/leadAutomationService', () => ({ leadAutomationService: grupos }));
vi.mock('@/services/roletaConfig/roletaSettingsService', async importOriginal => {
  const real = await importOriginal<typeof import('@/services/roletaConfig/roletaSettingsService')>();
  return { ...real, roletaSettingsService: settings };
});
import AvisosAba from './AvisosAba';
import { normalizarAvisos } from '@/services/roletaConfig/roletaSettingsService';
import { limparPendentes } from '@/hooks/useAlteracoesNaoSalvas';

beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
});

const enviado = () => settings.update.mock.calls.at(-1)?.[0];

beforeEach(() => {
  vi.clearAllMocks();
  limparPendentes();
  settings.get.mockResolvedValue(normalizarAvisos({
    gestor_user_ids: ['u1'], gestores: [{ id: 'u1', name: 'Ana Gestora', whatsapp_present: false }],
  }));
  settings.update.mockImplementation(async (campos: object) => normalizarAvisos({ ...campos, gestores: [{ id: 'u1', name: 'Ana Gestora', whatsapp_present: false }] }));
  users.getUsers.mockResolvedValue({ data: [{ id: 'u1', name: 'Ana Gestora' }, { id: 'u2', name: 'Bruno' }] });
  grupos.getGroups.mockResolvedValue([{ id: 'g1@g.us', name: 'Imobiliária Exemplo - Leads' }]);
});

describe('Avisos da roleta', () => {
  it('três blocos por quem recebe, tudo desligado de fábrica', async () => {
    render(<AvisosAba />);
    expect(await screen.findByRole('heading', { name: 'Corretor' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Gestor' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Grupo' })).toBeInTheDocument();
    for (const s of screen.getAllByRole('switch')) expect(s).not.toBeChecked();
    expect(grupos.getGroups).toHaveBeenCalledWith('Operacional (LM01)', true);
  });

  it('chave vale na hora e manda o registro inteiro', async () => {
    render(<AvisosAba />);
    await userEvent.click(await screen.findByRole('switch', { name: 'Lead novo esperando o aceite' }));
    await waitFor(() => expect(settings.update).toHaveBeenCalled());
    expect(enviado()).toMatchObject({ notify_broker_offer: true, gestor_user_ids: ['u1'], notify_gestor_morning: false });
    expect(enviado()).not.toHaveProperty('gestores');
  });

  it('gestor sem WhatsApp no cadastro aparece avisado', async () => {
    render(<AvisosAba />);
    expect(await screen.findByText('Ana Gestora')).toBeInTheDocument();
    expect(screen.getByText('sem WhatsApp no cadastro: não recebe')).toBeInTheDocument();
  });

  it('adicionar e tirar gestor', async () => {
    render(<AvisosAba />);
    const seletor = await screen.findByRole('combobox', { name: 'Adicionar gestor' });
    await waitFor(() => expect(within(seletor).getAllByRole('option')).toHaveLength(2));
    await userEvent.selectOptions(seletor, 'u2');
    await waitFor(() => expect(enviado().gestor_user_ids).toEqual(['u1', 'u2']));
    await userEvent.click(screen.getByRole('button', { name: 'Tirar Ana Gestora dos gestores' }));
    await waitFor(() => expect(enviado().gestor_user_ids).toEqual(['u2']));
  });

  it('grupo da lista do Operacional; sem grupo, as chaves do grupo travam', async () => {
    render(<AvisosAba />);
    expect(await screen.findByRole('switch', { name: 'Lead novo na roleta' })).toBeDisabled();
    const grupo = screen.getByLabelText('Grupo que recebe');
    await waitFor(() => expect(grupo).toBeEnabled());
    await userEvent.selectOptions(grupo, 'g1@g.us');
    await waitFor(() => expect(enviado()).toMatchObject({ group_jid: 'g1@g.us', group_name: 'Imobiliária Exemplo - Leads' }));
    expect(await screen.findByRole('switch', { name: 'Lead novo na roleta' })).toBeEnabled();
  });

  it('Personalizar textos abre fechado; o texto espera o Salvar e vai com a variável', async () => {
    render(<AvisosAba />);
    const botao = await screen.findByRole('button', { name: 'Personalizar textos' });
    expect(botao).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByLabelText('Gestor: corretor aceitou')).toBeNull();
    await userEvent.click(botao);
    const campo = screen.getByLabelText('Gestor: corretor aceitou');
    await userEvent.type(campo, 'Aceito por ');
    const barras = screen.getAllByRole('button', { name: '+ Corretor' });
    await userEvent.click(barras[3]);
    expect(settings.update).not.toHaveBeenCalled();
    await userEvent.click(within(screen.getByRole('region', { name: 'Alterações não salvas' })).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(settings.update).toHaveBeenCalled());
    expect(enviado()).toMatchObject({ template_gestor_accepted: 'Aceito por {{corretor}}', template_broker_offer: null });
    expect(toasts.success).toHaveBeenCalledWith('Textos salvos');
  });

  it('chave ligada não leva junto o texto ainda não salvo', async () => {
    render(<AvisosAba />);
    await userEvent.click(await screen.findByRole('button', { name: 'Personalizar textos' }));
    await userEvent.type(screen.getByLabelText('Corretor: "O lead é seu"'), 'rascunho');
    await userEvent.click(screen.getByRole('switch', { name: 'Corretor aceitou' }));
    await waitFor(() => expect(settings.update).toHaveBeenCalled());
    expect(enviado().template_broker_won).toBeNull();
    expect(screen.getByLabelText('Corretor: "O lead é seu"')).toHaveValue('rascunho');
  });

  it('texto salvando + chave virada: as gravações vão em fila e uma não apaga a outra', async () => {
    let soltar: () => void = () => {};
    settings.update.mockImplementationOnce((campos: object) => new Promise(ok => {
      soltar = () => ok(normalizarAvisos({ ...campos, gestores: [] }));
    }));
    render(<AvisosAba />);
    await userEvent.click(await screen.findByRole('button', { name: 'Personalizar textos' }));
    await userEvent.type(screen.getByLabelText('Gestor: corretor aceitou'), 'Texto novo');
    await userEvent.click(within(screen.getByRole('region', { name: 'Alterações não salvas' })).getByRole('button', { name: 'Salvar' }));
    await userEvent.click(screen.getByRole('switch', { name: 'Resumo da manhã' }));
    // a chave espera a gravação do texto terminar
    expect(settings.update).toHaveBeenCalledTimes(1);
    soltar();
    await waitFor(() => expect(settings.update).toHaveBeenCalledTimes(2));
    expect(enviado()).toMatchObject({ notify_gestor_morning: true, template_gestor_accepted: 'Texto novo' });
  });

  it('tirar o grupo desliga junto os avisos do grupo', async () => {
    settings.get.mockResolvedValue(normalizarAvisos({ group_jid: 'g1@g.us', group_name: 'Grupo', notify_group_offer: true }));
    render(<AvisosAba />);
    const grupo = await screen.findByLabelText('Grupo que recebe');
    await waitFor(() => expect(grupo).toBeEnabled());
    await userEvent.selectOptions(grupo, '');
    await waitFor(() => expect(enviado()).toMatchObject({ group_jid: null, notify_group_offer: false, notify_group_repass: false }));
  });

  it('erro ao carregar oferece tentar de novo', async () => {
    settings.get.mockRejectedValueOnce(new Error('rede'));
    render(<AvisosAba />);
    await userEvent.click(await screen.findByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByRole('heading', { name: 'Corretor' })).toBeInTheDocument();
  });
});
