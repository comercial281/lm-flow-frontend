import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MenuProvider } from '@/contexts/MenuContext';
import { getCustomerMenuSections, type MenuSection, type MenuItem } from '@/components/layout/config/menuItems';
import IntegracoesSistemas, { estadoDoCvcrm } from './IntegracoesSistemas';

const servico = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/services/cvcrm/cvcrmService', () => ({ cvcrmService: servico }));
const suporte = vi.hoisted(() => ({ openSupport: vi.fn() }));
vi.mock('@/components/support/openSupport', () => suporte);

const integracoes = getCustomerMenuSections().flatMap(s => s.itens).find(i => i.name === 'Integrações')!;
const secoes = (hrefs: string[]): MenuSection[] => [{
  id: 'imobiliaria', rotulo: 'Minha imobiliária',
  itens: [{ ...integracoes, abas: integracoes.abas!.filter(a => hrefs.includes(a.href)) } as MenuItem],
}];
const abrir = (s: MenuSection[]) => render(
  <MemoryRouter><MenuProvider value={s}><IntegracoesSistemas /></MenuProvider></MemoryRouter>,
);

const base = { email: null, connected_at: null, agents_using: 0 };

describe('Integrações → Sistemas', () => {
  beforeEach(() => vi.clearAllMocks());

  it('tem o título da página (só para leitor de tela)', () => {
    servico.get.mockResolvedValue({ ...base, connected: false, subdomain: null, token_state: 'none' });
    abrir(secoes(['/settings/cvcrm']));
    expect(screen.getByRole('heading', { level: 1, name: 'Sistemas' })).toBeInTheDocument();
  });

  it('estadoDoCvcrm: conectado, token que não abre e desconectado', () => {
    expect(estadoDoCvcrm({ ...base, connected: true, subdomain: 'habras', token_state: 'ready' })).toBe('Conectado · habras.cvcrm.com.br');
    expect(estadoDoCvcrm({ ...base, connected: true, subdomain: 'habras', token_state: 'unreadable' })).toBe('Precisa de um token novo');
    expect(estadoDoCvcrm({ ...base, connected: false, subdomain: null, token_state: 'none' })).toBe('Não conectado');
  });

  it('cartão do CVCRM com o estado e link pra conexão', async () => {
    servico.get.mockResolvedValue({ ...base, connected: true, subdomain: 'habras', token_state: 'ready' });
    abrir(secoes(['/settings/cvcrm']));
    expect(screen.getByText('Leve os leads direto pro sistema que sua imobiliária já usa.')).toBeInTheDocument();
    expect(await screen.findByText('Conectado · habras.cvcrm.com.br')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /CVCRM/ })).toHaveAttribute('href', '/settings/cvcrm');
  });

  it('consulta falhou: cartão sem estado, sem erro, ainda clicável', async () => {
    servico.get.mockRejectedValue(new Error('rede'));
    abrir(secoes(['/settings/cvcrm']));
    await waitFor(() => expect(servico.get).toHaveBeenCalled());
    expect(screen.getByRole('link', { name: /CVCRM/ })).toHaveAttribute('href', '/settings/cvcrm');
    expect(screen.queryByText(/Conectado|Não conectado/)).toBeNull();
  });

  it('"Fale com o suporte" abre o chat de suporte', async () => {
    servico.get.mockResolvedValue({ ...base, connected: false, subdomain: null, token_state: 'none' });
    abrir(secoes(['/settings/cvcrm']));
    expect(screen.getByText(/Usa outro sistema\?/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Fale com o suporte' }));
    expect(suporte.openSupport).toHaveBeenCalled();
    // Espera a consulta assentar, pra não atualizar a tela fora do teste.
    expect(await screen.findByText('Não conectado')).toBeInTheDocument();
  });

  it('sem nenhum sistema visível: avisa e não consulta o CVCRM', () => {
    abrir(secoes([]));
    expect(screen.getByText('Nenhuma integração disponível pro seu acesso.')).toBeInTheDocument();
    expect(servico.get).not.toHaveBeenCalled();
  });
});
