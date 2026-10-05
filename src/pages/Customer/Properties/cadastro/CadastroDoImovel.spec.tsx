import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const svc = vi.hoisted(() => ({ get: vi.fn(), create: vi.fn(), update: vi.fn(), uploadBook: vi.fn() }));
vi.mock('@/services/properties/propertiesService', async importOriginal => {
  const real = await importOriginal<typeof import('@/services/properties/propertiesService')>();
  return { ...real, propertiesService: { ...real.propertiesService, ...svc } };
});
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } }));
import { toast } from 'sonner';
// Funções do cliente: todas ligadas, salvo as que o teste desligar.
const desligadas = vi.hoisted(() => new Set<string>());
vi.mock('@/contexts/TenantFeaturesContext', () => ({ useFeature: (k: string) => !desligadas.has(k) }));
vi.mock('@/services/contacts/labelsService', () => ({ labelsService: { getLabels: () => Promise.resolve({ data: [] }) } }));
vi.mock('@/services/users/usersService', () => ({ default: { getUsers: () => Promise.resolve({ data: [] }) } }));
vi.mock('@/services/portals/portalsService', () => ({ portalsService: { list: () => Promise.resolve([]), get: vi.fn() } }));
const own = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/services/propertyOwners/propertyOwnersService', () => ({ propertyOwnersService: { list: () => Promise.resolve({ data: [], meta: { total: 0 } }), get: own.get } }));
// Leaflet não roda no jsdom: o mapa vira um botão que "arrasta" o alfinete.
vi.mock('./secoes/MapaDoCadastro', () => ({
  default: ({ aoArrastar }: { aoArrastar: (lat: number, lng: number) => void }) => (
    <button type="button" onClick={() => aoArrastar(-22.91, -47.07)}>arrastar alfinete</button>
  ),
}));

import CadastroDoImovel from './CadastroDoImovel';
import { NO_ACCESS_MESSAGE } from '@/components/permissions/noAccessCopy';

function Onde() { const l = useLocation(); return <p data-testid="onde">{l.pathname}{l.search}</p>; }
// O endereço fica sempre à vista (fora das rotas): depois de "Criar" a página
// vai para /properties/:id/editar, que é ela mesma de novo.
function abrir(url: string) {
  return render(<MemoryRouter initialEntries={[url]}><Routes>
    <Route path="/properties/new" element={<CadastroDoImovel />} />
    <Route path="/properties/:id/editar" element={<CadastroDoImovel />} />
    <Route path="*" element={null} />
  </Routes><Onde /></MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  desligadas.clear();
  // jsdom não tem IntersectionObserver nem scrollIntoView
  globalThis.IntersectionObserver = class { observe() {} disconnect() {} unobserve() {} } as unknown as typeof IntersectionObserver;
  Element.prototype.scrollIntoView = vi.fn();
  // Edição aberta sem imóvel combinado no teste fica carregando.
  svc.get.mockReturnValue(new Promise(() => {}));
});

describe('CadastroDoImovel', () => {
  it('empreendimento com book escolhido: sobe o book depois do create', async () => {
    svc.create.mockResolvedValue({ id: 'b1', listing_kind: 'development' });
    svc.uploadBook.mockResolvedValue({ id: 'b1' });
    abrir('/properties/new?tipo=empreendimento');
    await userEvent.type(await screen.findByLabelText('Nome do empreendimento'), 'Residencial');
    const book = new File(['x'], 'book.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByTestId('entrada-do-book'), { target: { files: [book] } });
    expect(await screen.findByText('book.pdf')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    await waitFor(() => expect(svc.uploadBook).toHaveBeenCalledWith('b1', book));
    expect(svc.create.mock.invocationCallOrder[0]).toBeLessThan(svc.uploadBook.mock.invocationCallOrder[0]);
  });

  it('book que falha ao subir avisa e a navegação segue', async () => {
    svc.create.mockResolvedValue({ id: 'b2', listing_kind: 'development' });
    svc.uploadBook.mockRejectedValue(new Error('falhou'));
    abrir('/properties/new?tipo=empreendimento');
    await userEvent.type(await screen.findByLabelText('Nome do empreendimento'), 'Residencial');
    fireEvent.change(screen.getByTestId('entrada-do-book'), { target: { files: [new File(['x'], 'book.pdf', { type: 'application/pdf' })] } });
    await userEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith('Imóvel cadastrado, mas o book não subiu. Suba de novo na edição do imóvel.'));
    expect(screen.getByTestId('onde')).toHaveTextContent('/properties?aba=empreendimentos');
  });

  it('create que falha não sobe o book e o arquivo continua escolhido', async () => {
    svc.create.mockRejectedValue(new Error('x'));
    abrir('/properties/new?tipo=empreendimento');
    await userEvent.type(await screen.findByLabelText('Nome do empreendimento'), 'Residencial');
    fireEvent.change(screen.getByTestId('entrada-do-book'), { target: { files: [new File(['x'], 'book.pdf', { type: 'application/pdf' })] } });
    await userEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    await waitFor(() => expect(svc.create).toHaveBeenCalled());
    expect(svc.uploadBook).not.toHaveBeenCalled();
    expect(screen.getByText('book.pdf')).toBeInTheDocument();
  });

  it('empreendimento novo: título, índice do tipo e botões da criação', async () => {
    abrir('/properties/new?tipo=empreendimento');
    expect(await screen.findByRole('heading', { name: 'Novo empreendimento' })).toBeInTheDocument();
    const indice = screen.getByRole('navigation', { name: 'Seções do cadastro' });
    expect(indice).toHaveTextContent('Construtora');
    expect(indice).not.toHaveTextContent('Proprietário');
    expect(screen.getByRole('button', { name: 'Salvar rascunho' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Criar e escolher onde divulgar →' })).toBeInTheDocument();
  });

  it('criar sem título rola até Básico e não chama o servidor', async () => {
    abrir('/properties/new?tipo=revenda');
    await userEvent.click(await screen.findByRole('button', { name: 'Criar e escolher onde divulgar →' }));
    expect(svc.create).not.toHaveBeenCalled();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Básico' })).toHaveAttribute('aria-current', 'true');
  });

  it('criar com sucesso vai para o passo de divulgar', async () => {
    svc.create.mockResolvedValue({ id: 'n1', listing_kind: 'resale' });
    abrir('/properties/new?tipo=revenda');
    await userEvent.type(await screen.findByLabelText('Título'), 'Casa no Cambuí');
    await userEvent.type(screen.getByLabelText('Valor de venda'), '500000');
    await userEvent.click(screen.getByRole('button', { name: 'Criar e escolher onde divulgar →' }));
    await waitFor(() => expect(screen.getByTestId('onde')).toHaveTextContent('/properties/n1/editar?passo=divulgar'));
  });

  it('?proprietario= na revenda cria com o proprietário escolhido', async () => {
    own.get.mockResolvedValue({ id: 'o1', name: 'Maria Souza', phone: null, properties: [], history: [] });
    svc.create.mockResolvedValue({ id: 'n3', listing_kind: 'resale' });
    abrir('/properties/new?tipo=revenda&proprietario=o1');
    expect(await screen.findByText('Maria Souza')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Título'), 'Casa');
    await userEvent.type(screen.getByLabelText('Valor de venda'), '500000');
    await userEvent.click(screen.getByRole('button', { name: 'Criar e escolher onde divulgar →' }));
    await waitFor(() => expect(svc.create).toHaveBeenCalledWith(expect.objectContaining({ owner_id: 'o1' })));
  });

  it('?proprietario= no empreendimento é ignorado', async () => {
    svc.create.mockResolvedValue({ id: 'n4', listing_kind: 'development' });
    abrir('/properties/new?tipo=empreendimento&proprietario=o1');
    await userEvent.type(await screen.findByLabelText('Nome do empreendimento'), 'Residencial');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    await waitFor(() => expect(svc.create).toHaveBeenCalled());
    expect(svc.create.mock.calls[0][0].owner_id ?? null).toBeNull();
    expect(own.get).not.toHaveBeenCalled();
  });

  it('salvar rascunho cria como draft e volta para a lista', async () => {
    svc.create.mockResolvedValue({ id: 'n2', listing_kind: 'resale' });
    abrir('/properties/new?tipo=revenda');
    await userEvent.type(await screen.findByLabelText('Título'), 'Rascunho');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    await waitFor(() => expect(svc.create).toHaveBeenCalledWith(expect.objectContaining({ status: 'draft' })));
    expect(screen.getByTestId('onde')).toHaveTextContent('/properties?aba=revenda');
  });

  it('edição carrega, salva sem mudar o tipo e volta para o lote quando veio dele', async () => {
    svc.get.mockResolvedValue({ id: 'e1', code: 'AP1', title: 'Apê', transaction_type: 'sale', category_type: 'residential',
      property_type: 'apartment', status: 'active', stage: 'ready', listing_kind: 'resale', sale_price: 1, created_at: '', updated_at: '' });
    svc.update.mockResolvedValue({ id: 'e1', listing_kind: 'resale' });
    abrir('/properties/e1/editar?de=lote');
    expect(await screen.findByRole('heading', { name: 'Editar imóvel' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Seções do cadastro' })).toHaveTextContent('Onde divulgar');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(svc.update).toHaveBeenCalledWith('e1', expect.not.objectContaining({ listing_kind: expect.anything() })));
    expect(screen.getByTestId('onde')).toHaveTextContent('/properties?aba=revenda&importar=1');
    const enviado = svc.update.mock.calls[0][1];
    expect(enviado).not.toHaveProperty('featured');
    expect(enviado).not.toHaveProperty('published_on_site');
    expect(enviado).not.toHaveProperty('ai_enabled');
  });

  it('arrastar o alfinete e salvar manda o ponto e a origem manual, sem metadata', async () => {
    svc.get.mockResolvedValue({ id: 'e2', code: 'AP3', title: 'Casa', transaction_type: 'sale', category_type: 'residential',
      property_type: 'house', status: 'active', stage: 'ready', listing_kind: 'resale', sale_price: 1, created_at: '', updated_at: '',
      address_street: 'Rua A', address_number: '1', address_city: 'Campinas', address_state: 'SP',
      latitude: -22.9, longitude: -47.06, location_source: 'auto', metadata: { location_source: 'auto', outra: 1 } });
    svc.update.mockResolvedValue({ id: 'e2', listing_kind: 'resale' });
    abrir('/properties/e2/editar');
    await userEvent.click(await screen.findByRole('button', { name: 'arrastar alfinete' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(svc.update).toHaveBeenCalledWith('e2', expect.objectContaining({
      latitude: -22.91, longitude: -47.07, location_source: 'manual',
    })));
    expect(svc.update.mock.calls[0][1]).not.toHaveProperty('metadata');
  });

  it('editar um rascunho sem preço salva (o preço só é exigido fora do rascunho)', async () => {
    svc.get.mockResolvedValue({ id: 'r1', code: 'AP2', title: 'Rascunho sem preço', transaction_type: 'sale', category_type: 'residential',
      property_type: 'apartment', status: 'draft', stage: 'ready', listing_kind: 'resale', created_at: '', updated_at: '' });
    svc.update.mockResolvedValue({ id: 'r1', listing_kind: 'resale' });
    abrir('/properties/r1/editar');
    expect(await screen.findByRole('heading', { name: 'Editar imóvel' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(svc.update).toHaveBeenCalledWith('r1', expect.anything()));
  });

  it('empreendimento chama o título de Nome do empreendimento; revenda segue Título', async () => {
    abrir('/properties/new?tipo=empreendimento');
    expect(await screen.findByLabelText('Nome do empreendimento')).toBeInTheDocument();
    expect(screen.queryByLabelText('Título')).toBeNull();
  });

  it('?passo=divulgar mostra só o Onde divulgar, sem o formulário nem a barra', async () => {
    svc.get.mockResolvedValue({ id: 'e1', code: 'AP1', title: 'Apê do passo', transaction_type: 'sale', category_type: 'residential',
      property_type: 'apartment', status: 'active', stage: 'ready', listing_kind: 'resale', sale_price: 1, created_at: '', updated_at: '' });
    abrir('/properties/e1/editar?passo=divulgar');
    expect(await screen.findByRole('heading', { name: 'Onde divulgar' })).toBeInTheDocument();
    expect(screen.getByText('Apê do passo')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Publicar no site' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Título')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Salvar' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Concluir' }));
    await waitFor(() => expect(screen.getByTestId('onde')).toHaveTextContent('/properties?aba=revenda'));
  });

  it('cancelar com alteração pergunta antes', async () => {
    abrir('/properties/new?tipo=revenda');
    await userEvent.type(await screen.findByLabelText('Título'), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(await screen.findByText('Sair sem salvar?')).toBeInTheDocument();
  });
});

// Vieram de telaImoveis.spec.tsx: eram da janela de cadastro, que virou esta página.
describe('CadastroDoImovel: campos por tipo (herdados da janela)', () => {
  it('empreendimento mostra fase da obra, previsão e tipologias', async () => {
    abrir('/properties/new?tipo=empreendimento');
    expect(await screen.findByText('Fase da obra')).toBeInTheDocument();
    expect(screen.getByText('Previsão de entrega')).toBeInTheDocument();
    expect(screen.getByText('Tipologias do empreendimento')).toBeInTheDocument();
  });

  it('revenda mostra a finalidade e esconde fase, previsão e tipologias', async () => {
    abrir('/properties/new?tipo=revenda');
    expect(await screen.findByRole('radiogroup', { name: 'Finalidade' })).toBeInTheDocument();
    expect(screen.queryByText('Fase da obra')).toBeNull();
    expect(screen.queryByText('Previsão de entrega')).toBeNull();
    expect(screen.queryByText('Tipologias do empreendimento')).toBeNull();
  });

  it('editar empreendimento salvo como locação mostra Valor de venda e a situação antiga', async () => {
    svc.get.mockResolvedValue({ id: 'd1', code: 'EM1', title: 'Vista', transaction_type: 'rent', category_type: 'residential',
      property_type: 'apartment', status: 'reserved', stage: 'ready', listing_kind: 'development', created_at: '', updated_at: '' });
    abrir('/properties/d1/editar');
    expect(await screen.findByLabelText('Valor de venda')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Reservado' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'À venda' })).toBeInTheDocument();
  });

  it('previsão de entrega em mês e ano: dez + 2027 salva 2027-12', async () => {
    svc.create.mockResolvedValue({ id: 'n1', listing_kind: 'development' });
    abrir('/properties/new?tipo=empreendimento');
    fireEvent.change(await screen.findByRole('combobox', { name: 'Mês da previsão de entrega' }), { target: { value: '12' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Ano da previsão de entrega' }), { target: { value: '2027' } });
    fireEvent.change(screen.getByPlaceholderText('450000'), { target: { value: '389900' } });
    fireEvent.change(screen.getByPlaceholderText('Ex: Apartamento 3 quartos - Jardim Europa'), { target: { value: 'Vista Taquaral' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar e escolher onde divulgar →' }));
    await waitFor(() => expect(svc.create).toHaveBeenCalledWith(expect.objectContaining({ delivery_forecast: '2027-12', stage: 'launch' })));
  });

  it('só o mês, sem ano, não é previsão', async () => {
    svc.create.mockResolvedValue({ id: 'n1', listing_kind: 'development' });
    abrir('/properties/new?tipo=empreendimento');
    const mes = await screen.findByRole('combobox', { name: 'Mês da previsão de entrega' });
    fireEvent.change(mes, { target: { value: '12' } });
    expect(mes).toHaveValue('12');
    fireEvent.change(screen.getByPlaceholderText('450000'), { target: { value: '389900' } });
    fireEvent.change(screen.getByPlaceholderText('Ex: Apartamento 3 quartos - Jardim Europa'), { target: { value: 'Vista Taquaral' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar e escolher onde divulgar →' }));
    await waitFor(() => expect(svc.create).toHaveBeenCalledWith(expect.objectContaining({ delivery_forecast: null })));
  });

  it('tipologia em branco não vai para o servidor', async () => {
    svc.create.mockResolvedValue({ id: 'n1', listing_kind: 'development' });
    abrir('/properties/new?tipo=empreendimento');
    await userEvent.click(await screen.findByRole('button', { name: /Adicionar tipologia/ }));
    fireEvent.change(screen.getByPlaceholderText('450000'), { target: { value: '389900' } });
    fireEvent.change(screen.getByPlaceholderText('Ex: Apartamento 3 quartos - Jardim Europa'), { target: { value: 'Vista Taquaral' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar e escolher onde divulgar →' }));
    await waitFor(() => expect(svc.create).toHaveBeenCalledWith(expect.objectContaining({ typologies: [] })));
  });
});

// IntersectionObserver de mentira que o teste comanda: diz quais seções entraram na faixa.
function observadorComandado() {
  const vivos: Array<{ cb: IntersectionObserverCallback }> = [];
  globalThis.IntersectionObserver = class {
    cb: IntersectionObserverCallback;
    constructor(cb: IntersectionObserverCallback) { this.cb = cb; vivos.push(this); }
    observe() {} disconnect() {} unobserve() {}
  } as unknown as typeof IntersectionObserver;
  return (entram: string[], saem: string[] = []) => act(() => {
    const entradas = [
      ...entram.map(id => ({ target: document.getElementById(`secao-${id}`)!, isIntersecting: true })),
      ...saem.map(id => ({ target: document.getElementById(`secao-${id}`)!, isIntersecting: false })),
    ] as unknown as IntersectionObserverEntry[];
    vivos.forEach(o => o.cb(entradas, o as unknown as IntersectionObserver));
  });
}

describe('CadastroDoImovel: índice e erros', () => {
  it('erro numa seção do meio marca essa seção no índice', async () => {
    abrir('/properties/new?tipo=revenda');
    await userEvent.type(await screen.findByLabelText('Título'), 'Casa no Cambuí');
    await userEvent.click(screen.getByRole('button', { name: 'Criar e escolher onde divulgar →' }));
    expect(svc.create).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Valores' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('link', { name: 'Básico' })).not.toHaveAttribute('aria-current');
  });

  it('depois do erro, rolar a página devolve o índice à rolagem', async () => {
    const mostrar = observadorComandado();
    const agora = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    abrir('/properties/new?tipo=revenda');
    await userEvent.type(await screen.findByLabelText('Título'), 'Casa no Cambuí');
    await userEvent.click(screen.getByRole('button', { name: 'Criar e escolher onde divulgar →' }));
    expect(screen.getByRole('link', { name: 'Valores' })).toHaveAttribute('aria-current', 'true');

    // Ainda rolando até o erro: a seção do erro continua marcada.
    mostrar(['localizacao']);
    expect(screen.getByRole('link', { name: 'Valores' })).toHaveAttribute('aria-current', 'true');

    // A pessoa rola depois: o índice volta a acompanhar.
    agora.mockReturnValue(1_002_000);
    mostrar(['equipe'], ['localizacao']);
    expect(screen.getByRole('link', { name: 'Equipe' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('link', { name: 'Valores' })).not.toHaveAttribute('aria-current');
  });

  it('empreendimento tem o resumo de composição em Tipologias e valores', async () => {
    abrir('/properties/new?tipo=empreendimento');
    const tipologias = await screen.findByRole('region', { name: 'Tipologias e valores' });
    expect(within(tipologias).getByText('Resumo do empreendimento (aparece no cartão e nos filtros)')).toBeInTheDocument();
    expect(within(tipologias).getByText('Quartos')).toBeInTheDocument();
    expect(within(tipologias).getByText('Área total (m²)')).toBeInTheDocument();
  });

  it('sem a função de cadastrar ligada, /properties/new não abre e não cria', async () => {
    desligadas.add('properties_create');
    abrir('/properties/new?tipo=revenda');
    expect(await screen.findByText(NO_ACCESS_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Novo imóvel' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Criar e escolher onde divulgar →' })).toBeNull();
    expect(svc.create).not.toHaveBeenCalled();
  });

  it('sem a função de cadastrar, a edição continua abrindo', async () => {
    desligadas.add('properties_create');
    svc.get.mockResolvedValue({ id: 'e1', code: 'AP1', title: 'Apê', transaction_type: 'sale', category_type: 'residential',
      property_type: 'apartment', status: 'active', stage: 'ready', listing_kind: 'resale', sale_price: 1, created_at: '', updated_at: '' });
    abrir('/properties/e1/editar');
    expect(await screen.findByRole('heading', { name: 'Editar imóvel' })).toBeInTheDocument();
  });
});
