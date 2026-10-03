import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const own = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn(), create: vi.fn() }));
vi.mock('@/services/propertyOwners/propertyOwnersService', () => ({ propertyOwnersService: own }));
import SecaoProprietario from './SecaoProprietario';

const form = { title: '', transaction_type: 'sale', category_type: 'residential', property_type: 'house', status: 'active', stage: 'ready', listing_kind: 'resale' as const };
const maria = { id: 'o1', name: 'Maria Souza', phone: '11999998888' };

beforeEach(() => { vi.clearAllMocks(); own.list.mockResolvedValue({ data: [maria], meta: { total: 1 } }); });

describe('SecaoProprietario', () => {
  it('busca e escolhe', async () => {
    const setF = vi.fn();
    render(<SecaoProprietario form={form} setF={setF} editando={null} />);
    await userEvent.type(screen.getByPlaceholderText('Buscar proprietário por nome ou telefone'), 'mar');
    await userEvent.click(await screen.findByRole('button', { name: /Maria Souza/ }));
    expect(setF).toHaveBeenCalledWith({ owner_id: 'o1' });
    expect(own.list).toHaveBeenCalledTimes(1);
    expect(own.list).toHaveBeenCalledWith({ q: 'mar', per_page: 8 });
  });

  it('cadastra novo ali mesmo e escolhe', async () => {
    const setF = vi.fn();
    own.list.mockResolvedValue({ data: [], meta: { total: 0 } });
    own.create.mockResolvedValue({ ...maria, id: 'o9' });
    render(<SecaoProprietario form={form} setF={setF} editando={null} />);
    await userEvent.click(screen.getByRole('button', { name: 'Cadastrar novo proprietário' }));
    await userEvent.type(screen.getByLabelText('Nome'), 'Ana');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar proprietário' }));
    await waitFor(() => expect(setF).toHaveBeenCalledWith({ owner_id: 'o9' }));
  });

  it('nome vazio não envia', async () => {
    render(<SecaoProprietario form={form} setF={vi.fn()} editando={null} />);
    await userEvent.click(screen.getByRole('button', { name: 'Cadastrar novo proprietário' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salvar proprietário' }));
    expect(own.create).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Informe o nome do proprietário');
  });

  it('avisa telefone repetido e deixa usar o existente', async () => {
    const setF = vi.fn();
    render(<SecaoProprietario form={form} setF={setF} editando={null} />);
    await userEvent.click(screen.getByRole('button', { name: 'Cadastrar novo proprietário' }));
    await userEvent.type(screen.getByLabelText('Telefone'), '11999998888');
    expect(await screen.findByText('Já existe um proprietário com esse telefone')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Usar este' }));
    expect(setF).toHaveBeenCalledWith({ owner_id: 'o1' });
  });

  it('com owner_id mostra o cartão e deixa trocar', async () => {
    own.get.mockResolvedValue({ ...maria, properties: [], history: [] });
    const setF = vi.fn();
    render(<SecaoProprietario form={{ ...form, owner_id: 'o1' }} setF={setF} editando={null} />);
    expect(await screen.findByText('Maria Souza')).toBeInTheDocument();
    expect(screen.getByText('(11) 99999-8888')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Trocar' }));
    expect(setF).toHaveBeenCalledWith({ owner_id: null });
  });

  it('404 mostra sem acesso e deixa trocar', async () => {
    own.get.mockRejectedValue({ response: { status: 404 } });
    const setF = vi.fn();
    render(<SecaoProprietario form={{ ...form, owner_id: 'o1' }} setF={setF} editando={null} />);
    expect(await screen.findByText('Proprietário sem acesso ou removido')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Trocar' }));
    expect(setF).toHaveBeenCalledWith({ owner_id: null });
  });
});
