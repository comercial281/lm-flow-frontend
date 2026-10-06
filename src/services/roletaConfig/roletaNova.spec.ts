import { describe, it, expect, vi, beforeEach } from 'vitest';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() }));
vi.mock('@/services/core/api', () => ({ default: api }));

import {
  roletaConfigService,
  conflitoDaOrigem,
  mensagemDoServidor,
} from './roletaConfigService';
import { roletaSettingsService, normalizarAvisos, camposGravaveis } from './roletaSettingsService';

// Contrato do PR do servidor B2 (roleta nova). O servidor responde no envelope
// da casa ({ success, data }); o contrato descreve o miolo. Os dois valem.
const envelope = (data: unknown) => ({ data: { success: true, data } });

beforeEach(() => {
  Object.values(api).forEach(f => f.mockReset());
});

describe('roletaConfigService · roleta nova', () => {
  it('origens: GET /roleta_configs/:id/origins, com ou sem envelope', async () => {
    const origem = { kind: 'meta_form', ref_id: 'f1', label: '21/08 - ALMA', detail: null };
    api.get.mockResolvedValueOnce(envelope({ origins: [origem] }));
    expect(await roletaConfigService.getOrigins('r1')).toEqual([origem]);
    expect(api.get).toHaveBeenCalledWith('/roleta_configs/r1/origins');

    api.get.mockResolvedValueOnce({ data: { origins: [origem] } });
    expect(await roletaConfigService.getOrigins('r1')).toEqual([origem]);

    api.get.mockResolvedValueOnce(envelope({}));
    expect(await roletaConfigService.getOrigins('r1')).toEqual([]);
  });

  it('opções de origem: GET /roleta_configs/origin_options', async () => {
    const op = { kind: 'landing', ref_id: 'l1', label: 'Lançamento', detail: null, roleta_config_id: null, roleta_name: null };
    api.get.mockResolvedValueOnce(envelope({ options: [op] }));
    expect(await roletaConfigService.getOriginOptions()).toEqual([op]);
    expect(api.get).toHaveBeenCalledWith('/roleta_configs/origin_options');
  });

  it('adicionar origem manda { kind, ref_id } ou a palavra do "nome contém"', async () => {
    api.post.mockResolvedValue(envelope({ origin: { kind: 'landing', ref_id: 'l1', label: 'X' } }));
    expect(await roletaConfigService.addOrigin('r1', { kind: 'landing', ref_id: 'l1' })).toEqual({ kind: 'landing', ref_id: 'l1', label: 'X' });
    expect(api.post).toHaveBeenCalledWith('/roleta_configs/r1/origins', { kind: 'landing', ref_id: 'l1' });

    await roletaConfigService.addOrigin('r1', { kind: 'meta_form_keyword', keyword: 'ALMA' });
    expect(api.post).toHaveBeenLastCalledWith('/roleta_configs/r1/origins', { kind: 'meta_form_keyword', keyword: 'ALMA' });
  });

  it('tirar origem: DELETE com o corpo { kind, ref_id }', async () => {
    api.delete.mockResolvedValue({ status: 204 });
    await roletaConfigService.removeOrigin('r1', { kind: 'sales_agent', ref_id: 'a1' });
    expect(api.delete).toHaveBeenCalledWith('/roleta_configs/r1/origins', { data: { kind: 'sales_agent', ref_id: 'a1' } });
  });

  it('histórico: por roleta ou geral, com os filtros do contrato', async () => {
    api.get.mockResolvedValue(envelope({ items: [] }));
    await roletaConfigService.getHistory({ roletaId: 'r1', filter: 'attention', userId: 'u1', days: 30 });
    expect(api.get).toHaveBeenCalledWith('/roleta_configs/r1/history', { params: { filter: 'attention', user_id: 'u1', days: 30 } });

    await roletaConfigService.getHistory();
    expect(api.get).toHaveBeenLastCalledWith('/roleta_configs/history', { params: { filter: 'all', user_id: undefined, days: 7 } });
  });

  it('próximo da vez, duplicar e a roleta nova em rascunho', async () => {
    api.get.mockResolvedValueOnce(envelope({ user_id: null, reason: 'Ninguém ativo na fila' }));
    expect(await roletaConfigService.getNextUp('r1')).toEqual({ user_id: null, reason: 'Ninguém ativo na fila' });
    expect(api.get).toHaveBeenCalledWith('/roleta_configs/r1/next_up');

    api.post.mockResolvedValueOnce(envelope({ id: 'r2', name: 'Cópia de A' }));
    expect(await roletaConfigService.duplicate('r1')).toEqual({ id: 'r2', name: 'Cópia de A' });
    expect(api.post).toHaveBeenCalledWith('/roleta_configs/r1/duplicate');

    api.post.mockResolvedValueOnce(envelope({ id: 'r3', name: 'Zona Sul' }));
    await roletaConfigService.createDraft('Zona Sul');
    expect(api.post).toHaveBeenLastCalledWith('/roleta_configs', expect.objectContaining({ name: 'Zona Sul', is_active: false, distribution_mode: 'fila', members: [] }));
    expect(api.post.mock.calls.at(-1)?.[1]).not.toHaveProperty('inbox_id');
  });

  it('conflito da barreira D9, solto ou no envelope de erro', () => {
    const conflito = { form_name: '21/08 - ALMA', roleta_name: 'Zona Sul' };
    expect(conflitoDaOrigem({ response: { data: { error: 'Conflito', conflict: conflito } } })).toEqual(conflito);
    expect(conflitoDaOrigem({ response: { data: { error: { message: 'x', details: { conflict: conflito } } } } })).toEqual(conflito);
    expect(conflitoDaOrigem({ response: { data: { error: 'x' } } })).toBeNull();
    expect(conflitoDaOrigem(new Error('rede'))).toBeNull();
  });

  it('mensagem do servidor nos dois formatos', () => {
    expect(mensagemDoServidor({ response: { data: { error: 'Falta: uma origem' } } })).toBe('Falta: uma origem');
    expect(mensagemDoServidor({ response: { data: { error: { message: 'Não pode' } } } })).toBe('Não pode');
    expect(mensagemDoServidor({ response: { data: { message: 'Outra' } } })).toBe('Outra');
    expect(mensagemDoServidor({})).toBeNull();
  });
});

describe('roletaSettingsService', () => {
  it('lê GET /roleta_settings e completa o que faltar como desligado', async () => {
    api.get.mockResolvedValueOnce(envelope({ notify_broker_offer: true, gestores: [{ id: 'u1', name: 'Ana', whatsapp_present: false }] }));
    const s = await roletaSettingsService.get();
    expect(api.get).toHaveBeenCalledWith('/roleta_settings');
    expect(s.notify_broker_offer).toBe(true);
    expect(s.notify_group_repass).toBe(false);
    expect(s.gestor_user_ids).toEqual([]);
    expect(s.template_broker_won).toBeNull();
    expect(s.gestores).toEqual([{ id: 'u1', name: 'Ana', whatsapp_present: false }]);
  });

  it('grava com PUT só os campos graváveis (sem a lista de gestores calculada)', async () => {
    const s = normalizarAvisos({ gestor_user_ids: ['u1'], notify_gestor_morning: true, gestores: [{ id: 'u1', name: 'Ana', whatsapp_present: true }] });
    api.put.mockResolvedValueOnce(envelope({ ...camposGravaveis(s), gestores: s.gestores }));
    const gravado = await roletaSettingsService.update(camposGravaveis(s));
    const enviado = api.put.mock.calls[0][1];
    expect(api.put.mock.calls[0][0]).toBe('/roleta_settings');
    expect(enviado).not.toHaveProperty('gestores');
    expect(enviado).toMatchObject({ gestor_user_ids: ['u1'], notify_gestor_morning: true, template_group_offer: null });
    expect(gravado.gestores).toHaveLength(1);
  });
});
