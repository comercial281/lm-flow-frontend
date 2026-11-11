import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { Condominium } from '@/services/condominiums/condominiumsService';

const svc = vi.hoisted(() => ({
  get: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), list: vi.fn(),
  fotos: { list: vi.fn(), upload: vi.fn() },
}));
vi.mock('@/services/condominiums/condominiumsService', async importOriginal => {
  const real = await importOriginal<typeof import('@/services/condominiums/condominiumsService')>();
  return { ...real, condominiumsService: svc };
});
const geo = vi.hoisted(() => ({ cepLookup: vi.fn(), geocode: vi.fn() }));
vi.mock('@/services/properties/propertiesService', async importOriginal => {
  const real = await importOriginal<typeof import('@/services/properties/propertiesService')>();
  return { ...real, propertiesService: { ...real.propertiesService, ...geo } };
});
vi.mock('../cadastro/secoes/MapaDoCadastro', () => ({
  default: ({ travado }: { travado?: boolean }) => <div data-testid="mapa" data-travado={String(!!travado)} />,
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }));
import { toast } from 'sonner';
const permitido = vi.hoisted(() => ({ fn: (_r: string, _a: string) => true }));
vi.mock('@/hooks/useCan', () => ({ useCan: () => (r: string, a: string) => permitido.fn(r, a) }));

import CadastroDoCondominio from './CadastroDoCondominio';
import { NO_ACCESS_MESSAGE } from '@/components/permissions/noAccessCopy';

function Onde() { const l = useLocation(); return <p data-testid="onde">{l.pathname}{l.search}</p>; }
function abrir(url: string) {
  return render(<MemoryRouter initialEntries={[url]}><Routes>
    <Route path="/properties/condominios/novo" element={<CadastroDoCondominio />} />
    <Route path="/properties/condominios/:id" element={<CadastroDoCondominio />} />
    <Route path="*" element={null} />
  </Routes><Onde /></MemoryRouter>);
}

const condominio = (extra: Partial<Condominium> = {}) => ({
  id: 'c1', name: 'Edifício Sol', kind: 'vertical', address_street: 'Rua A', address_number: '10',
  address_neighborhood: 'Centro', address_city: 'Santos', address_state: 'SP', address_cep: '11000-000',
  address_complement: null, latitude: -23.9, longitude: -46.3, location_source: 'auto', condo_features: ['academia'],
  builder_name: null, developer_name: null, administrator_name: null, year_built: null, internal_note: null,
  contacts: [], locked_fields: [], photos_count: 0, units: [], units_count: 0, for_sale_count: 0, sold_count: 0,
  updated_at: '', cover_photo_url: null, ...extra,
}) as Condominium;

const seis = Array.from({ length: 6 }, (_, i) => ({
  id: `u${i + 1}`, code: `AP0${i + 1}`, title: `Apto ${i + 1}`, status: 'active', listing_kind: 'resale',
}));

beforeEach(() => {
  vi.clearAllMocks();
  permitido.fn = () => true;
  globalThis.IntersectionObserver = class { observe() {} disconnect() {} unobserve() {} } as unknown as typeof IntersectionObserver;
  Element.prototype.scrollIntoView = vi.fn();
  geo.geocode.mockResolvedValue({ lat: null, lng: null, precision: null, failed: false });
  svc.fotos.list.mockResolvedValue([]);
  svc.get.mockReturnValue(new Promise(() => {}));
});

async function preencherBasico() {
  await userEvent.type(screen.getByLabelText('Nome do condomínio'), 'Edifício Lua');
  await userEvent.type(screen.getByLabelText('Rua'), 'Rua B');
  await userEvent.type(screen.getByLabelText('Cidade'), 'Santos');
  await userEvent.type(screen.getByLabelText('Estado (UF)'), 'SP');
}

describe('CadastroDoCondominio', () => {
  it('cria com nome, endereço, 2 comodidades e um contato e abre o cadastro do condomínio', async () => {
    svc.create.mockResolvedValue(condominio({ id: 'c9' }));
    abrir('/properties/condominios/novo');
    await preencherBasico();
    await userEvent.click(screen.getByRole('button', { name: 'Academia' }));
    await userEvent.click(screen.getByRole('button', { name: 'Piscina' }));
    await userEvent.click(screen.getByRole('button', { name: '+ Adicionar contato' }));
    await userEvent.type(screen.getByLabelText('Nome do contato'), 'Seu Zé');
    await userEvent.selectOptions(screen.getByLabelText('Cargo do contato'), 'sindico');
    await userEvent.type(screen.getByLabelText('Telefone do contato'), '13999990000');
    await userEvent.click(screen.getByRole('button', { name: 'Criar condomínio' }));
    await waitFor(() => expect(svc.create).toHaveBeenCalledTimes(1));
    expect(svc.create).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Edifício Lua', kind: 'vertical', address_street: 'Rua B', address_city: 'Santos', address_state: 'SP',
      condo_features: ['academia', 'piscina_condominio'],
      contacts: [{ name: 'Seu Zé', role: 'sindico', phone: '13999990000', email: '' }],
    }));
    expect(svc.create.mock.calls[0][0]).not.toHaveProperty('address_zip');
    await waitFor(() => expect(screen.getByTestId('onde')).toHaveTextContent('/properties/condominios/c9'));
  });

  it('salvar sem nome avisa e não cria', async () => {
    abrir('/properties/condominios/novo');
    await userEvent.type(screen.getByLabelText('Rua'), 'Rua B');
    await userEvent.click(screen.getByRole('button', { name: 'Criar condomínio' }));
    expect(toast.error).toHaveBeenCalledWith('Dê um nome ao condomínio.');
    expect(svc.create).not.toHaveBeenCalled();
  });

  it('erro do servidor mostra a mensagem dele', async () => {
    svc.create.mockRejectedValue({ response: { status: 422, data: { error: { code: 'invalid', message: 'Já existe um condomínio com esse nome.' } } } });
    abrir('/properties/condominios/novo');
    await preencherBasico();
    await userEvent.click(screen.getByRole('button', { name: 'Criar condomínio' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Já existe um condomínio com esse nome.'));
  });

  it('criado a partir do cadastro da unidade volta pra ela com o condomínio', async () => {
    svc.create.mockResolvedValue(condominio({ id: 'c9' }));
    abrir('/properties/condominios/novo?voltar=%2Fproperties%2Fp1%2Feditar');
    await preencherBasico();
    await userEvent.click(screen.getByRole('button', { name: 'Criar condomínio' }));
    await waitFor(() => expect(screen.getByTestId('onde')).toHaveTextContent('/properties/p1/editar?condominio=c9'));
  });

  it('Cancelar com voltar volta pro cadastro da unidade', async () => {
    abrir('/properties/condominios/novo?voltar=%2Fproperties%2Fp1%2Feditar');
    await screen.findByLabelText('Nome do condomínio');
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByTestId('onde')).toHaveTextContent('/properties/p1/editar');
  });

  it('voltar para fora do LM Flow é ignorado', async () => {
    svc.create.mockResolvedValue(condominio({ id: 'c9' }));
    abrir('/properties/condominios/novo?voltar=https%3A%2F%2Fx');
    await preencherBasico();
    await userEvent.click(screen.getByRole('button', { name: 'Criar condomínio' }));
    await waitFor(() => expect(screen.getByTestId('onde')).toHaveTextContent('/properties/condominios/c9'));
  });

  it('fotos escolhidas na criação sobem depois de criar', async () => {
    svc.create.mockResolvedValue(condominio({ id: 'c9' }));
    svc.fotos.upload.mockResolvedValue([]);
    abrir('/properties/condominios/novo');
    await preencherBasico();
    const foto = new File(['x'], 'piscina.jpg', { type: 'image/jpeg' });
    await userEvent.upload(screen.getByLabelText('Escolher fotos das áreas comuns'), foto);
    expect(screen.getByText('piscina.jpg')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Criar condomínio' }));
    await waitFor(() => expect(svc.fotos.upload).toHaveBeenCalledWith('c9', [foto]));
  });

  it('edição com 6 unidades avisa e lista as unidades com link pro cadastro', async () => {
    svc.get.mockResolvedValue(condominio({ units: seis, units_count: 6 }));
    abrir('/properties/condominios/c1');
    expect(await screen.findByText('Mudanças aqui valem para as 6 unidades plugadas.')).toBeInTheDocument();
    const unidades = screen.getByRole('region', { name: 'Unidades plugadas' });
    expect(within(unidades).getAllByRole('link')).toHaveLength(6);
    expect(within(unidades).getByRole('link', { name: /AP01/ })).toHaveAttribute('href', '/properties/u1/editar');
    expect(within(unidades).getAllByText('Disponível').length).toBeGreaterThan(0);
  });

  it('edição sem unidades: vazio na seção e sem aviso', async () => {
    svc.get.mockResolvedValue(condominio());
    abrir('/properties/condominios/c1');
    expect(await screen.findByText('Nenhuma unidade plugada. Plugue pelo cadastro do imóvel, em Localização.')).toBeInTheDocument();
    expect(screen.queryByText(/Mudanças aqui valem/)).toBeNull();
  });

  it('salvar a edição manda o CEP com o nome do servidor', async () => {
    svc.get.mockResolvedValue(condominio());
    svc.update.mockResolvedValue(condominio());
    abrir('/properties/condominios/c1');
    const nome = await screen.findByLabelText('Nome do condomínio');
    await userEvent.clear(nome);
    await userEvent.type(nome, 'Edifício Sol Nascente');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(svc.update).toHaveBeenCalledWith('c1', expect.objectContaining({ name: 'Edifício Sol Nascente', address_cep: '11000-000' })));
  });

  it('salvar a edição sem voltar volta pra aba de Condomínios', async () => {
    svc.get.mockResolvedValue(condominio());
    svc.update.mockResolvedValue(condominio());
    abrir('/properties/condominios/c1');
    await screen.findByLabelText('Nome do condomínio');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(screen.getByTestId('onde')).toHaveTextContent('/properties?aba=condominios'));
  });

  it('salvar a edição aberta de "Editar no condomínio" volta pra unidade', async () => {
    svc.get.mockResolvedValue(condominio());
    svc.update.mockResolvedValue(condominio());
    abrir('/properties/condominios/c1?voltar=%2Fproperties%2Fp1%2Feditar');
    await screen.findByLabelText('Nome do condomínio');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(svc.update).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId('onde')).toHaveTextContent(/^\/properties\/p1\/editar$/));
  });

  it('condomínio que não existe (404): "Condomínio não encontrado" com a volta, não "sem acesso"', async () => {
    svc.get.mockRejectedValue({ response: { status: 404 } });
    abrir('/properties/condominios/zz');
    expect(await screen.findByText('Condomínio não encontrado')).toBeInTheDocument();
    expect(screen.queryByText(NO_ACCESS_MESSAGE)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Voltar para Condomínios' }));
    expect(screen.getByTestId('onde')).toHaveTextContent('/properties?aba=condominios');
  });

  it('recusa por cargo (403) continua "sem acesso"', async () => {
    svc.get.mockRejectedValue({ response: { status: 403 } });
    abrir('/properties/condominios/c1');
    expect(await screen.findByText(NO_ACCESS_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText('Condomínio não encontrado')).toBeNull();
  });

  it('excluir pede confirmação com os textos e volta pra aba', async () => {
    svc.get.mockResolvedValue(condominio({ units: seis, units_count: 6 }));
    svc.remove.mockResolvedValue(undefined);
    abrir('/properties/condominios/c1');
    await screen.findByText('Mudanças aqui valem para as 6 unidades plugadas.');
    await userEvent.click(screen.getByRole('button', { name: 'Mais ações' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /Excluir condomínio/ }));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText('Excluir o condomínio Edifício Sol?')).toBeInTheDocument();
    expect(within(dialogo).getByText('As 6 unidades plugadas ficam com o endereço e as comodidades de hoje e passam a ser editadas nelas.')).toBeInTheDocument();
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Excluir' }));
    await waitFor(() => expect(svc.remove).toHaveBeenCalledWith('c1'));
    await waitFor(() => expect(screen.getByTestId('onde')).toHaveTextContent('/properties?aba=condominios'));
  });

  it('sem condominiums.manage: só leitura, sem Salvar, Excluir nem Gerenciar fotos', async () => {
    permitido.fn = (r, a) => !(r === 'condominiums' && a === 'manage');
    svc.get.mockResolvedValue(condominio({ photos_count: 2 }));
    abrir('/properties/condominios/c1');
    expect(await screen.findByLabelText('Nome do condomínio')).toBeDisabled();
    expect(screen.getByLabelText('Rua')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Academia' })).toBeDisabled();
    expect(await screen.findByTestId('mapa')).toHaveAttribute('data-travado', 'true');
    expect(screen.queryByRole('button', { name: 'Salvar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mais ações' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Gerenciar fotos/ })).toBeNull();
    expect(screen.queryByRole('button', { name: '+ Adicionar contato' })).toBeNull();
  });

  it('sem condominiums.manage não abre o cadastro novo', () => {
    permitido.fn = (r, a) => !(r === 'condominiums' && a === 'manage');
    abrir('/properties/condominios/novo');
    expect(screen.queryByLabelText('Nome do condomínio')).toBeNull();
  });

  it('Gerenciar fotos leva à página de fotos do condomínio', async () => {
    svc.get.mockResolvedValue(condominio({ photos_count: 2 }));
    abrir('/properties/condominios/c1');
    await userEvent.click(await screen.findByRole('button', { name: /Gerenciar fotos/ }));
    expect(screen.getByTestId('onde')).toHaveTextContent('/properties/condominios/c1/fotos');
  });

  it('remover contato tem nome e tira a linha', async () => {
    svc.get.mockResolvedValue(condominio({ contacts: [{ name: 'Seu Zé', role: 'zelador', phone: '1', email: '' }] }));
    abrir('/properties/condominios/c1');
    await userEvent.click(await screen.findByRole('button', { name: 'Remover contato Seu Zé' }));
    expect(screen.queryByDisplayValue('Seu Zé')).toBeNull();
  });
});
