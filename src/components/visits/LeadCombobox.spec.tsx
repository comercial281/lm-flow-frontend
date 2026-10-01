import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const leadPickerPage = vi.fn();
const leadPicker = vi.fn();
vi.mock('@/services/visits/visitsService', async (orig) => {
  const real = await orig<typeof import('@/services/visits/visitsService')>();
  return {
    ...real,
    visitsService: {
      ...real.visitsService,
      leadPickerPage: (...a: unknown[]) => leadPickerPage(...a),
      leadPicker: (...a: unknown[]) => leadPicker(...a),
    },
  };
});

import { LeadCombobox, nomeDoCliente, textoEscolhido } from './LeadCombobox';
import type { LeadPickerItem } from '@/services/visits/visitsService';

const cliente = (i: number): LeadPickerItem => ({
  id: `c${i}`, name: `Cliente Teste ${i}`, phone_number: null, in_pipeline: false,
});
const pagina = (de: number, ate: number) => Array.from({ length: ate - de + 1 }, (_, k) => cliente(de + k));

const resposta = (data: LeadPickerItem[], meta: Record<string, unknown>) => ({ data, meta });

function Campo({ paginated = true }: { paginated?: boolean }) {
  const [valor, setValor] = useState<LeadPickerItem | null>(null);
  return (
    <LeadCombobox
      value={valor}
      onChange={setValor}
      label="Cliente *"
      placeholder="Buscar cliente por nome ou telefone"
      allowCreate={false}
      paginated={paginated}
    />
  );
}

const abrirLista = async () => {
  await userEvent.click(screen.getByPlaceholderText('Buscar cliente por nome ou telefone'));
};

/** jsdom não tem layout: a rolagem é simulada pelas medidas do elemento. */
const rolar = (el: HTMLElement, { scrollTop, scrollHeight = 1000, clientHeight = 300 }: { scrollTop: number; scrollHeight?: number; clientHeight?: number }) => {
  Object.defineProperty(el, 'scrollHeight', { configurable: true, value: scrollHeight });
  Object.defineProperty(el, 'clientHeight', { configurable: true, value: clientHeight });
  Object.defineProperty(el, 'scrollTop', { configurable: true, writable: true, value: scrollTop });
  fireEvent.scroll(el);
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('LeadCombobox paginado', () => {
  it('pede 50 por vez e mostra o total no rodapé', async () => {
    leadPickerPage.mockResolvedValue(resposta(pagina(1, 50), { total: 1240, page: 1, per_page: 50, has_more: true }));
    render(<Campo />);
    await abrirLista();

    expect(await screen.findByText('Mostrando 50 de 1.240 — digite para buscar')).toBeInTheDocument();
    expect(leadPickerPage).toHaveBeenCalledWith('', 1, 50);
    expect(leadPicker).not.toHaveBeenCalled();
  });

  it('sem mais páginas, o rodapé não pede para digitar', async () => {
    leadPickerPage.mockResolvedValue(resposta(pagina(1, 2), { total: 2, page: 1, per_page: 50, has_more: false }));
    render(<Campo />);
    await abrirLista();

    expect(await screen.findByText('Mostrando 2 de 2')).toBeInTheDocument();
    expect(screen.queryByText(/digite para buscar/)).not.toBeInTheDocument();
  });

  it('rolar até perto do fim pede a página 2 uma vez só e junta na lista', async () => {
    let soltarPagina2: (v: unknown) => void = () => {};
    leadPickerPage.mockImplementation((_q: string, page: number) => {
      if (page === 1) return Promise.resolve(resposta(pagina(1, 50), { total: 120, page: 1, per_page: 50, has_more: true }));
      return new Promise(r => { soltarPagina2 = r; });
    });
    render(<Campo />);
    await abrirLista();
    await screen.findByText('Cliente Teste 50');
    const lista = screen.getByRole('group', { name: 'Resultados da busca' });

    // Longe do fim: não pede nada.
    rolar(lista, { scrollTop: 0 });
    expect(leadPickerPage).not.toHaveBeenCalledWith('', 2, 50);

    // A 50 px do fim: pede a página 2. Rolar de novo enquanto ela não chega não pede outra vez.
    rolar(lista, { scrollTop: 650 });
    rolar(lista, { scrollTop: 690 });
    await waitFor(() => expect(leadPickerPage).toHaveBeenCalledWith('', 2, 50));
    expect(leadPickerPage.mock.calls.filter(c => c[1] === 2)).toHaveLength(1);

    soltarPagina2(resposta(pagina(51, 100), { total: 120, page: 2, per_page: 50, has_more: true }));
    expect(await screen.findByText('Cliente Teste 100')).toBeInTheDocument();
    expect(screen.getByText('Cliente Teste 1')).toBeInTheDocument();
    expect(screen.getByText('Mostrando 100 de 120 — digite para buscar')).toBeInTheDocument();
  });

  it('nova busca volta para a página 1', async () => {
    leadPickerPage.mockImplementation((q: string, page: number) => {
      if (q === 'mar') return Promise.resolve(resposta([{ ...cliente(7), name: 'Marcos Teste' }], { total: 1, page: 1, per_page: 50, has_more: false }));
      return Promise.resolve(resposta(pagina(50 * (page - 1) + 1, 50 * page), { total: 120, page, per_page: 50, has_more: true }));
    });
    render(<Campo />);
    await abrirLista();
    await screen.findByText('Cliente Teste 50');
    rolar(screen.getByRole('group', { name: 'Resultados da busca' }), { scrollTop: 700 });
    expect(await screen.findByText('Cliente Teste 100')).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText('Buscar cliente por nome ou telefone'), 'mar');

    expect(await screen.findByText('Marcos Teste')).toBeInTheDocument();
    expect(leadPickerPage).toHaveBeenLastCalledWith('mar', 1, 50);
    expect(screen.queryByText('Cliente Teste 100')).not.toBeInTheDocument();
    expect(screen.getByText('Mostrando 1 de 1')).toBeInTheDocument();
  });

  it('resposta atrasada da busca antiga é descartada', async () => {
    let soltarAntiga: (v: unknown) => void = () => {};
    leadPickerPage.mockImplementation((q: string) => {
      if (q === '') return new Promise(r => { soltarAntiga = r; });
      return Promise.resolve(resposta([{ ...cliente(7), name: 'Marcos Teste' }], { total: 1, page: 1, per_page: 50, has_more: false }));
    });
    render(<Campo />);
    await abrirLista();
    await userEvent.type(screen.getByPlaceholderText('Buscar cliente por nome ou telefone'), 'mar');
    expect(await screen.findByText('Marcos Teste')).toBeInTheDocument();

    soltarAntiga(resposta([{ ...cliente(1), name: 'Leonardo Teste' }], { total: 900, page: 1, per_page: 50, has_more: true }));

    await new Promise(r => setTimeout(r, 20));
    expect(screen.queryByText('Leonardo Teste')).not.toBeInTheDocument();
    expect(screen.getByText('Marcos Teste')).toBeInTheDocument();
    expect(screen.getByText('Mostrando 1 de 1')).toBeInTheDocument();
  });

  it('página seguinte da busca antiga, chegando depois da nova busca, é descartada', async () => {
    let soltarPagina2: (v: unknown) => void = () => {};
    leadPickerPage.mockImplementation((q: string, page: number) => {
      if (q === '' && page === 2) return new Promise(r => { soltarPagina2 = r; });
      if (q === 'mar') return Promise.resolve(resposta([{ ...cliente(7), name: 'Marcos Teste' }], { total: 1, page: 1, per_page: 50, has_more: false }));
      return Promise.resolve(resposta(pagina(1, 50), { total: 120, page: 1, per_page: 50, has_more: true }));
    });
    render(<Campo />);
    await abrirLista();
    await screen.findByText('Cliente Teste 50');
    rolar(screen.getByRole('group', { name: 'Resultados da busca' }), { scrollTop: 700 });
    await waitFor(() => expect(leadPickerPage).toHaveBeenCalledWith('', 2, 50));

    await userEvent.type(screen.getByPlaceholderText('Buscar cliente por nome ou telefone'), 'mar');
    expect(await screen.findByText('Marcos Teste')).toBeInTheDocument();

    soltarPagina2(resposta(pagina(51, 100), { total: 120, page: 2, per_page: 50, has_more: true }));
    await new Promise(r => setTimeout(r, 20));
    expect(screen.queryByText('Cliente Teste 51')).not.toBeInTheDocument();
    expect(screen.getByText('Mostrando 1 de 1')).toBeInTheDocument();
  });

  it('depois de escolhido, o campo mostra nome · telefone formatado, nunca o número cru', async () => {
    leadPickerPage.mockResolvedValue(resposta(
      [{ id: 'c1', name: 'Leonardo Teste', phone_number: '5511999990000@s.whatsapp.net', in_pipeline: false }],
      { total: 1, page: 1, per_page: 50, has_more: false },
    ));
    render(<Campo />);
    await abrirLista();
    await userEvent.click(await screen.findByText('Leonardo Teste'));

    expect(screen.getByDisplayValue('Leonardo Teste · (11) 99999-0000')).toBeInTheDocument();
    expect(screen.queryByDisplayValue(/whatsapp|5511999990000/)).not.toBeInTheDocument();
    expect(screen.queryByText(/@s\.whatsapp\.net/)).not.toBeInTheDocument();
  });
});

describe('LeadCombobox: cliente sem nome de verdade', () => {
  it('o nome igual ao telefone vira o telefone formatado, sem repetir na linha de baixo', async () => {
    leadPickerPage.mockResolvedValue(resposta(
      [{ id: 'c1', name: '5511999990000', phone_number: '5511999990000', in_pipeline: false }],
      { total: 1, page: 1, per_page: 50, has_more: false },
    ));
    render(<Campo />);
    await abrirLista();

    expect(await screen.findByText('(11) 99999-0000')).toBeInTheDocument();
    expect(screen.getAllByText(/99999-0000/)).toHaveLength(1);
    expect(screen.queryByText('5511999990000')).not.toBeInTheDocument();
    expect(screen.queryByText('—')).not.toBeInTheDocument();
  });

  it('nome só com dígitos, + e espaços também vira o telefone formatado; o e-mail continua embaixo', async () => {
    leadPickerPage.mockResolvedValue(resposta(
      [{ id: 'c1', name: '+55 11 99999 0000', phone_number: '5511999990000@s.whatsapp.net', email: 'teste@example.com', in_pipeline: false }],
      { total: 1, page: 1, per_page: 50, has_more: false },
    ));
    render(<Campo />);
    await abrirLista();

    expect(await screen.findByText('(11) 99999-0000')).toBeInTheDocument();
    expect(screen.getByText('teste@example.com')).toBeInTheDocument();
    expect(screen.queryByText(/\+55 11/)).not.toBeInTheDocument();
  });

  it('escolhido, o campo mostra só o telefone formatado', async () => {
    leadPickerPage.mockResolvedValue(resposta(
      [{ id: 'c1', name: '5511999990000', phone_number: '5511999990000', in_pipeline: false }],
      { total: 1, page: 1, per_page: 50, has_more: false },
    ));
    render(<Campo />);
    await abrirLista();
    await userEvent.click(await screen.findByText('(11) 99999-0000'));

    expect(screen.getByDisplayValue('(11) 99999-0000')).toBeInTheDocument();
    expect(screen.queryByDisplayValue(/·/)).not.toBeInTheDocument();
  });

  it('cliente com nome continua com nome e telefone embaixo', async () => {
    leadPickerPage.mockResolvedValue(resposta(
      [{ id: 'c1', name: 'Leonardo Teste 2', phone_number: '5511999990000', in_pipeline: false }],
      { total: 1, page: 1, per_page: 50, has_more: false },
    ));
    render(<Campo />);
    await abrirLista();

    expect(await screen.findByText('Leonardo Teste 2')).toBeInTheDocument();
    expect(screen.getByText('(11) 99999-0000')).toBeInTheDocument();
  });
});

describe('nomeDoCliente / textoEscolhido', () => {
  it('reconhece o telefone no lugar do nome', () => {
    expect(nomeDoCliente({ name: '5511999990000', phone_number: '5511999990000' })).toEqual({ nome: '(11) 99999-0000', ehTelefone: true });
    expect(nomeDoCliente({ name: '+55 11 99999 0000', phone_number: null })).toEqual({ nome: '(11) 99999-0000', ehTelefone: true });
    expect(nomeDoCliente({ name: 'Ana Teste', phone_number: '5511999990000' })).toEqual({ nome: 'Ana Teste', ehTelefone: false });
    expect(nomeDoCliente({ name: 'Contato #12', phone_number: null })).toEqual({ nome: 'Contato #12', ehTelefone: false });
    expect(textoEscolhido({ name: 'Ana Teste', phone_number: '5511999990000' })).toBe('Ana Teste · (11) 99999-0000');
    expect(textoEscolhido({ name: '5511999990000', phone_number: '5511999990000' })).toBe('(11) 99999-0000');
  });
});

describe('LeadCombobox sem paginação (Propostas)', () => {
  it('continua usando leadPicker com 20 e sem rodapé de total', async () => {
    leadPicker.mockResolvedValue([cliente(1)]);
    render(<Campo paginated={false} />);
    await abrirLista();

    expect(await screen.findByText('Cliente Teste 1')).toBeInTheDocument();
    expect(leadPicker).toHaveBeenCalledWith('', 20);
    expect(leadPickerPage).not.toHaveBeenCalled();
    expect(screen.queryByText(/Mostrando/)).not.toBeInTheDocument();
  });
});
