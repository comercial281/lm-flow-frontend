// Unidade de Revenda/Leilão plugada num condomínio: escolher, travar o que vem dele,
// tirar, trocar, e o que vai para o servidor.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { Condominium } from '@/services/condominiums/condominiumsService';

const svc = vi.hoisted(() => ({ get: vi.fn(), create: vi.fn(), update: vi.fn(), uploadBook: vi.fn(), geocode: vi.fn(), cepLookup: vi.fn(), parseText: vi.fn() }));
vi.mock('@/services/properties/propertiesService', async importOriginal => {
  const real = await importOriginal<typeof import('@/services/properties/propertiesService')>();
  return { ...real, propertiesService: { ...real.propertiesService, ...svc } };
});
const cond = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn() }));
vi.mock('@/services/condominiums/condominiumsService', async orig => ({
  ...(await orig<typeof import('@/services/condominiums/condominiumsService')>()),
  condominiumsService: cond,
}));
vi.mock('@/services/propertyPhotos/propertyPhotosService', async orig => ({
  ...(await orig<typeof import('@/services/propertyPhotos/propertyPhotosService')>()),
  propertyPhotosService: { list: () => Promise.resolve([]), upload: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(), loading: vi.fn(), dismiss: vi.fn() } }));
vi.mock('@/contexts/TenantFeaturesContext', () => ({ useFeature: () => true }));
vi.mock('@/services/contacts/labelsService', () => ({ labelsService: { getLabels: () => Promise.resolve({ data: [] }) } }));
vi.mock('@/services/users/usersService', () => ({ default: { getUsers: () => Promise.resolve({ data: [] }) } }));
vi.mock('@/services/portals/portalsService', () => ({ portalsService: { list: () => Promise.resolve([]), get: vi.fn() } }));
vi.mock('@/services/propertyOwners/propertyOwnersService', () => ({ propertyOwnersService: { list: () => Promise.resolve({ data: [], meta: { total: 0 } }), get: vi.fn() } }));
// Sem `condominiums.manage` quando o teste desligar; o resto, liberado.
const semCondominios = vi.hoisted(() => ({ ligado: false }));
vi.mock('@/hooks/useCan', () => ({ useCan: () => (r: string) => !(semCondominios.ligado && r === 'condominiums') }));
vi.mock('./secoes/MapaDoCadastro', () => ({
  default: ({ travado }: { travado?: boolean }) => <div data-testid="mapa" data-travado={String(!!travado)} />,
}));

import CadastroDoImovel from './CadastroDoImovel';
import { DICA_DO_CAMPO, DICA_DO_CONDOMINIO } from '@/features/properties/cadastro/travasDoSite';
import { AVISO_UNIDADE_COM_SITE } from '@/features/properties/condominios/regrasDoCondominio';

function Onde() { const l = useLocation(); return <p data-testid="onde">{l.pathname}{l.search}</p>; }
function abrir(url: string) {
  return render(<MemoryRouter initialEntries={[url]}><Routes>
    <Route path="/properties/new" element={<CadastroDoImovel />} />
    <Route path="/properties/:id/editar" element={<CadastroDoImovel />} />
    <Route path="*" element={null} />
  </Routes><Onde /></MemoryRouter>);
}

const CYRELA: Condominium = {
  id: 'c1', name: 'Cyrela Arti Perdizes', kind: 'vertical', builder_name: null, developer_name: null, administrator_name: null,
  year_built: null, internal_note: null, address_cep: '05013-000', address_street: 'Rua Cardoso de Almeida', address_number: '100',
  address_complement: null, address_neighborhood: 'Perdizes', address_city: 'São Paulo', address_state: 'SP',
  latitude: -23.53, longitude: -46.67, location_source: 'auto', condo_features: ['portaria_24h'], contacts: [],
  locked_fields: [], photos_count: 8, units: [], units_count: 0, for_sale_count: 0, sold_count: 0, updated_at: '', cover_photo_url: null,
};
const VILA: Condominium = {
  ...CYRELA, id: 'c2', name: 'Vila Verde', kind: 'horizontal', address_cep: '13010-000', address_street: 'Rua das Flores',
  address_number: '50', address_neighborhood: 'Cambuí', address_city: 'Campinas', address_state: 'SP',
  latitude: -22.9, longitude: -47.06, condo_features: ['academia'], photos_count: 1,
  locked_fields: ['address_cep', 'address_street', 'address_number', 'address_neighborhood', 'address_city', 'address_state', 'condo_features'],
};
const linha = (c: Condominium) => ({ ...c });

const IMOVEL = { id: 'e1', code: 'AP1', title: 'Apê', transaction_type: 'sale', category_type: 'residential', property_type: 'apartment',
  status: 'active', stage: 'ready', listing_kind: 'resale', sale_price: 1, created_at: '', updated_at: '' };

async function escolher(nome: string) {
  await userEvent.click(screen.getByLabelText('Condomínio (opcional)'));
  await userEvent.click(await screen.findByRole('button', { name: new RegExp(nome) }));
}

const titulo = (rotulo: string) => screen.getByLabelText(rotulo).closest('[title]')?.getAttribute('title');

beforeEach(() => {
  vi.clearAllMocks();
  semCondominios.ligado = false;
  globalThis.IntersectionObserver = class { observe() {} disconnect() {} unobserve() {} } as unknown as typeof IntersectionObserver;
  Element.prototype.scrollIntoView = vi.fn();
  svc.get.mockReturnValue(new Promise(() => {}));
  svc.geocode.mockResolvedValue({ failed: true });
  cond.list.mockResolvedValue({ data: [linha(CYRELA), linha(VILA)], meta: { total: 2, page: 1, per_page: 8, cities: [] } });
  cond.get.mockImplementation((id: string) => Promise.resolve(id === 'c2' ? VILA : CYRELA));
});

describe('Condomínio na unidade', () => {
  it('revenda vazia: escolher pluga sem perguntar e trava só o que vem do condomínio', async () => {
    abrir('/properties/new?tipo=revenda');
    await escolher('Cyrela Arti Perdizes');
    expect(await screen.findByRole('button', { name: 'Tirar do condomínio' })).toBeInTheDocument();
    expect(screen.queryByText('Plugar em Cyrela Arti Perdizes?')).not.toBeInTheDocument();
    for (const rotulo of ['CEP', 'Rua', 'Número', 'Bairro', 'Cidade', 'Estado (UF)']) {
      expect(screen.getByLabelText(rotulo)).toBeDisabled();
      expect(titulo(rotulo)).toBe(DICA_DO_CONDOMINIO);
    }
    expect(screen.getByLabelText('Rua')).toHaveValue('Rua Cardoso de Almeida');
    expect(screen.getByLabelText('Complemento')).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Portaria 24h' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Portaria 24h' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Varanda' })).toBeEnabled();
    // Prédio: o alfinete é o do condomínio.
    expect(await screen.findByTestId('mapa')).toHaveAttribute('data-travado', 'true');
    // Aviso com o link pro condomínio, e o mesmo nome nas comodidades.
    const aviso = screen.getAllByText(/Vem do condomínio Cyrela Arti Perdizes\./);
    expect(aviso.length).toBe(2);
    // Editar no condomínio leva a volta para esta unidade (o salvar do condomínio volta pra cá).
    expect(screen.getByRole('link', { name: 'Editar no condomínio' }))
      .toHaveAttribute('href', `/properties/condominios/c1?voltar=${encodeURIComponent('/properties/new?tipo=revenda')}`);
    // Sem mídia escolhida ainda: a primeira foto do condomínio vira a capa.
    expect(screen.getByText('As 8 fotos do condomínio entram no site e nos portais; a primeira vira a capa.')).toBeInTheDocument();
  });

  it('com rua diferente já digitada, pergunta antes; cancelar não pluga', async () => {
    abrir('/properties/new?tipo=revenda');
    await userEvent.type(await screen.findByLabelText('Rua'), 'Rua Minha');
    await escolher('Cyrela Arti Perdizes');
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText('Plugar em Cyrela Arti Perdizes?')).toBeInTheDocument();
    expect(within(dialogo).getByText('O endereço e as comodidades do condomínio substituem os que estão nesta unidade.')).toBeInTheDocument();
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByLabelText('Rua')).toBeEnabled();
    expect(screen.getByLabelText('Rua')).toHaveValue('Rua Minha');
    expect(screen.queryByRole('button', { name: 'Tirar do condomínio' })).not.toBeInTheDocument();
  });

  it('confirmar troca o endereço digitado pelo do condomínio', async () => {
    abrir('/properties/new?tipo=revenda');
    await userEvent.type(await screen.findByLabelText('Rua'), 'Rua Minha');
    await escolher('Cyrela Arti Perdizes');
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Plugar' }));
    await waitFor(() => expect(screen.getByLabelText('Rua')).toHaveValue('Rua Cardoso de Almeida'));
    expect(screen.getByLabelText('Rua')).toBeDisabled();
  });

  it('tirar do condomínio destrava tudo na hora e mantém os valores', async () => {
    abrir('/properties/new?tipo=revenda');
    await escolher('Cyrela Arti Perdizes');
    await userEvent.click(await screen.findByRole('button', { name: 'Tirar do condomínio' }));
    expect(screen.getByLabelText('Rua')).toBeEnabled();
    expect(screen.getByLabelText('Rua')).toHaveValue('Rua Cardoso de Almeida');
    expect(screen.getByLabelText('CEP')).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Portaria 24h' })).toBeEnabled();
    expect(screen.queryByText(/Vem do condomínio Cyrela/)).not.toBeInTheDocument();
    expect(screen.queryByText(/fotos do condomínio entram/)).not.toBeInTheDocument();
  });

  it('trocar de A para B: travas, aviso e fotos passam a ser de B', async () => {
    abrir('/properties/new?tipo=revenda');
    await escolher('Cyrela Arti Perdizes');
    expect(await screen.findByTestId('mapa')).toHaveAttribute('data-travado', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Tirar do condomínio' }));
    await escolher('Vila Verde');
    // A unidade tem o endereço de A, diferente do de B: pergunta.
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Plugar' }));
    expect(await screen.findAllByText(/Vem do condomínio Vila Verde\./)).toHaveLength(2);
    expect(screen.queryByText(/Cyrela/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Rua')).toHaveValue('Rua das Flores');
    expect(screen.getByLabelText('Rua')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Academia' })).toBeDisabled();
    // Condomínio de casas: o alfinete é da unidade, livre e sem texto de "vem do site".
    expect(screen.getByTestId('mapa')).toHaveAttribute('data-travado', 'false');
    expect(screen.queryByText('O ponto no mapa vem do site da imobiliária.')).not.toBeInTheDocument();
    expect(screen.getByText('A foto do condomínio entra no site e nos portais e vira a capa.')).toBeInTheDocument();
  });

  it('empreendimento não tem o campo', async () => {
    abrir('/properties/new?tipo=empreendimento');
    await screen.findByRole('heading', { name: 'Novo empreendimento' });
    expect(screen.queryByLabelText('Condomínio (opcional)')).not.toBeInTheDocument();
  });

  it('leilão tem o campo', async () => {
    abrir('/properties/new?tipo=leilao');
    expect(await screen.findByLabelText('Condomínio (opcional)')).toBeEnabled();
  });

  it('imóvel do site com a fonte ligada: campo desligado com o motivo', async () => {
    svc.get.mockResolvedValue({ ...IMOVEL, feed: { source_id: 's1', external_url: null, locked_fields: ['title'] } });
    abrir('/properties/e1/editar');
    expect(await screen.findByLabelText('Condomínio (opcional)')).toBeDisabled();
    expect(screen.getByText(AVISO_UNIDADE_COM_SITE)).toBeInTheDocument();
  });

  it('servidor sem `condominium` no imóvel: abre normal, sem trava', async () => {
    svc.get.mockResolvedValue({ ...IMOVEL, address_street: 'Rua A' });
    abrir('/properties/e1/editar');
    expect(await screen.findByLabelText('Condomínio (opcional)')).toBeEnabled();
    expect(screen.getByLabelText('Rua')).toBeEnabled();
    expect(screen.queryByText(/Vem do condomínio/)).not.toBeInTheDocument();
  });

  it('unidade já plugada abre plugada e salvar sem mexer não manda o condomínio', async () => {
    svc.get.mockResolvedValue({ ...IMOVEL, address_street: 'Rua Cardoso de Almeida', condominium: {
      id: 'c1', name: 'Cyrela Arti Perdizes', kind: 'vertical', locked_fields: ['address_cep', 'address_street', 'latitude', 'longitude', 'condo_features'], photos_count: 2 } });
    svc.update.mockResolvedValue({ id: 'e1' });
    abrir('/properties/e1/editar');
    expect(await screen.findByRole('button', { name: 'Tirar do condomínio' })).toBeInTheDocument();
    // Trava pela lista do servidor (address_cep = CEP na tela).
    expect(screen.getByLabelText('CEP')).toBeDisabled();
    expect(screen.getByLabelText('Rua')).toBeDisabled();
    expect(screen.getByLabelText('Bairro')).toBeEnabled();
    expect(cond.get).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Editar no condomínio' }))
      .toHaveAttribute('href', `/properties/condominios/c1?voltar=${encodeURIComponent('/properties/e1/editar')}`);
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(svc.update).toHaveBeenCalled());
    // Chave ausente = o servidor mantém: não desfaz um plugar feito em outro lugar.
    expect(svc.update.mock.calls[0][1]).not.toHaveProperty('condominium_id');
  });

  it('aberta sem condomínio, mudar o preço e salvar não manda o condomínio', async () => {
    svc.get.mockResolvedValue({ ...IMOVEL });
    svc.update.mockResolvedValue({ id: 'e1' });
    abrir('/properties/e1/editar');
    const preco = await screen.findByLabelText('Valor de venda');
    await userEvent.clear(preco);
    await userEvent.type(preco, '500000');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(svc.update).toHaveBeenCalled());
    expect(svc.update.mock.calls[0][1]).not.toHaveProperty('condominium_id');
  });

  it('aberta sem condomínio, plugar e salvar manda o condomínio', async () => {
    svc.get.mockResolvedValue({ ...IMOVEL });
    svc.update.mockResolvedValue({ id: 'e1' });
    abrir('/properties/e1/editar');
    await screen.findByLabelText('Condomínio (opcional)');
    await escolher('Cyrela Arti Perdizes');
    await screen.findByRole('button', { name: 'Tirar do condomínio' });
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(svc.update).toHaveBeenCalledWith('e1', expect.objectContaining({ condominium_id: 'c1' })));
  });

  it('criar sem condomínio não manda a chave', async () => {
    svc.create.mockResolvedValue({ id: 'n3', listing_kind: 'resale' });
    abrir('/properties/new?tipo=revenda');
    await userEvent.type(await screen.findByLabelText(/^Título/), 'Apê 53');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    await waitFor(() => expect(svc.create).toHaveBeenCalled());
    expect(svc.create.mock.calls[0][0]).not.toHaveProperty('condominium_id');
  });

  it('tirar e salvar manda sem condomínio', async () => {
    svc.get.mockResolvedValue({ ...IMOVEL, condominium: { id: 'c1', name: 'Cyrela Arti Perdizes', kind: 'vertical', locked_fields: [], photos_count: 0 } });
    svc.update.mockResolvedValue({ id: 'e1' });
    abrir('/properties/e1/editar');
    await userEvent.click(await screen.findByRole('button', { name: 'Tirar do condomínio' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(svc.update).toHaveBeenCalledWith('e1', expect.objectContaining({ condominium_id: null })));
  });

  it('criar plugada manda o condomínio e o endereço dele', async () => {
    svc.create.mockResolvedValue({ id: 'n1', listing_kind: 'resale' });
    abrir('/properties/new?tipo=revenda');
    await userEvent.type(await screen.findByLabelText(/^Título/), 'Apê 52');
    await escolher('Cyrela Arti Perdizes');
    await screen.findByRole('button', { name: 'Tirar do condomínio' });
    await userEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    await waitFor(() => expect(svc.create).toHaveBeenCalledWith(expect.objectContaining({
      condominium_id: 'c1', address_street: 'Rua Cardoso de Almeida', condo_features: ['portaria_24h'],
    })));
  });

  it('Preencher a partir de um texto depois de plugar não mexe no que vem do condomínio', async () => {
    svc.parseText.mockResolvedValue({ address_neighborhood: 'Moema', bedrooms: 2, condo_features: ['brinquedoteca'] });
    svc.create.mockResolvedValue({ id: 'n2', listing_kind: 'resale' });
    abrir('/properties/new?tipo=revenda');
    await userEvent.type(await screen.findByLabelText(/^Título/), 'Apê 52');
    await escolher('Cyrela Arti Perdizes');
    await screen.findByRole('button', { name: 'Tirar do condomínio' });
    await userEvent.click(screen.getByText('Preencher a partir de um texto'));
    await userEvent.type(screen.getByPlaceholderText(/Cole aqui as informações do imóvel/), 'Apê com brinquedoteca em Moema, 2 quartos');
    await userEvent.click(screen.getByRole('button', { name: /^Preencher$/ }));
    await waitFor(() => expect(screen.getByLabelText('Quartos')).toHaveValue(2));
    expect(screen.getByLabelText('Bairro')).toHaveValue('Perdizes');
    expect(screen.getByRole('button', { name: 'Brinquedoteca' })).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    await waitFor(() => expect(svc.create).toHaveBeenCalledWith(expect.objectContaining({
      condo_features: ['portaria_24h'], address_neighborhood: 'Perdizes',
    })));
  });

  it('volta do "+ Cadastrar condomínio" (?condominio=) já pluga e limpa o endereço', async () => {
    abrir('/properties/new?tipo=revenda&condominio=c1');
    expect(await screen.findByRole('button', { name: 'Tirar do condomínio' })).toBeInTheDocument();
    expect(cond.get).toHaveBeenCalledWith('c1');
    await waitFor(() => expect(screen.getByTestId('onde')).toHaveTextContent(/^\/properties\/new\?tipo=revenda$/));
    expect(cond.get).toHaveBeenCalledTimes(1);
  });

  it('plugada e com a fonte do site religada: o site vence campo a campo e ainda dá pra tirar', async () => {
    svc.get.mockResolvedValue({ ...IMOVEL,
      feed: { source_id: 's1', external_url: null, locked_fields: ['address_city', 'title'] },
      condominium: { id: 'c1', name: 'Cyrela Arti Perdizes', kind: 'vertical', locked_fields: [], photos_count: 0 } });
    abrir('/properties/e1/editar');
    expect(await screen.findByRole('button', { name: 'Tirar do condomínio' })).toBeEnabled();
    expect(titulo('Cidade')).toBe(DICA_DO_CAMPO);
    expect(titulo('Rua')).toBe(DICA_DO_CONDOMINIO);
    expect(screen.getByText(/O que vem de lá fica travado/)).toBeInTheDocument();
  });

  it('sem a permissão de condomínios: pluga, mas sem cadastrar nem editar condomínio', async () => {
    semCondominios.ligado = true;
    abrir('/properties/new?tipo=revenda');
    expect(await screen.findByLabelText('Condomínio (opcional)')).toBeEnabled();
    expect(screen.queryByRole('link', { name: '+ Cadastrar condomínio' })).not.toBeInTheDocument();
    await escolher('Cyrela Arti Perdizes');
    expect(await screen.findAllByText(/Vem do condomínio Cyrela Arti Perdizes\./)).toHaveLength(2);
    expect(screen.queryByRole('link', { name: 'Editar no condomínio' })).not.toBeInTheDocument();
  });
});
