import { describe, expect, it, vi, beforeEach } from 'vitest';

const get = vi.hoisted(() => vi.fn());
const post = vi.hoisted(() => vi.fn());
const put = vi.hoisted(() => vi.fn());
const patch = vi.hoisted(() => vi.fn());
const del = vi.hoisted(() => vi.fn());
vi.mock('@/services/core/api', () => ({ default: { get, post, put, patch, delete: del } }));

import { campanhasService } from './campanhasService';

beforeEach(() => { get.mockReset(); post.mockReset(); put.mockReset(); patch.mockReset(); del.mockReset(); });

const LINHA = { id: 'l1', match_kind: 'campaign', match_value: 'Campanha A', label: 'Campanha A', property_ids: [], sells_scope: 'catalog', sells_listing_kind: null, offer_condition: null, audience_intents: [], is_active: true };

describe('campanhasService', () => {
  it('lista sem recorte pede /campaigns sem parâmetros', async () => {
    get.mockResolvedValue({ data: { data: [{ key: 'form:1', kind: 'form' }] } });
    const r = await campanhasService.lista();
    expect(get).toHaveBeenCalledWith('/campaigns', { params: {} });
    expect(r).toHaveLength(1);
  });

  it('lista({salesAgentId}) manda sales_agent_id', async () => {
    get.mockResolvedValue({ data: { data: [] } });
    await campanhasService.lista({ salesAgentId: 'a1' });
    expect(get).toHaveBeenCalledWith('/campaigns', { params: { sales_agent_id: 'a1' } });
  });

  it('criarLinha posta em /campaign_links', async () => {
    post.mockResolvedValue({ data: { data: LINHA } });
    const r = await campanhasService.criarLinha({ match_kind: 'campaign', match_value: 'Campanha A', label: 'Campanha A' });
    expect(post).toHaveBeenCalledWith('/campaign_links', { match_kind: 'campaign', match_value: 'Campanha A', label: 'Campanha A' });
    expect(r.id).toBe('l1');
  });

  it('atualizarLinha faz PATCH pelo id (desligar é is_active false)', async () => {
    patch.mockResolvedValue({ data: { data: { ...LINHA, is_active: false } } });
    const r = await campanhasService.atualizarLinha('l1', { is_active: false });
    expect(patch).toHaveBeenCalledWith('/campaign_links/l1', { is_active: false });
    expect(r.is_active).toBe(false);
  });

  it('opcoesDeIa lê agent_options', async () => {
    const op = [{ sales_agent_id: 'a1', number_id: null, label: 'Agente A', serves_all: false, locked: null, enabled: true }];
    get.mockResolvedValue({ data: { data: op } });
    expect(await campanhasService.opcoesDeIa()).toEqual(op);
    expect(get).toHaveBeenCalledWith('/campaigns/agent_options');
  });

  it('escolherIa faz PUT com a referência e o confirm_move', async () => {
    put.mockResolvedValue({ data: { holders: [], left_empty: [], warning: null } });
    const r = await campanhasService.escolherIa({ ref: { kind: 'form', id: 'f1' }, sales_agent_id: 'a1', number_id: null, confirm_move: true });
    expect(put).toHaveBeenCalledWith('/campaigns/agent', { ref: { kind: 'form', id: 'f1' }, sales_agent_id: 'a1', number_id: null, confirm_move: true });
    expect(r).toEqual({ ok: true, holders: [], left_empty: [], warning: null });
  });

  it('escolherIa devolve o pedido de confirmação quando o servidor responde 409', async () => {
    put.mockRejectedValue({ response: { status: 409, data: { error: 'move_needed', message: 'Já é do Agente B', from: { sales_agent_id: 'b', number_id: null }, conflicts: [{ sales_agent_id: 'b', number_id: null }] } } });
    const r = await campanhasService.escolherIa({ ref: { kind: 'campaign_link', id: 'l1' }, sales_agent_id: 'a1' });
    expect(r).toEqual({ ok: false, moveNeeded: true, message: 'Já é do Agente B', conflicts: [{ sales_agent_id: 'b', number_id: null }] });
  });

  it('escolherIa propaga outro erro', async () => {
    put.mockRejectedValue({ response: { status: 422, data: { message: 'x' } } });
    await expect(campanhasService.escolherIa({ ref: { kind: 'form', id: 'f1' }, sales_agent_id: 'a1' })).rejects.toBeTruthy();
  });


  it('condicaoDoTexto posta o texto do anúncio', async () => {
    post.mockResolvedValue({ data: { data: { down_payment_from: 5000, installment_from: 900, min_income: 3000, payment_terms: null, note: null } } });
    const r = await campanhasService.condicaoDoTexto('Entrada a partir de R$ 5.000');
    expect(post).toHaveBeenCalledWith('/campaign_links/condition_from_text', { text: 'Entrada a partir de R$ 5.000' });
    expect(r.down_payment_from).toBe(5000);
  });
});
