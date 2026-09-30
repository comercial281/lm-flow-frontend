import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

// Tela piloto da Fase 3. Antes: três jeitos de salvar e uma chave "meio ligada".
// Agora: chave = efeito na hora; campo = BarraSalvar. Estes testes são a régua.

const mocks = vi.hoisted(() => ({
  getAccount: vi.fn(),
  updateAccount: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  fetchAccount: vi.fn(),
}));

const t = vi.hoisted(() => (key: string) => key);
vi.mock('@/hooks/useLanguage', () => ({ useLanguage: () => ({ t }) }));
vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: () => ({ can: () => true, isReady: true }) }));
vi.mock('@/services/account/accountService', () => ({
  accountService: {
    getAccount: (...a: unknown[]) => mocks.getAccount(...a),
    getFormData: vi.fn().mockResolvedValue({ inboxes: [], agents: [], teams: [], labels: [] }),
    getGlobalConfig: vi.fn().mockResolvedValue({ isOnEvolutionCloud: true, appVersion: '1' }),
    updateAccount: (...a: unknown[]) => mocks.updateAccount(...a),
  },
}));
vi.mock('@/store/appDataStore', () => ({ useAppDataStore: { getState: () => ({ fetchAccount: mocks.fetchAccount }) } }));
vi.mock('./NotificationCenter', () => ({ default: () => null }));
vi.mock('@/tours', () => ({ SettingsTour: () => null }));
vi.mock('sonner', () => ({ toast: { success: mocks.toastSuccess, error: mocks.toastError } }));

import AccountSettings from './AccountSettings';
import { temAlteracaoPendente, limparPendentes } from '@/hooks/useAlteracoesNaoSalvas';

const CONTA = (settings: Record<string, unknown> = {}) => ({
  id: 7,
  name: 'Imobiliária Horizonte',
  locale: 'pt_BR',
  domain: '',
  support_email: '',
  features: {},
  settings,
});

const montar = () =>
  render(
    <MemoryRouter>
      <AccountSettings />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  limparPendentes();
  Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
  Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
  mocks.updateAccount.mockResolvedValue({});
});

describe('Conta na base da Fase 3', () => {
  it('sem alteração não há barra; mexer no nome mostra a barra e registra a guarda', async () => {
    mocks.getAccount.mockResolvedValue(CONTA());
    montar();
    const nome = await screen.findByLabelText('fields.name.label');
    expect(screen.queryByRole('region', { name: 'Alterações não salvas' })).toBeNull();
    await userEvent.type(nome, ' Ltda');
    expect(screen.getByRole('region', { name: 'Alterações não salvas' })).toBeInTheDocument();
    expect(temAlteracaoPendente()).toBe(true);
  });

  it('Salvar grava só o bloco que mudou e some a barra', async () => {
    mocks.getAccount.mockResolvedValueOnce(CONTA()).mockResolvedValueOnce({ ...CONTA(), name: 'Imobiliária Horizonte Ltda' });
    montar();
    await userEvent.type(await screen.findByLabelText('fields.name.label'), ' Ltda');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() =>
      expect(mocks.updateAccount).toHaveBeenCalledWith({
        name: 'Imobiliária Horizonte Ltda',
        locale: 'pt-BR',
        domain: '',
        support_email: '',
      }),
    );
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Alterações não salvas' })).toBeNull());
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Salvo');
  });

  it('Descartar volta ao que estava salvo', async () => {
    mocks.getAccount.mockResolvedValue(CONTA());
    montar();
    const nome = await screen.findByLabelText('fields.name.label');
    await userEvent.type(nome, ' Ltda');
    await userEvent.click(screen.getByRole('button', { name: 'Descartar' }));
    expect(nome).toHaveValue('Imobiliária Horizonte');
    expect(mocks.updateAccount).not.toHaveBeenCalled();
  });

  it('ligar a resolução automática pergunta o tempo e já grava — nada de "meio ligada"', async () => {
    mocks.getAccount.mockResolvedValue(CONTA());
    montar();
    await userEvent.click(await screen.findByRole('switch', { name: 'sections.autoResolve.title' }));
    const janela = await screen.findByRole('dialog');
    const mensagem = within(janela).getByLabelText('fields.autoResolveMessage.label');
    await userEvent.type(mensagem, 'Encerramos por aqui');
    await userEvent.click(within(janela).getByRole('button', { name: 'Ligar' }));
    await waitFor(() =>
      expect(mocks.updateAccount).toHaveBeenCalledWith({
        auto_resolve_after: 1440,
        auto_resolve_message: 'Encerramos por aqui',
        auto_resolve_ignore_waiting: false,
        auto_resolve_label: null,
      }),
    );
    await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalledWith('Ligada'));
  });

  it('desistir na janela: a chave volta desligada e nada é gravado', async () => {
    mocks.getAccount.mockResolvedValue(CONTA());
    montar();
    const chave = await screen.findByRole('switch', { name: 'sections.autoResolve.title' });
    await userEvent.click(chave);
    const janela = await screen.findByRole('dialog');
    await userEvent.click(within(janela).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(chave).toHaveAttribute('aria-checked', 'false'));
    expect(mocks.updateAccount).not.toHaveBeenCalled();
  });

  it('tempo abaixo de 10 minutos não deixa ligar', async () => {
    mocks.getAccount.mockResolvedValue(CONTA());
    montar();
    await userEvent.click(await screen.findByRole('switch', { name: 'sections.autoResolve.title' }));
    const janela = await screen.findByRole('dialog');
    const tempo = within(janela).getByLabelText('fields.autoResolveTime.label');
    await userEvent.clear(tempo);
    await userEvent.type(tempo, '5');
    expect(within(janela).getByRole('button', { name: 'Ligar' })).toBeDisabled();
  });

  it('desligar grava na hora (como antes)', async () => {
    mocks.getAccount.mockResolvedValue(CONTA({ auto_resolve_after: 60 }));
    montar();
    await userEvent.click(await screen.findByRole('switch', { name: 'sections.autoResolve.title' }));
    await waitFor(() =>
      expect(mocks.updateAccount).toHaveBeenCalledWith({
        auto_resolve_after: null,
        auto_resolve_message: '',
        auto_resolve_ignore_waiting: false,
        auto_resolve_label: null,
      }),
    );
  });

  it('"Ignorar conversas aguardando" é caixinha e espera o Salvar', async () => {
    mocks.getAccount.mockResolvedValue(CONTA({ auto_resolve_after: 60 }));
    montar();
    const caixinha = await screen.findByRole('checkbox', { name: 'fields.ignoreWaiting.label' });
    await userEvent.click(caixinha);
    expect(mocks.updateAccount).not.toHaveBeenCalled();
    expect(screen.getByRole('region', { name: 'Alterações não salvas' })).toBeInTheDocument();
  });

  it('transcrição de áudio é chave: grava na hora, sem barra', async () => {
    mocks.getAccount.mockResolvedValue(CONTA());
    montar();
    await userEvent.click(await screen.findByRole('switch', { name: 'sections.audioTranscription.title' }));
    await waitFor(() => expect(mocks.updateAccount).toHaveBeenCalledWith({ audio_transcriptions: true }));
    expect(screen.queryByRole('region', { name: 'Alterações não salvas' })).toBeNull();
  });

  it('ligar/desligar a resolução não apaga alteração não salva de outro campo', async () => {
    mocks.getAccount.mockResolvedValue(CONTA({ auto_resolve_after: 60 }));
    montar();
    const nome = await screen.findByLabelText('fields.name.label');
    await userEvent.type(nome, ' Ltda');
    expect(screen.getByRole('region', { name: 'Alterações não salvas' })).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('switch', { name: 'sections.autoResolve.title' }));
    await waitFor(() =>
      expect(mocks.updateAccount).toHaveBeenCalledWith({
        auto_resolve_after: null,
        auto_resolve_message: '',
        auto_resolve_ignore_waiting: false,
        auto_resolve_label: null,
      }),
    );
    expect(nome).toHaveValue('Imobiliária Horizonte Ltda');
    expect(screen.getByRole('region', { name: 'Alterações não salvas' })).toBeInTheDocument();
    expect(mocks.getAccount).toHaveBeenCalledTimes(1);
  });
});
