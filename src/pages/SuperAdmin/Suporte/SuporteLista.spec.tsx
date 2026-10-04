import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const svc = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock('@/services/support/supportAdminService', () => ({ supportAdminService: svc }));

import SuporteLista from './SuporteLista';

const linha = {
  id: 't1', kind: 'bug', status: 'open', subject: 'Roleta travou', faq_topic: null, page_url: '/automations/roleta',
  last_message_at: new Date().toISOString(), created_at: new Date().toISOString(), unread: true,
  tenant_slug: 'casa-x', user_name: 'Ana', user_email: 'ana@casa.test',
};

const montar = () => render(<MemoryRouter><SuporteLista /></MemoryRouter>);

describe('Suporte — lista', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    svc.list.mockResolvedValue({ tickets: [linha], total: 1, page: 1, perPage: 30 });
  });

  it('abre filtrando os Abertos e mostra cliente, pessoa e tipo', async () => {
    montar();
    expect(await screen.findByText('Roleta travou')).toBeInTheDocument();
    expect(svc.list).toHaveBeenCalledWith(expect.objectContaining({ status: 'open', page: 1 }));
    expect(screen.getByText(/casa-x/)).toBeInTheDocument();
    expect(screen.getByText(/Ana/)).toBeInTheDocument();
    expect(screen.getByText(/Ana · Bug/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Roleta travou/ })).toHaveAttribute('href', '/admin/suporte/t1');
  });

  it('trocar a situação busca de novo', async () => {
    montar();
    await screen.findByText('Roleta travou');
    fireEvent.click(screen.getByRole('button', { name: 'Resolvido' }));
    await waitFor(() => expect(svc.list).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'resolved' })));
  });

  it('digitar na busca espera a pessoa parar: uma chamada só, com o texto inteiro', async () => {
    montar();
    await screen.findByText('Roleta travou');
    svc.list.mockClear();
    const campo = screen.getByPlaceholderText(/Buscar assunto/);
    for (const texto of ['r', 'ro', 'rol', 'role', 'roleta']) fireEvent.change(campo, { target: { value: texto } });
    await waitFor(() => expect(svc.list).toHaveBeenCalledWith(expect.objectContaining({ q: 'roleta' })));
    expect(svc.list).toHaveBeenCalledTimes(1);
  });

  it('vazio pelo filtro oferece limpar', async () => {
    svc.list.mockResolvedValue({ tickets: [], total: 0, page: 1, perPage: 30 });
    montar();
    expect(await screen.findByRole('button', { name: /limpar/i })).toBeInTheDocument();
  });

  it('erro aparece como erro', async () => {
    svc.list.mockRejectedValue({ response: { data: { error: 'Acesso restrito' } } });
    montar();
    expect(await screen.findByText('Acesso restrito')).toBeInTheDocument();
  });
});
