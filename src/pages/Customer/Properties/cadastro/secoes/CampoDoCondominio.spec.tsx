// "Condomínio (opcional)" na unidade: busca, escolha, tirar e o atalho pra cadastrar um novo.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { Condominium, CondominiumRow } from '@/services/condominiums/condominiumsService';

const cond = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn() }));
vi.mock('@/services/condominiums/condominiumsService', async orig => ({
  ...(await orig<typeof import('@/services/condominiums/condominiumsService')>()),
  condominiumsService: cond,
}));

import CampoDoCondominio from './CampoDoCondominio';
import { limparPendentes, marcarPendente } from '@/hooks/useAlteracoesNaoSalvas';
import { AVISO_UNIDADE_COM_SITE } from '@/features/properties/condominios/regrasDoCondominio';

const linha = (id: string, name: string, extra: Partial<CondominiumRow> = {}): CondominiumRow => ({
  id, name, kind: 'vertical', address_street: 'Rua Cardoso de Almeida', address_number: '100', address_neighborhood: 'Perdizes',
  address_city: 'São Paulo', address_state: 'SP', units_count: 0, for_sale_count: 0, sold_count: 0, updated_at: '2026-11-10T10:00:00Z',
  cover_photo_url: null, ...extra,
});
const completo = (r: CondominiumRow): Condominium => ({
  ...r, builder_name: null, developer_name: null, administrator_name: null, year_built: null, internal_note: null,
  address_cep: '05013-000', address_complement: null, latitude: -23.53, longitude: -46.67, location_source: 'auto',
  condo_features: ['portaria_24h'], contacts: [], locked_fields: [], photos_count: 3, units: [],
});

function Onde() { const l = useLocation(); return <p data-testid="onde">{l.pathname}{l.search}</p>; }

function abrir(props: Partial<Parameters<typeof CampoDoCondominio>[0]> = {}, url = '/properties/p1/editar?de=lote&condominio=velho') {
  const p = { escolhido: null, aoEscolher: vi.fn(), aoTirar: vi.fn(), desligado: false, podeCadastrar: true, ...props };
  render(<MemoryRouter initialEntries={[url]}>
    <Routes><Route path="*" element={<CampoDoCondominio {...p} />} /></Routes>
    <Onde />
  </MemoryRouter>);
  return p;
}

beforeEach(() => {
  vi.clearAllMocks();
  cond.list.mockResolvedValue({ data: [linha('c1', 'Cyrela Arti Perdizes'), linha('c2', 'Edifício Aurora')], meta: { total: 2, page: 1, per_page: 8, cities: [] } });
});
afterEach(() => { vi.useRealTimers(); limparPendentes(); });

describe('CampoDoCondominio', () => {
  it('abre a lista ao entrar no campo, carregando sem travar a digitação', async () => {
    let soltar: (v: unknown) => void = () => {};
    cond.list.mockReturnValueOnce(new Promise(r => { soltar = r; }));
    abrir();
    const campo = screen.getByLabelText('Condomínio (opcional)');
    await userEvent.click(campo);
    expect(screen.getByText('Carregando condomínios…')).toBeInTheDocument();
    expect(campo).toBeEnabled();
    await act(async () => { soltar({ data: [linha('c1', 'Cyrela Arti Perdizes')], meta: { total: 1, page: 1, per_page: 8, cities: [] } }); });
    expect(await screen.findByRole('button', { name: /Cyrela Arti Perdizes/ })).toBeInTheDocument();
    expect(cond.list).toHaveBeenCalledWith({ per_page: 8 });
  });

  it('busca pelo nome no servidor', async () => {
    abrir();
    await userEvent.type(screen.getByLabelText('Condomínio (opcional)'), 'auro');
    await waitFor(() => expect(cond.list).toHaveBeenCalledWith({ q: 'auro', per_page: 8 }));
  });

  it('escolher busca o condomínio inteiro e entrega pra unidade', async () => {
    const c = completo(linha('c1', 'Cyrela Arti Perdizes'));
    cond.get.mockResolvedValue(c);
    const p = abrir();
    await userEvent.click(screen.getByLabelText('Condomínio (opcional)'));
    await userEvent.click(await screen.findByRole('button', { name: /Cyrela Arti Perdizes/ }));
    await waitFor(() => expect(p.aoEscolher).toHaveBeenCalledWith(c));
    expect(cond.get).toHaveBeenCalledWith('c1');
  });

  it('falha ao abrir o condomínio avisa e não escolhe', async () => {
    cond.get.mockRejectedValue(new Error('x'));
    const p = abrir();
    await userEvent.click(screen.getByLabelText('Condomínio (opcional)'));
    await userEvent.click(await screen.findByRole('button', { name: /Cyrela Arti Perdizes/ }));
    expect(await screen.findByText('Não deu pra abrir esse condomínio. Tente de novo.')).toBeInTheDocument();
    expect(p.aoEscolher).not.toHaveBeenCalled();
  });

  it('lista que falha avisa; sem resultado diz que não achou', async () => {
    cond.list.mockRejectedValueOnce(new Error('x'));
    abrir();
    await userEvent.click(screen.getByLabelText('Condomínio (opcional)'));
    expect(await screen.findByText('Não deu pra carregar os condomínios. Tente de novo.')).toBeInTheDocument();
    cond.list.mockResolvedValue({ data: [], meta: { total: 0, page: 1, per_page: 8, cities: [] } });
    await userEvent.type(screen.getByLabelText('Condomínio (opcional)'), 'zzz');
    expect(await screen.findByText('Nenhum condomínio encontrado.')).toBeInTheDocument();
  });

  it('escolhido: mostra o nome e "Tirar do condomínio"', async () => {
    const p = abrir({ escolhido: { id: 'c1', name: 'Cyrela Arti Perdizes', kind: 'vertical', locked_fields: [], photos_count: 0 } });
    expect(screen.getByText('Cyrela Arti Perdizes')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tirar do condomínio' }));
    expect(p.aoTirar).toHaveBeenCalled();
  });

  it('desligado pela fonte do site: campo parado com o motivo', () => {
    abrir({ desligado: true, motivo: AVISO_UNIDADE_COM_SITE });
    expect(screen.getByLabelText('Condomínio (opcional)')).toBeDisabled();
    expect(screen.getByText(AVISO_UNIDADE_COM_SITE)).toBeInTheDocument();
    expect(cond.list).not.toHaveBeenCalled();
  });

  it('desligado e já plugado: ainda dá pra tirar do condomínio', async () => {
    const p = abrir({ desligado: true, motivo: AVISO_UNIDADE_COM_SITE, escolhido: { id: 'c1', name: 'Aurora', kind: 'vertical', locked_fields: [], photos_count: 0 } });
    await userEvent.click(screen.getByRole('button', { name: 'Tirar do condomínio' }));
    expect(p.aoTirar).toHaveBeenCalled();
  });

  it('"+ Cadastrar condomínio" leva ao cadastro com a volta pra esta unidade, sem o condominio= velho', async () => {
    abrir();
    await userEvent.click(screen.getByRole('link', { name: '+ Cadastrar condomínio' }));
    const onde = screen.getByTestId('onde').textContent ?? '';
    expect(onde.startsWith('/properties/condominios/novo?voltar=')).toBe(true);
    const voltar = new URLSearchParams(onde.split('?')[1]).get('voltar');
    expect(voltar).toBe('/properties/p1/editar?de=lote');
  });

  it('"+ Cadastrar condomínio" com alteração não salva pergunta antes', async () => {
    marcarPendente('teste', true);
    abrir();
    await userEvent.click(screen.getByRole('link', { name: '+ Cadastrar condomínio' }));
    expect(await screen.findByText('Sair sem salvar?')).toBeInTheDocument();
    expect(screen.getByTestId('onde')).toHaveTextContent('/properties/p1/editar');
  });

  it('sem a permissão, não oferece cadastrar condomínio', () => {
    abrir({ podeCadastrar: false });
    expect(screen.queryByRole('link', { name: '+ Cadastrar condomínio' })).not.toBeInTheDocument();
  });
});
