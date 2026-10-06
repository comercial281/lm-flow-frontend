// Formulários do Meta × roleta nova (06/10/2026): "Quem assume o lead" vira a
// lista com abas Corretores | Roleta; a roleta escolhida e desligada continua na
// lista; com a chave `roleta_nova` a mensagem de fora do horário sai do formulário
// (é da roleta) e o formulário pego por regra "nome contém" mostra a roleta.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { LeadAdsFormConfig } from '@/services/leadAds/leadAdsFormsService';

const chave = vi.hoisted(() => ({ roletaNova: false }));
vi.mock('@/contexts/TenantFeaturesContext', () => ({
  useClientToggle: (k: string) => (k === 'roleta_nova' ? chave.roletaNova : false),
}));

const svc = vi.hoisted(() => ({
  getAll: vi.fn(),
  syncMetaForms: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
}));
vi.mock('@/services/leadAds/leadAdsFormsService', () => ({ leadAdsFormsService: svc }));
vi.mock('@/services/integrations/metaPagesService', () => ({ metaPagesService: { getAll: vi.fn().mockResolvedValue([]) } }));
vi.mock('@/services/properties/propertiesService', () => ({ propertiesService: { list: vi.fn().mockResolvedValue({ data: [] }) } }));
vi.mock('@/hooks/useIsSuperAdmin', () => ({ useIsSuperAdmin: () => false }));
const roletasMock = vi.hoisted(() => vi.fn());
vi.mock('@/services/roletaConfig/roletaConfigService', async (orig) => {
  const real = await orig<typeof import('@/services/roletaConfig/roletaConfigService')>();
  return { ...real, roletaConfigService: { getAll: roletasMock } };
});
const recursos = vi.hoisted(() => ({
  labels: [], sequences: [], followupFlows: [], quickReplies: [], adOrigins: [], formOrigins: [],
  messageFunnels: [], conversationFunnels: [], evolutionInstances: [], loading: false,
  users: [{ id: 'u1', name: 'Ana Corretora' }, { id: 'u9', name: 'Ex Corretor', deactivated: true }],
  pipelines: [{ id: 'p1', name: 'Vendas' }],
  stagesByPipeline: { p1: [{ id: 's1', name: 'Novo' }] },
  reloadLabels: () => {}, reloadFunnels: () => {},
}));
vi.mock('../LeadAutomations/LeadAutomationsEditors', () => ({ useAutomationResources: () => recursos }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import LeadAdsForms from './LeadAdsForms';

const cadastro = (extra: Partial<LeadAdsFormConfig> = {}): LeadAdsFormConfig => ({
  id: 'cfg-1', form_id: 'f-1', form_name: '21/08 - ALMA', meta_page_id: null, page_name: null,
  pipeline_id: 'p1', pipeline_stage_id: 's1', label_ids: [], default_assignee_id: null,
  roleta_config_id: null, property_id: null, match_keyword: 'alma', after_hours_message: null,
  is_active: true, created_at: '2026-10-01', ...extra,
});

beforeEach(() => {
  chave.roletaNova = false;
  svc.getAll.mockReset().mockResolvedValue([]);
  svc.syncMetaForms.mockReset().mockResolvedValue({ data: [], errors: [], ignored_leads: [] });
  svc.update.mockReset().mockImplementation(async (_id: string, d: object) => ({ ...cadastro(), ...d }));
  roletasMock.mockReset().mockResolvedValue([
    { id: 'r1', name: 'Zona Sul', is_active: true },
    { id: 'r2', name: 'Antiga', is_active: false },
  ]);
});

const abrirEdicao = async () => {
  render(<MemoryRouter><LeadAdsForms /></MemoryRouter>);
  fireEvent.click(await screen.findByTitle('Editar'));
  return screen.findByRole('dialog');
};

const salvar = (dialogo: HTMLElement) => fireEvent.click(within(dialogo).getByRole('button', { name: 'Salvar' }));

describe('Formulários do Meta · Quem assume o lead', () => {
  it('é uma lista só com as abas Corretores e Roleta; quem saiu da equipe não é oferecido', async () => {
    svc.getAll.mockResolvedValue([cadastro()]);
    const dialogo = await abrirEdicao();
    const campo = within(dialogo).getByLabelText('Quem assume o lead');
    await waitFor(() => expect(within(campo).getByRole('group', { name: 'Roleta' })).toBeInTheDocument());
    expect(within(campo).getByRole('group', { name: 'Corretores' })).toBeInTheDocument();
    expect(within(campo).getByRole('option', { name: 'Ana Corretora' })).toBeInTheDocument();
    expect(within(campo).queryByRole('option', { name: 'Ex Corretor' })).toBeNull();
    // Roleta desligada que ninguém escolheu não é oferecida.
    expect(within(campo).queryByRole('option', { name: /Antiga/ })).toBeNull();
  });

  it('escolher uma roleta grava a roleta e limpa o corretor', async () => {
    svc.getAll.mockResolvedValue([cadastro({ default_assignee_id: 'u1' })]);
    const dialogo = await abrirEdicao();
    const campo = within(dialogo).getByLabelText('Quem assume o lead');
    await waitFor(() => expect(within(campo).getByRole('option', { name: 'Zona Sul' })).toBeInTheDocument());
    fireEvent.change(campo, { target: { value: 'roleta:r1' } });
    salvar(dialogo);
    await waitFor(() => expect(svc.update).toHaveBeenCalled());
    expect(svc.update.mock.calls[0][1]).toMatchObject({ default_assignee_id: null, roleta_config_id: 'r1' });
  });

  it('a roleta escolhida e desligada continua escolhida, com "(desligada)" e o aviso', async () => {
    svc.getAll.mockResolvedValue([cadastro({ roleta_config_id: 'r2' })]);
    const dialogo = await abrirEdicao();
    const campo = within(dialogo).getByLabelText('Quem assume o lead') as HTMLSelectElement;
    await waitFor(() => expect(within(campo).getByRole('option', { name: 'Antiga (desligada)' })).toBeInTheDocument());
    expect(campo.value).toBe('roleta:r2');
    expect(within(dialogo).getByText(/Esta roleta está desligada/)).toBeInTheDocument();
    salvar(dialogo);
    await waitFor(() => expect(svc.update).toHaveBeenCalled());
    expect(svc.update.mock.calls[0][1]).toMatchObject({ roleta_config_id: 'r2' });
  });

  // Gravado com os dois (a tela antiga deixava): a lista mostra o corretor, que é
  // quem o servidor usa (LeadRouter), e salvar SEM MEXER grava só o corretor — a
  // roleta, que já era ignorada na entrada do lead, é limpa.
  it('gravado com corretor e roleta: mostra o corretor e salvar grava só ele', async () => {
    svc.getAll.mockResolvedValue([cadastro({ default_assignee_id: 'u1', roleta_config_id: 'r1' })]);
    const dialogo = await abrirEdicao();
    expect(within(dialogo).getByLabelText('Quem assume o lead')).toHaveValue('corretor:u1');
    salvar(dialogo);
    await waitFor(() => expect(svc.update).toHaveBeenCalled());
    expect(svc.update.mock.calls[0][1]).toMatchObject({ default_assignee_id: 'u1', roleta_config_id: null });
  });

  it('"Ninguém" volta ao vazio e grava os dois campos vazios', async () => {
    svc.getAll.mockResolvedValue([cadastro({ default_assignee_id: 'u1' })]);
    const dialogo = await abrirEdicao();
    const campo = within(dialogo).getByLabelText('Quem assume o lead');
    fireEvent.change(campo, { target: { value: '' } });
    salvar(dialogo);
    await waitFor(() => expect(svc.update).toHaveBeenCalled());
    expect(svc.update.mock.calls[0][1]).toMatchObject({ default_assignee_id: null, roleta_config_id: null });
  });
});

describe('Formulários do Meta · fora do horário', () => {
  it('sem a chave: o campo da mensagem aparece na roleta e viaja no salvar (como hoje)', async () => {
    svc.getAll.mockResolvedValue([cadastro({ roleta_config_id: 'r1', after_hours_message: 'Oi {{nome}}' })]);
    const dialogo = await abrirEdicao();
    expect(within(dialogo).getByLabelText('Mensagem inicial fora do horário')).toBeInTheDocument();
    salvar(dialogo);
    await waitFor(() => expect(svc.update).toHaveBeenCalled());
    expect(svc.update.mock.calls[0][1]).toMatchObject({ after_hours_message: 'Oi {{nome}}' });
  });

  it('com a chave: o campo some e a mensagem gravada nem viaja (fica pra migração)', async () => {
    chave.roletaNova = true;
    svc.getAll.mockResolvedValue([cadastro({ roleta_config_id: 'r1', after_hours_message: 'Oi {{nome}}' })]);
    const dialogo = await abrirEdicao();
    expect(within(dialogo).queryByLabelText('Mensagem inicial fora do horário')).toBeNull();
    expect(screen.queryByText(/Fala com o lead fora do horário/)).toBeNull();
    salvar(dialogo);
    await waitFor(() => expect(svc.update).toHaveBeenCalled());
    expect(svc.update.mock.calls[0][1]).not.toHaveProperty('after_hours_message');
  });
});

describe('Formulários do Meta · formulário pego por regra "nome contém"', () => {
  const comFormularioNovo = () => {
    svc.getAll.mockResolvedValue([cadastro({ roleta_config_id: 'r1' })]);
    svc.syncMetaForms.mockResolvedValue({
      data: [{ id: 'f-2', name: '05/10 - ALMA 2.0', status: 'ACTIVE', leads_count: 3 }],
      errors: [], ignored_leads: [],
    });
  };

  it('com a chave: mostra em qual roleta cai e por qual regra', async () => {
    chave.roletaNova = true;
    comFormularioNovo();
    render(<MemoryRouter><LeadAdsForms /></MemoryRouter>);
    expect(await screen.findByText('Cai na Roleta Zona Sul pela regra "alma"')).toBeInTheDocument();
  });

  it('com a chave e a regra com corretor fixo: diz pra quem vai, não a roleta (o corretor vence)', async () => {
    chave.roletaNova = true;
    comFormularioNovo();
    svc.getAll.mockResolvedValue([cadastro({ roleta_config_id: 'r1', default_assignee_id: 'u1' })]);
    render(<MemoryRouter><LeadAdsForms /></MemoryRouter>);
    expect(await screen.findByText('Vai pra Ana Corretora pela regra "alma"')).toBeInTheDocument();
    expect(screen.queryByText(/Cai na Roleta/)).toBeNull();
  });

  it('sem a chave: nada muda', async () => {
    comFormularioNovo();
    render(<MemoryRouter><LeadAdsForms /></MemoryRouter>);
    expect(await screen.findByText('05/10 - ALMA 2.0')).toBeInTheDocument();
    expect(screen.queryByText(/Cai na Roleta/)).toBeNull();
  });
});
