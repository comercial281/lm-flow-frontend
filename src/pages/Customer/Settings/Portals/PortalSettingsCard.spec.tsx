import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PortalSettingsCard from './PortalSettingsCard';
import type { PortalSettings } from '@/services/portals/portalsService';

const mocks = vi.hoisted(() => ({
  updateSettings: vi.fn(),
  getPipelines: vi.fn(),
  getPipelineStages: vi.fn(),
  getAllRoletas: vi.fn(),
  getUsers: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@/services/portals/portalsService', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/services/portals/portalsService');
  return {
    ...actual,
    portalsService: { updateSettings: (...a: unknown[]) => mocks.updateSettings(...a) },
  };
});

vi.mock('@/services/pipelines/pipelinesService', () => ({
  pipelinesService: {
    getPipelines: (...a: unknown[]) => mocks.getPipelines(...a),
    getPipelineStages: (...a: unknown[]) => mocks.getPipelineStages(...a),
  },
}));

vi.mock('@/services/roletaConfig/roletaConfigService', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/services/roletaConfig/roletaConfigService');
  return {
    ...actual,
    roletaConfigService: { getAll: (...a: unknown[]) => mocks.getAllRoletas(...a) },
  };
});

vi.mock('@/services/users', () => ({
  usersService: { getUsers: (...a: unknown[]) => mocks.getUsers(...a) },
}));

vi.mock('sonner', () => ({
  toast: {
    success: (...a: unknown[]) => mocks.toastSuccess(...a),
    error: (...a: unknown[]) => mocks.toastError(...a),
    warning: vi.fn(),
  },
}));

const erro403 = {
  response: {
    status: 403,
    data: { error: 'Forbidden', message: 'Seu cargo não permite esta ação' },
  },
};

const montar = (settings?: PortalSettings | null, onSaved?: () => void) =>
  render(<PortalSettingsCard portalKey="portal_zap" settings={settings} onSaved={onSaved} />);

/**
 * A tela *Configurar* do portal: quatro blocos, UM salvar. O que estes
 * exemplos travam é o payload que sai — vazio vira nulo, seletor escondido
 * não viaja — e que leitura de fundo recusada só esconde, nunca grita.
 */
describe('PortalSettingsCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateSettings.mockResolvedValue({});
    mocks.getPipelines.mockResolvedValue({
      data: [{ id: 'pipe-1', name: 'Lançamentos' }, { id: 'pipe-2', name: 'Locação' }],
    });
    mocks.getPipelineStages.mockImplementation(async (pid: string) => ({
      data: pid === 'pipe-1'
        ? [{ id: 'st-1', name: 'Novo' }, { id: 'st-2', name: 'Qualificando' }]
        : [{ id: 'st-9', name: 'Entrada' }],
    }));
    mocks.getAllRoletas.mockResolvedValue([
      { id: 'rol-1', name: 'Roleta principal', is_active: true },
      { id: 'rol-2', name: 'Roleta antiga', is_active: false },
    ]);
    mocks.getUsers.mockResolvedValue({
      data: [{ id: 'u-1', name: 'Ana' }, { id: 'u-2', name: 'Bruno', deactivated: true }],
    });
  });

  it('sem settings (servidor antigo) abre com os padrões: bairro, leads ligados, destino vazio', async () => {
    montar(undefined);
    await screen.findByRole('combobox', { name: 'Funil' });

    expect(screen.getByLabelText('Nome da imobiliária no portal')).toHaveValue('');
    expect(screen.getByRole('radio', { name: /Só o bairro/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Sim' })).toBeChecked();
    expect(screen.getByRole('combobox', { name: 'Funil' })).toHaveValue('');
    expect(screen.queryByRole('combobox', { name: 'Coluna' })).toBeNull();
    expect(screen.getByRole('combobox', { name: 'Roleta' })).toHaveValue('');
    expect(screen.getByRole('combobox', { name: 'Responsável' })).toHaveValue('');
    // A roleta desativada não é oferecida; o corretor desativado tampouco.
    expect(screen.queryByRole('option', { name: 'Roleta antiga' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'Bruno' })).toBeNull();
    expect(screen.getByText('O portal exige nome e e-mail para importar os anúncios.')).toBeInTheDocument();
  });

  it('salva os quatro blocos numa requisição só, com vazio virando nulo', async () => {
    const usuario = userEvent.setup();
    const onSaved = vi.fn();
    montar(undefined, onSaved);
    await screen.findByRole('combobox', { name: 'Funil' });

    await usuario.type(screen.getByLabelText('Nome da imobiliária no portal'), 'Apto Premium');
    await usuario.type(screen.getByLabelText('E-mail de contato'), 'contato@apto.com.br');
    // Nome do contato fica em branco de propósito → null.
    await usuario.click(screen.getByRole('radio', { name: /Endereço completo/ }));
    await usuario.click(screen.getByRole('radio', { name: 'Não' }));
    expect(screen.getByText('Desligado, o lead que o portal mandar fica guardado e não vira contato.')).toBeInTheDocument();

    await usuario.selectOptions(screen.getByRole('combobox', { name: 'Funil' }), 'pipe-1');
    await usuario.selectOptions(await screen.findByRole('combobox', { name: 'Coluna' }), 'st-2');
    await usuario.selectOptions(screen.getByRole('combobox', { name: 'Roleta' }), 'rol-1');
    await usuario.selectOptions(screen.getByRole('combobox', { name: 'Responsável' }), 'u-1');

    await usuario.click(screen.getByRole('button', { name: 'Salvar configuração' }));

    await waitFor(() => expect(mocks.updateSettings).toHaveBeenCalledTimes(1));
    expect(mocks.updateSettings).toHaveBeenCalledWith('portal_zap', {
      provider_name: 'Apto Premium',
      contact_email: 'contato@apto.com.br',
      contact_name: null,
      display_address: 'all',
      leads_enabled: false,
      pipeline_id: 'pipe-1',
      stage_id: 'st-2',
      roleta_config_id: 'rol-1',
      default_assignee_id: 'u-1',
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Configuração salva');
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('abre preenchido com o que está gravado, colunas do funil gravado incluídas', async () => {
    montar({
      provider_name: 'Apto Premium',
      contact_email: 'x@y.com',
      contact_name: 'Nicholas',
      display_address: 'street',
      leads_enabled: true,
      pipeline_id: 'pipe-1',
      stage_id: 'st-2',
      roleta_config_id: 'rol-2',
      default_assignee_id: 'u-1',
    });
    const coluna = await screen.findByRole('combobox', { name: 'Coluna' });
    await waitFor(() => expect(coluna).toHaveValue('st-2'));

    expect(screen.getByLabelText('Nome do contato')).toHaveValue('Nicholas');
    expect(screen.getByRole('radio', { name: /Rua, sem número/ })).toBeChecked();
    expect(screen.getByRole('combobox', { name: 'Funil' })).toHaveValue('pipe-1');
    // A roleta gravada está desativada: continua escolhida, com o aviso.
    expect(screen.getByRole('combobox', { name: 'Roleta' })).toHaveValue('rol-2');
    expect(screen.getByRole('option', { name: 'Roleta escolhida (desativada)' })).toBeInTheDocument();
    expect(screen.getByText(/Esta roleta está desativada/)).toBeInTheDocument();
  });

  it('trocar o funil limpa a coluna', async () => {
    const usuario = userEvent.setup();
    montar({ pipeline_id: 'pipe-1', stage_id: 'st-2' });
    const coluna = await screen.findByRole('combobox', { name: 'Coluna' });
    await waitFor(() => expect(coluna).toHaveValue('st-2'));

    await usuario.selectOptions(screen.getByRole('combobox', { name: 'Funil' }), 'pipe-2');

    await waitFor(() => expect(mocks.getPipelineStages).toHaveBeenLastCalledWith('pipe-2'));
    expect(screen.getByRole('combobox', { name: 'Coluna' })).toHaveValue('');
    await screen.findByRole('option', { name: 'Entrada' });
    expect(screen.queryByRole('option', { name: 'Qualificando' })).toBeNull();

    await usuario.click(screen.getByRole('button', { name: 'Salvar configuração' }));
    await waitFor(() => expect(mocks.updateSettings).toHaveBeenCalledTimes(1));
    expect(mocks.updateSettings.mock.calls[0][1]).toMatchObject({ pipeline_id: 'pipe-2', stage_id: null });
  });

  it('recusa do servidor ao salvar mostra a frase dele (formato de recusa por cargo)', async () => {
    const usuario = userEvent.setup();
    mocks.updateSettings.mockRejectedValueOnce(erro403);
    montar(undefined);
    await screen.findByRole('combobox', { name: 'Funil' });

    await usuario.click(screen.getByRole('button', { name: 'Salvar configuração' }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('Seu cargo não permite esta ação'));
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });

  it('leitura de fundo recusada (roletas 403) só esconde o seletor — sem toast, e sem viajar no salvar', async () => {
    const usuario = userEvent.setup();
    mocks.getAllRoletas.mockRejectedValueOnce(erro403);
    montar({ roleta_config_id: 'rol-1' });
    await screen.findByRole('combobox', { name: 'Funil' });

    expect(screen.queryByRole('combobox', { name: 'Roleta' })).toBeNull();
    expect(screen.getByRole('combobox', { name: 'Responsável' })).toBeInTheDocument();
    expect(mocks.toastError).not.toHaveBeenCalled();

    await usuario.click(screen.getByRole('button', { name: 'Salvar configuração' }));

    await waitFor(() => expect(mocks.updateSettings).toHaveBeenCalledTimes(1));
    // O que a pessoa não pôde ver não é apagado por baixo.
    expect(mocks.updateSettings.mock.calls[0][1]).not.toHaveProperty('roleta_config_id');
    expect(mocks.updateSettings.mock.calls[0][1]).toHaveProperty('default_assignee_id', null);
  });

  it('com as três leituras recusadas o bloco Destino do lead some inteiro, e o resto salva', async () => {
    const usuario = userEvent.setup();
    mocks.getPipelines.mockRejectedValueOnce(erro403);
    mocks.getAllRoletas.mockRejectedValueOnce(erro403);
    mocks.getUsers.mockRejectedValueOnce(erro403);
    montar(undefined);
    await screen.findByRole('button', { name: 'Salvar configuração' });

    await waitFor(() => expect(mocks.getUsers).toHaveBeenCalled());
    expect(screen.queryByText('Destino do lead')).toBeNull();
    expect(mocks.toastError).not.toHaveBeenCalled();

    await usuario.click(screen.getByRole('button', { name: 'Salvar configuração' }));
    await waitFor(() => expect(mocks.updateSettings).toHaveBeenCalledTimes(1));
    expect(mocks.updateSettings).toHaveBeenCalledWith('portal_zap', {
      provider_name: null,
      contact_email: null,
      contact_name: null,
      display_address: 'neighborhood',
      leads_enabled: true,
    });
  });
});
