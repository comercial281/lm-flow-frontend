// A lista de Contatos mora no endereço (10/10/2026): no celular o card é outra
// tela, e voltar dele zerava busca e página. Aqui: busca + página 2 → abrir o
// card → voltar → a mesma busca e a mesma página, pedidas de novo ao servidor.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

const svc = vi.hoisted(() => ({ getContacts: vi.fn(), searchContacts: vi.fn(), filterContacts: vi.fn() }));
vi.mock('@/services/contacts', () => ({ contactsService: svc }));
vi.mock('@/hooks/useLanguage', () => ({ useLanguage: () => ({ t: (k: string) => k }) }));
vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: () => ({ can: () => true, isReady: true }) }));
vi.mock('@/hooks/useAccountUsers', () => ({ useAccountUsers: () => ({ users: [] }) }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/features/contatos/useCorretorLogado', () => ({ useCorretorLogado: () => false }));
vi.mock('@/tours', () => ({ ContactsTour: () => null }));
vi.mock('@/components/contacts/ContactsFiltros', () => ({ default: () => null }));
vi.mock('@/components/contacts/ContactCartaoMovel', () => ({ default: () => null }));
vi.mock('@/components/contacts/ContactModal', () => ({ default: () => null }));
vi.mock('@/components/contacts/StartConversationModal', () => ({ default: () => null }));
vi.mock('@/components/contacts/ContactExportModal', () => ({ default: () => null }));
vi.mock('@/components/contacts/ContactMergeModal', () => ({ default: () => null }));
vi.mock('@/components/contacts/ContactsHeader', () => ({
  default: (p: { searchValue: string; onSearchChange: (q: string) => void }) => (
    <input aria-label="busca" value={p.searchValue} onChange={e => p.onSearchChange(e.target.value)} />
  ),
}));
vi.mock('@/components/contacts/ContactsTable', () => ({
  default: (p: { contacts: Array<{ id: string; name: string }>; onContactClick: (c: unknown) => void }) => (
    <ul>{p.contacts.map(c => <li key={c.id}><button onClick={() => p.onContactClick(c)}>{c.name}</button></li>)}</ul>
  ),
}));
vi.mock('@/components/contacts/ContactsPagination', () => ({
  default: (p: { currentPage: number; onPageChange: (n: number) => void }) => (
    <div>
      <span data-testid="pagina">{p.currentPage}</span>
      <button onClick={() => p.onPageChange(p.currentPage + 1)}>próxima</button>
    </div>
  ),
}));
// O card de verdade navega pra página no celular; aqui basta empilhar uma tela.
vi.mock('@/components/contacts/CardDoContato', () => ({
  default: function CardFalso({ contactId }: { contactId: string | null }) {
    const navigate = useNavigate();
    useEffect(() => { if (contactId) navigate('/pipelines/p1/card/i1'); }, [contactId, navigate]);
    return null;
  },
}));

import Contacts from './Contacts';

const resposta = (page: number) => ({
  data: [{ id: `c${page}`, name: `Contato da página ${page}` }],
  meta: { pagination: { page, page_size: 20, total: 60, total_pages: 3 } },
});

function Endereco() {
  return <span data-testid="endereco">{useLocation().search}</span>;
}
function PaginaDoCard() {
  const navigate = useNavigate();
  return <button onClick={() => navigate(-1)}>Voltar</button>;
}

beforeEach(() => {
  vi.useRealTimers();
  Object.values(svc).forEach(f => f.mockReset());
  svc.getContacts.mockResolvedValue(resposta(1));
  svc.searchContacts.mockImplementation(async (p: { page: number }) => resposta(p.page));
});

describe('Contatos: a lista no endereço', () => {
  it('busca + página 2 → abrir o card → voltar: mesma busca e mesma página', async () => {
    render(
      <MemoryRouter initialEntries={['/contacts']}>
        <Routes>
          <Route path="/contacts" element={<><Contacts /><Endereco /></>} />
          <Route path="/pipelines/:p/card/:i" element={<PaginaDoCard />} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByText('Contato da página 1');

    fireEvent.change(screen.getByLabelText('busca'), { target: { value: 'ana' } });
    await screen.findByText('Contato da página 1', {}, { timeout: 2000 });
    await waitFor(() => expect(svc.searchContacts).toHaveBeenCalledWith(expect.objectContaining({ q: 'ana', page: 1 })), { timeout: 2000 });
    fireEvent.click(screen.getByRole('button', { name: 'próxima' }));
    await screen.findByText('Contato da página 2');
    await waitFor(() => expect(screen.getByTestId('endereco').textContent).toBe('?busca=ana&pagina=2'));

    fireEvent.click(screen.getByRole('button', { name: 'Contato da página 2' }));
    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: 'Voltar' }));
    });

    expect(await screen.findByText('Contato da página 2')).toBeInTheDocument();
    expect((screen.getByLabelText('busca') as HTMLInputElement).value).toBe('ana');
    expect(screen.getByTestId('pagina')).toHaveTextContent('2');
    expect(screen.getByTestId('endereco').textContent).toBe('?busca=ana&pagina=2');
    expect(svc.searchContacts).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'ana', page: 2 }));
  });

  it('sem nada no endereço, a lista abre como sempre (página 1, endereço limpo)', async () => {
    render(
      <MemoryRouter initialEntries={['/contacts']}>
        <Routes>
          <Route path="/contacts" element={<><Contacts /><Endereco /></>} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByText('Contato da página 1');
    expect(svc.getContacts).toHaveBeenCalledWith(expect.objectContaining({ page: 1, per_page: 20 }));
    expect(screen.getByTestId('endereco').textContent).toBe('');
  });
});
