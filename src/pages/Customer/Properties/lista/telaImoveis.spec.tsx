// src/pages/Customer/Properties/lista/telaImoveis.spec.tsx
// A tela de Imóveis inteira, com o serviço de imóveis falso: abas com a
// contagem, aba padrão, troca de aba, aba vazia e a visão Mapa.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Link, MemoryRouter, useLocation } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import type { Property } from '@/services/properties/propertiesService';

const svc = vi.hoisted(() => ({
  list: vi.fn(),
  contarPorTipo: vi.fn(),
  facets: vi.fn(),
  update: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  confirmarEmDia: vi.fn(),
}));

vi.mock('@/services/properties/propertiesService', async importOriginal => {
  const real = await importOriginal<typeof import('@/services/properties/propertiesService')>();
  return { ...real, propertiesService: { ...real.propertiesService, ...svc } };
});
const condo = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock('@/services/condominiums/condominiumsService', async importOriginal => {
  const real = await importOriginal<typeof import('@/services/condominiums/condominiumsService')>();
  return { ...real, condominiumsService: { ...real.condominiumsService, ...condo } };
});
const podeCondo = vi.hoisted(() => ({ valor: true }));
vi.mock('@/hooks/useCan', async importOriginal => {
  const real = await importOriginal<typeof import('@/hooks/useCan')>();
  return { ...real, useCan: () => (r: string, a: string) => (r === 'condominiums' && a === 'manage' ? podeCondo.valor : true) };
});
vi.mock('@/contexts/TenantFeaturesContext', () => ({ useFeature: () => true }));
vi.mock('@/services/contacts/labelsService', () => ({
  labelsService: { getLabels: () => Promise.resolve({ data: [] }) },
}));
vi.mock('@/services/users/usersService', () => ({
  default: { getUsers: () => Promise.resolve({ data: [] }) },
}));
// O lote com IA e o mapa têm testes próprios; aqui só importa que a tela os chama.
vi.mock('../PropertyImportDialog', () => ({
  default: ({ open, listingKind, retomarRevisao, onManual, onReview }: { open: boolean; listingKind?: string; retomarRevisao?: boolean; onManual?: () => void; onReview?: (id: string) => void }) =>
    (open ? <div data-testid="lote">lote {listingKind}{retomarRevisao ? ' retomando' : ''}<button onClick={onManual}>Cadastrar à mão</button><button onClick={() => onReview?.('d1')}>Revisar d1</button></div> : null),
}));
vi.mock('@/services/propertyPhotos/propertyPhotosService', async importOriginal => {
  const real = await importOriginal<typeof import('@/services/propertyPhotos/propertyPhotosService')>();
  return { ...real, propertyPhotosService: { ...real.propertyPhotosService, list: () => Promise.resolve([]) } };
});
vi.mock('./VisaoMapa', () => ({
  default: ({ kind }: { kind: string }) => <div data-testid="mapa">mapa {kind}</div>,
}));

import Properties from '../Properties';

const imovel = (over: Partial<Property>): Property => ({
  id: '1', code: 'AP0461', title: 'Apartamento', transaction_type: 'sale', category_type: 'residential',
  property_type: 'apartment', status: 'active', stage: 'ready', created_at: '2026-10-01',
  updated_at: new Date().toISOString(), listing_kind: 'resale', address_neighborhood: 'Cambuí', ...over,
} as Property);

const resposta = (data: Property[], total = data.length) => ({ data, meta: { total, page: 1, per_page: 50 } });

// Onde a tela mandou a pessoa: o cadastro virou página (/properties/new, /properties/:id/editar).
function Onde() { const l = useLocation(); return <p data-testid="onde">{l.pathname}{l.search}</p>; }

function abrir(endereco = '/properties') {
  return render(
    <MemoryRouter initialEntries={[endereco]}>
      <Properties />
      <Onde />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  podeCondo.valor = true;
  condo.list.mockResolvedValue({ data: [], meta: { total: 4, page: 1, per_page: 50, cities: [] } });
  svc.facets.mockResolvedValue({ neighborhoods: [], property_types: [], captors: [] });
  svc.list.mockImplementation(async (p: { listing_kind: string }) =>
    (p.listing_kind === 'resale'
      ? resposta([imovel({ id: 'r1', code: 'AP0461' })], 38)
      : resposta([imovel({ id: 'd1', code: 'EM0001', title: 'Vista Taquaral', listing_kind: 'development' })], 12)));
});

describe('Tela de Imóveis', () => {
  it('mostra as abas com a contagem e abre na aba com mais cadastros', async () => {
    svc.contarPorTipo.mockResolvedValue({ development: 12, resale: 38 });
    abrir();
    expect(await screen.findByRole('tab', { name: 'Revenda (38)' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Empreendimentos (12)' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByText('Empreendimentos e imóveis de revenda da imobiliária. · 50 cadastros')).toBeInTheDocument();
    await waitFor(() => expect(svc.list).toHaveBeenCalledWith(expect.objectContaining({ listing_kind: 'resale', page: 1 })));
    expect(svc.list).not.toHaveBeenCalledWith(expect.objectContaining({ listing_kind: 'development' }));
    expect(await screen.findByText('38 imóveis de revenda')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Novo imóvel/ })).toBeInTheDocument();
  });

  it('não desenha as abas antes de saber a aba padrão', async () => {
    let soltar: (c: { development: number; resale: number }) => void = () => {};
    svc.contarPorTipo.mockReturnValue(new Promise(r => { soltar = r; }));
    abrir();
    expect(screen.queryByRole('tab')).toBeNull();
    expect(svc.list).not.toHaveBeenCalled();
    soltar({ development: 5, resale: 1 });
    expect(await screen.findByRole('tab', { name: 'Empreendimentos (5)' })).toHaveAttribute('aria-selected', 'true');
  });

  it('trocar de aba busca a lista do outro tipo e grava a aba no endereço', async () => {
    svc.contarPorTipo.mockResolvedValue({ development: 12, resale: 38 });
    abrir();
    fireEvent.click(await screen.findByRole('tab', { name: 'Empreendimentos (12)' }));
    await waitFor(() => expect(svc.list).toHaveBeenCalledWith(expect.objectContaining({ listing_kind: 'development', page: 1 })));
    expect(await screen.findByText('12 empreendimentos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Novo empreendimento/ })).toBeInTheDocument();
  });

  it('aba vazia convida a cadastrar o primeiro, já com o tipo no lote', async () => {
    svc.contarPorTipo.mockResolvedValue({ development: 0, resale: 3 });
    svc.list.mockImplementation(async (p: { listing_kind: string }) =>
      (p.listing_kind === 'resale' ? resposta([imovel({})], 3) : resposta([], 0)));
    abrir('/properties?aba=empreendimentos');
    expect(await screen.findByText('Você ainda não tem empreendimento cadastrado')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar o primeiro empreendimento' }));
    expect(screen.getByTestId('lote')).toHaveTextContent('lote development');
  });

  it('filtro sem resultado não confunde com aba vazia', async () => {
    svc.contarPorTipo.mockResolvedValue({ development: 0, resale: 3 });
    svc.list.mockResolvedValue(resposta([], 0));
    abrir('/properties?aba=revenda&recorte=sem_fotos');
    expect(await screen.findByText('Nada encontrado')).toBeInTheDocument();
    expect(screen.queryByText('Você ainda não tem imóvel de revenda')).toBeNull();
  });

  it('erro de carga mostra Tentar de novo, não lista vazia', async () => {
    svc.contarPorTipo.mockResolvedValue({ development: 0, resale: 3 });
    svc.list.mockRejectedValue(new Error('rede'));
    abrir('/properties?aba=revenda');
    expect(await screen.findByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
  });

  it('?visao=mapa abre a visão Mapa da aba', async () => {
    svc.contarPorTipo.mockResolvedValue({ development: 2, resale: 1 });
    abrir('/properties?visao=mapa');
    expect(await screen.findByTestId('mapa')).toHaveTextContent('mapa development');
    expect(screen.getByRole('button', { name: 'Ver no mapa' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('Mostrar mais acrescenta a página 2 no fim da lista', async () => {
    svc.contarPorTipo.mockResolvedValue({ development: 0, resale: 2 });
    svc.list.mockImplementation(async (p: { page: number }) =>
      (p.page === 1 ? resposta([imovel({ id: 'a', code: 'AP1' })], 2) : resposta([imovel({ id: 'b', code: 'AP2' })], 2)));
    abrir('/properties?aba=revenda');
    fireEvent.click(await screen.findByRole('button', { name: 'Mostrar mais' }));
    expect(await screen.findByText('Mostrando 2 de 2')).toBeInTheDocument();
    expect(svc.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
  });

  it('Mostrar mais fica travado enquanto a lista recarrega com filtro novo', async () => {
    svc.contarPorTipo.mockResolvedValue({ development: 0, resale: 2 });
    svc.list.mockImplementation((p: Record<string, unknown>) =>
      (p['transaction_type[]']
        ? new Promise(() => {}) // a recarga com o filtro novo fica no ar
        : Promise.resolve(resposta([imovel({ id: 'a', code: 'AP1' })], 2))));
    abrir('/properties?aba=revenda');
    const mostrarMais = await screen.findByRole('button', { name: 'Mostrar mais' });
    expect(mostrarMais).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: /Filtros/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Venda' }));
    await waitFor(() => expect(svc.list).toHaveBeenLastCalledWith(expect.objectContaining({ 'transaction_type[]': ['sale', 'sale_rent'], page: 1 })));
    expect(screen.getByRole('button', { name: 'Mostrar mais' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar mais' }));
    expect(svc.list).not.toHaveBeenCalledWith(expect.objectContaining({ page: 2 }));
  });

  it('com recorte da Dashboard não soma os cadastros da imobiliária', async () => {
    svc.contarPorTipo.mockResolvedValue({ development: 0, resale: 3 });
    abrir('/properties?recorte=sem_fotos');
    expect(await screen.findByRole('tab', { name: 'Revenda (3)' })).toBeInTheDocument();
    expect(screen.queryByText(/cadastros? na imobiliária/)).toBeNull();
    expect(svc.contarPorTipo).toHaveBeenCalledWith({ status: 'active', without_photos: '1' });
  });

  describe('Só os meus', () => {
    const botao = () => screen.findByRole('button', { name: 'Só os meus' });
    const lembrado = () => localStorage.setItem('imoveis:so-os-meus', '1');
    // A contagem depende do recorte: a imobiliária tem uma coisa, a pessoa tem outra.
    const contagens = (dela: object, imobiliaria: object) =>
      svc.contarPorTipo.mockImplementation(async (p: { mine?: string }) => (p.mine ? dela : imobiliaria));
    beforeEach(() => {
      svc.contarPorTipo.mockResolvedValue({ development: 0, resale: 38, auction: 0 });
    });

    it('nasce desligado: a lista e as abas mostram a imobiliária inteira', async () => {
      abrir();
      expect(await botao()).toHaveAttribute('aria-pressed', 'false');
      await waitFor(() => expect(svc.list).toHaveBeenCalled());
      expect(svc.list.mock.calls.at(-1)![0].mine).toBeUndefined();
      expect(svc.contarPorTipo).toHaveBeenLastCalledWith({});
    });

    it('ligar recorta a lista, as abas e os filtros, e lembra da escolha', async () => {
      const { unmount } = abrir();
      fireEvent.click(await botao());
      await waitFor(() => expect(svc.list.mock.calls.at(-1)![0].mine).toBe('1'));
      expect(svc.contarPorTipo).toHaveBeenLastCalledWith({ mine: '1' });
      expect(svc.facets).toHaveBeenLastCalledWith('resale', { mine: true });
      unmount();
      svc.list.mockClear();
      abrir();
      expect(await botao()).toHaveAttribute('aria-pressed', 'true');
      await waitFor(() => expect(svc.list.mock.calls.at(-1)![0].mine).toBe('1'));
    });

    it('sem nenhum imóvel no nome, diz isso e oferece ver todos', async () => {
      lembrado();
      svc.contarPorTipo.mockResolvedValue({ development: 0, resale: 0, auction: 0 });
      svc.list.mockResolvedValue(resposta([], 0));
      abrir();
      expect(await screen.findByText('Nenhum imóvel no seu nome')).toBeInTheDocument();
      expect(screen.queryByText(/^0 /)).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Ver todos os imóveis' }));
      await waitFor(() => expect(svc.list.mock.calls.at(-1)![0].mine).toBeUndefined());
      expect(localStorage.getItem('imoveis:so-os-meus')).toBeNull();
    });

    it('link da Dashboard manda: a escolha lembrada não muda o número do link', async () => {
      localStorage.setItem('imoveis:so-os-meus', '1');
      abrir('/properties?recorte=sem_fotos');
      expect(await botao()).toHaveAttribute('aria-pressed', 'false');
      await waitFor(() => expect(svc.list).toHaveBeenCalled());
      expect(svc.list.mock.calls.at(-1)![0].mine).toBeUndefined();
    });

    it('link "seus" da Dashboard acende o botão; desligar tira o link e mostra todos', async () => {
      abrir('/properties?recorte=ativos&meus=1');
      fireEvent.click(await botao().then(b => { expect(b).toHaveAttribute('aria-pressed', 'true'); return b; }));
      await waitFor(() => expect(svc.list.mock.calls.at(-1)![0].mine).toBeUndefined());
      expect(screen.getByTestId('onde').textContent).not.toContain('recorte');
    });

    it('imóveis só em outra aba: muda pra ela, sem dizer que não tem nada no nome', async () => {
      contagens({ development: 0, resale: 3, auction: 0 }, { development: 800, resale: 200, auction: 0 });
      svc.list.mockResolvedValue(resposta([], 0));
      abrir();
      expect(await screen.findByRole('tab', { name: 'Empreendimentos (800)' })).toHaveAttribute('aria-selected', 'true');
      fireEvent.click(await botao());
      await waitFor(() => expect(screen.getByRole('tab', { name: 'Revenda (3)' })).toHaveAttribute('aria-selected', 'true'));
      await waitFor(() => expect(screen.getByTestId('onde').textContent).toContain('aba=revenda'));
      expect(screen.queryByText('Nenhum imóvel no seu nome')).toBeNull();
    });

    it('aberto numa aba zerada, com imóvel no nome em outra, não diz "nada no seu nome"', async () => {
      lembrado();
      svc.contarPorTipo.mockResolvedValue({ development: 0, resale: 3, auction: 0 });
      svc.list.mockResolvedValue(resposta([], 0));
      abrir('/properties?aba=empreendimentos');
      expect(await screen.findByText('Nada encontrado')).toBeInTheDocument();
      expect(screen.queryByText('Nenhum imóvel no seu nome')).toBeNull();
    });

    it('Ver todos sai da aba vazia pra aba que tem imóvel', async () => {
      lembrado();
      contagens({ development: 0, resale: 0, auction: 0 }, { development: 0, resale: 1000, auction: 0 });
      svc.list.mockResolvedValue(resposta([], 0));
      abrir();
      fireEvent.click(await screen.findByRole('button', { name: 'Ver todos os imóveis' }));
      await waitFor(() => expect(screen.getByRole('tab', { name: 'Revenda (1.000)' })).toHaveAttribute('aria-selected', 'true'));
      expect(screen.queryByText('Você ainda não tem empreendimento cadastrado')).toBeNull();
    });

    it('recontagem que não veio do botão não troca a aba da pessoa', async () => {
      contagens({ development: 0, resale: 3, auction: 0 }, { development: 0, resale: 3, auction: 0 });
      abrir('/properties?aba=empreendimentos');
      expect(await screen.findByRole('tab', { name: 'Empreendimentos (0)' })).toHaveAttribute('aria-selected', 'true');
      await waitFor(() => expect(svc.list).toHaveBeenCalled());
      expect(screen.getByRole('tab', { name: 'Empreendimentos (0)' })).toHaveAttribute('aria-selected', 'true');
    });

    it('o topo só soma os cadastros com o botão desligado', async () => {
      svc.contarPorTipo.mockResolvedValue({ development: 0, resale: 38, auction: 0 });
      abrir();
      expect(await screen.findByText(/· 38 cadastros/)).toBeInTheDocument();
      fireEvent.click(await botao());
      await waitFor(() => expect(screen.queryByText(/· 38 cadastros/)).toBeNull());
    });

    it('imóvel específico pelo endereço (?q=) procura na imobiliária inteira e guarda a escolha', async () => {
      lembrado();
      abrir('/properties?aba=revenda&q=AP0461');
      await waitFor(() => expect(svc.list).toHaveBeenCalledWith(expect.objectContaining({ q: 'AP0461' })));
      expect(svc.list.mock.calls.at(-1)![0].mine).toBeUndefined();
      expect(await botao()).toHaveAttribute('aria-pressed', 'false');
      expect(localStorage.getItem('imoveis:so-os-meus')).toBe('1');
    });

    it('Ctrl+K com a tela aberta também procura na imobiliária inteira', async () => {
      lembrado();
      render(<MemoryRouter initialEntries={['/properties?aba=revenda']}><Link to="/properties?aba=revenda&q=AP9">buscar</Link><Properties /></MemoryRouter>);
      await waitFor(() => expect(svc.list.mock.calls.at(-1)?.[0].mine).toBe('1'));
      fireEvent.click(screen.getByRole('link', { name: 'buscar' }));
      await waitFor(() => expect(svc.list.mock.calls.at(-1)![0]).toMatchObject({ q: 'AP9' }));
      expect(svc.list.mock.calls.at(-1)![0].mine).toBeUndefined();
    });

    it('Limpar filtros também desliga o botão', async () => {
      lembrado();
      svc.contarPorTipo.mockResolvedValue({ development: 0, resale: 5, auction: 0 });
      svc.list.mockResolvedValue(resposta([], 0));
      abrir('/properties?aba=revenda');
      fireEvent.click(await screen.findByRole('button', { name: /Limpar filtros/ }));
      await waitFor(() => expect(svc.list.mock.calls.at(-1)![0].mine).toBeUndefined());
      expect(localStorage.getItem('imoveis:so-os-meus')).toBeNull();
    });

    it('busca sem resultado com o botão ligado é "Nada encontrado", não "nada no seu nome"', async () => {
      lembrado();
      svc.contarPorTipo.mockResolvedValue({ development: 0, resale: 0, auction: 0 });
      svc.list.mockResolvedValue(resposta([], 0));
      abrir('/properties?aba=revenda');
      fireEvent.change(await screen.findByRole('textbox', { name: 'Buscar' }), { target: { value: 'xyz' } });
      expect(await screen.findByText('Nada encontrado')).toBeInTheDocument();
      expect(screen.queryByText('Nenhum imóvel no seu nome')).toBeNull();
    });

    it('link "seus" zerado é "Nada encontrado": o chip é que explica o recorte', async () => {
      svc.contarPorTipo.mockResolvedValue({ development: 0, resale: 0, auction: 0 });
      svc.list.mockResolvedValue(resposta([], 0));
      abrir('/properties?aba=revenda&recorte=ativos&meus=1');
      expect(await screen.findByText('Nada encontrado')).toBeInTheDocument();
      expect(screen.queryByText('Nenhum imóvel no seu nome')).toBeNull();
    });

    it('trocar Lista por Grade não reconta as abas', async () => {
      abrir();
      await botao();
      await waitFor(() => expect(svc.contarPorTipo).toHaveBeenCalled());
      const antes = svc.contarPorTipo.mock.calls.length;
      fireEvent.click(screen.getByRole('button', { name: 'Ver em grade' }));
      await waitFor(() => expect(screen.getByTestId('onde').textContent).toContain('visao=grade'));
      expect(svc.contarPorTipo).toHaveBeenCalledTimes(antes);
    });

    it('no Mapa, com link aberto, as abas também contam a imobiliária inteira', async () => {
      abrir('/properties?visao=mapa&aba=revenda&recorte=ativos&meus=1');
      await screen.findByTestId('mapa');
      await waitFor(() => expect(svc.contarPorTipo).toHaveBeenLastCalledWith({}));
    });

    it('no Mapa o botão some e as abas contam a imobiliária inteira, como o mapa mostra', async () => {
      localStorage.setItem('imoveis:so-os-meus', '1');
      abrir('/properties?visao=mapa&aba=revenda');
      await screen.findByTestId('mapa');
      expect(screen.queryByRole('button', { name: 'Só os meus' })).toBeNull();
      await waitFor(() => expect(svc.contarPorTipo).toHaveBeenLastCalledWith({}));
    });
  });

  it('Cadastrar à mão na aba Empreendimentos abre o cadastro de empreendimento', async () => {
    svc.contarPorTipo.mockResolvedValue({ development: 12, resale: 3 });
    abrir('/properties?aba=empreendimentos');
    fireEvent.click(await screen.findByRole('button', { name: /Novo empreendimento/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar à mão' }));
    await waitFor(() => expect(screen.getByTestId('onde')).toHaveTextContent('/properties/new?tipo=empreendimento'));
  });

  it('Cadastrar à mão na aba Revenda abre o cadastro de revenda', async () => {
    svc.contarPorTipo.mockResolvedValue({ development: 1, resale: 38 });
    abrir('/properties?aba=revenda');
    fireEvent.click(await screen.findByRole('button', { name: /Novo imóvel/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar à mão' }));
    await waitFor(() => expect(screen.getByTestId('onde')).toHaveTextContent('/properties/new?tipo=revenda'));
  });

  it('Revisar um imóvel do lote abre a edição, marcando que veio do lote', async () => {
    svc.contarPorTipo.mockResolvedValue({ development: 12, resale: 3 });
    abrir('/properties?aba=empreendimentos');
    fireEvent.click(await screen.findByRole('button', { name: /Novo empreendimento/ }));
    expect(screen.getByTestId('lote')).not.toHaveTextContent('retomando');
    fireEvent.click(screen.getByRole('button', { name: 'Revisar d1' }));
    await waitFor(() => expect(screen.getByTestId('onde')).toHaveTextContent('/properties/d1/editar?de=lote'));
  });

  it('?importar=1 (volta da revisão) reabre o lote e tira o parâmetro', async () => {
    svc.contarPorTipo.mockResolvedValue({ development: 12, resale: 3 });
    abrir('/properties?aba=empreendimentos&importar=1');
    expect(await screen.findByTestId('lote')).toHaveTextContent('retomando');
    await waitFor(() => expect(screen.getByTestId('onde')).not.toHaveTextContent('importar'));
    expect(screen.getByTestId('onde')).toHaveTextContent('aba=empreendimentos');
  });

  it('Editar no menu do imóvel abre a página de edição', async () => {
    svc.contarPorTipo.mockResolvedValue({ development: 0, resale: 1 });
    abrir('/properties?aba=revenda');
    await userEvent.click(await screen.findByRole('button', { name: 'Ações do AP0461' }));
    await userEvent.click(await screen.findByText('Editar imóvel'));
    await waitFor(() => expect(screen.getByTestId('onde')).toHaveTextContent('/properties/r1/editar'));
  });

  it('busca global (?aba=&q=) abre na aba do imóvel, já buscando', async () => {
    svc.contarPorTipo.mockResolvedValue({ development: 2, resale: 38 });
    abrir('/properties?aba=empreendimentos&q=EM0001');
    expect(await screen.findByRole('tab', { name: 'Empreendimentos (2)' })).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(svc.list).toHaveBeenCalledWith(expect.objectContaining({ listing_kind: 'development', q: 'EM0001' })));
    expect(svc.list).not.toHaveBeenCalledWith(expect.objectContaining({ listing_kind: 'resale' }));
    expect(screen.getByRole('textbox', { name: 'Buscar' })).toHaveValue('EM0001');
  });

  it('visão Mapa esconde busca, filtros e ordem e não recarrega a lista', async () => {
    svc.contarPorTipo.mockResolvedValue({ development: 2, resale: 1 });
    abrir('/properties?visao=mapa');
    expect(await screen.findByTestId('mapa')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Empreendimentos (2)' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Buscar' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Filtros/ })).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'Ordenar' })).toBeNull();
    expect(svc.list).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Ver em lista' }));
    await waitFor(() => expect(svc.list).toHaveBeenCalledWith(expect.objectContaining({ listing_kind: 'development', page: 1 })));
    expect(screen.getByRole('textbox', { name: 'Buscar' })).toBeInTheDocument();
  });

  it('Adicionar fotos leva pra página de fotos do imóvel', async () => {
    svc.contarPorTipo.mockResolvedValue({ development: 0, resale: 1 });
    svc.list.mockResolvedValue(resposta([imovel({ id: 'r1', code: 'AP0461', cover_photo_url: null })], 1));
    abrir('/properties?aba=revenda');
    fireEvent.click(await screen.findByRole('button', { name: 'Adicionar fotos' }));
    await waitFor(() => expect(screen.getByTestId('onde')).toHaveTextContent('/properties/r1/fotos'));
  });

  it('excluir usa Excluir, não Remover', async () => {
    svc.contarPorTipo.mockResolvedValue({ development: 0, resale: 1 });
    abrir('/properties?aba=revenda');
    await userEvent.click(await screen.findByRole('button', { name: 'Ações do AP0461' }));
    await userEvent.click(await screen.findByText('Excluir'));
    expect(await screen.findByText('Excluir imóvel')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Excluir' })).toBeInTheDocument();
    expect(screen.queryByText('Remover imóvel')).toBeNull();
  });

  it('Está em dia na lista de desatualizados tira o imóvel e baixa o total (sem Mostrar mais à toa)', async () => {
    svc.contarPorTipo.mockResolvedValue({ development: 0, resale: 2 });
    svc.list.mockResolvedValue(resposta([imovel({ id: 'a', code: 'AP1' }), imovel({ id: 'b', code: 'AP2' })], 2));
    svc.confirmarEmDia.mockResolvedValue(imovel({ id: 'a', code: 'AP1' }));
    abrir('/properties?aba=revenda&recorte=desatualizados&vence=hoje');
    expect(await screen.findByText('Mostrando 2 de 2')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Está em dia' })[0]);
    expect(await screen.findByText('Mostrando 1 de 1')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mostrar mais' })).toBeNull();
  });

  describe('aba Condomínios', () => {
    it('abre por ?aba=condominios sem carregar imóveis', async () => {
      svc.contarPorTipo.mockResolvedValue({ development: 12, resale: 38 });
      abrir('/properties?aba=condominios');
      expect(await screen.findByRole('tab', { name: 'Condomínios (4)' })).toHaveAttribute('aria-selected', 'true');
      expect(await screen.findByText('Nenhum condomínio ainda')).toBeInTheDocument();
      expect(svc.list).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Novo condomínio' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Gerar descrições com IA/ })).not.toBeInTheDocument();
    });

    it('ignora ?visao=mapa na aba', async () => {
      svc.contarPorTipo.mockResolvedValue({ development: 12, resale: 38 });
      abrir('/properties?aba=condominios&visao=mapa');
      await screen.findByText('Nenhum condomínio ainda');
      expect(screen.queryByTestId('mapa')).not.toBeInTheDocument();
    });

    it('Revenda → Condomínios → Revenda volta a lista de imóveis', async () => {
      svc.contarPorTipo.mockResolvedValue({ development: 12, resale: 38 });
      abrir('/properties?aba=revenda');
      await screen.findByText('38 imóveis de revenda');
      await userEvent.click(await screen.findByRole('tab', { name: 'Condomínios (4)' }));
      expect(await screen.findByText('Nenhum condomínio ainda')).toBeInTheDocument();
      expect(screen.getByTestId('onde')).toHaveTextContent('aba=condominios');
      await userEvent.click(screen.getByRole('tab', { name: 'Revenda (38)' }));
      expect(await screen.findByText('38 imóveis de revenda')).toBeInTheDocument();
      expect(screen.queryByText('Nenhum condomínio ainda')).not.toBeInTheDocument();
      expect(screen.getByTestId('onde')).not.toHaveTextContent('condominios');
    });

    it('sem a permissão some o Novo condomínio', async () => {
      podeCondo.valor = false;
      svc.contarPorTipo.mockResolvedValue({ development: 12, resale: 38 });
      abrir('/properties?aba=condominios');
      await screen.findByText('Nenhum condomínio ainda');
      expect(screen.queryByRole('button', { name: /Novo condomínio/ })).not.toBeInTheDocument();
    });
  });
});
