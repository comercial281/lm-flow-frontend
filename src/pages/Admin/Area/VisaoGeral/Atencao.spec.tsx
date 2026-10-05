// src/pages/Admin/Area/VisaoGeral/Atencao.spec.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const apiGet = vi.hoisted(() => vi.fn());
vi.mock('@/services/core/api', () => ({ default: { get: apiGet } }));

import Atencao from './Atencao';

const resposta = (extra: Record<string, unknown> = {}) => ({ data: { success: true, data: {
  counts: { ativo: 12, provisionando: 1, congelado: 2, com_erro: 1 },
  clients: [
    { schema: 'tenant_b', name: 'Beta', slug: 'beta', severity: 'vermelho', problems: [
      { kind: 'numero_caido', severity: 'vermelho', numbers: [{ inbox_id: 1, name: 'Plantão', phone: null, since: null }] },
    ] },
    { schema: 'tenant_a', name: 'Alfa', slug: 'alfa', severity: 'amarelo', problems: [
      { kind: 'aviso_nao_chega', severity: 'amarelo', people: 3 },
    ] },
  ],
  ok_count: 9, generated_at: new Date().toISOString(), unreadable: [], ...extra,
} } });

const montar = () => render(<MemoryRouter><Atencao /></MemoryRouter>);

describe('Atenção', () => {
  beforeEach(() => apiGet.mockReset());

  it('mostra contadores e clientes com problema, vermelho primeiro, com o botão certo', async () => {
    apiGet.mockResolvedValue(resposta());
    montar();
    await waitFor(() => expect(screen.getByText('Beta')).toBeInTheDocument());
    expect(apiGet).toHaveBeenCalledWith('/super/overview/attention');
    expect(screen.getByText('Ativos').closest('div')).toHaveTextContent('12');
    const nomes = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(nomes).toEqual(['Beta', 'Alfa']);
    expect(screen.getByText('Número Plantão está desconectado')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver pessoas' })).toHaveAttribute('href', '/admin/usuarios?tenant=tenant_a&notificacao=com_problema');
    expect(screen.getByText('Os outros 9 clientes estão em ordem.')).toBeInTheDocument();
  });

  it('sem problema nenhum: tudo em ordem', async () => {
    apiGet.mockResolvedValue(resposta({ clients: [], ok_count: 14 }));
    montar();
    await waitFor(() => expect(screen.getByText('Tudo em ordem nos 14 clientes')).toBeInTheDocument());
  });

  it('cliente que não deu pra ler vira aviso', async () => {
    apiGet.mockResolvedValue(resposta({ unreadable: [{ name: 'Lento', message: 'não deu tempo de ler' }] }));
    montar();
    await waitFor(() => expect(screen.getByText(/Não deu pra conferir: Lento/)).toBeInTheDocument());
  });

  it('sem problema mas com cliente não lido: não atesta que está tudo em ordem', async () => {
    apiGet.mockResolvedValue(resposta({ clients: [], ok_count: 5, unreadable: [{ name: 'Lento', message: 'não deu tempo de ler' }] }));
    montar();
    await waitFor(() => expect(screen.getByText('Nenhum problema nos 5 clientes conferidos')).toBeInTheDocument());
    expect(screen.getByText(/Não deu pra conferir: Lento/)).toBeInTheDocument();
    expect(screen.queryByText(/Tudo em ordem/)).not.toBeInTheDocument();
  });

  it('erro aparece como erro e tenta de novo', async () => {
    apiGet.mockRejectedValueOnce(new Error('caiu')).mockResolvedValueOnce(resposta());
    montar();
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /tentar de novo/i }));
    await waitFor(() => expect(screen.getByText('Beta')).toBeInTheDocument());
  });
});
