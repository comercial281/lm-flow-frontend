import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// A aba Números lê a lista de clientes e o diagnóstico de cada um em lotes de
// 4 (loadInBatches, de verdade — não é dublado aqui: é ele quem faz a tabela
// preencher cliente a cliente, e um teste que o dublasse não provaria a fiação
// real). O que é dublado é só a fala com o servidor (o serviço).
const listTenants = vi.hoisted(() => vi.fn());
const diagnose = vi.hoisted(() => vi.fn());

vi.mock('@/services/superAdmin/numberOwnershipService', () => ({
  default: { listTenants, diagnose },
}));

import NumberOwnership from './index';
import type { OwnershipDiagnosis, OwnershipTenant } from '@/services/superAdmin/numberOwnershipService';

function tenant(id: string, name: string): OwnershipTenant {
  return { id, name, slug: name.toLowerCase() };
}

function diagnosis(tenantId: string, over: Partial<OwnershipDiagnosis> = {}): OwnershipDiagnosis {
  return {
    tenant: tenant(tenantId, tenantId),
    verdict: 'migrates',
    reason: null,
    summary: { numbers: 1, owned: 1, shared: 0, needs_review: 0 },
    numbers: [],
    people: [],
    read_at: '2026-09-26T15:04:05-03:00',
    ...over,
  };
}

function okResponse<T>(data: T) {
  return { data: { data } };
}

beforeEach(() => {
  listTenants.mockReset();
  diagnose.mockReset();
});

describe('NumberOwnership', () => {
  it('lista os clientes e mostra "lendo…" antes do diagnóstico chegar', async () => {
    listTenants.mockResolvedValue(okResponse([tenant('a', 'APTO PREMIUM')]));
    let resolveDiag: (v: unknown) => void = () => {};
    diagnose.mockReturnValue(new Promise(res => { resolveDiag = res; }));

    render(<NumberOwnership />);

    await screen.findByText('APTO PREMIUM');
    expect(screen.getByText('lendo…')).toBeInTheDocument();

    resolveDiag(okResponse(diagnosis('a')));
    await waitFor(() => expect(screen.getByText('Migra sozinho')).toBeInTheDocument());
  });

  it('pede o diagnóstico de cada cliente e mostra o selo quando chega', async () => {
    listTenants.mockResolvedValue(okResponse([tenant('a', 'Cliente A')]));
    diagnose.mockResolvedValue(okResponse(diagnosis('a', {
      verdict: 'needs_review',
      summary: { numbers: 2, owned: 0, shared: 0, needs_review: 2 },
    })));

    render(<NumberOwnership />);

    await waitFor(() => expect(screen.getByText('Precisa conferir (2)')).toBeInTheDocument());
    expect(diagnose).toHaveBeenCalledWith('a', false);
  });

  it('cliente cuja leitura falhou aparece como "Não consegui ler", e o resto segue', async () => {
    listTenants.mockResolvedValue(okResponse([tenant('a', 'Quebrado'), tenant('b', 'Bom')]));
    diagnose.mockImplementation((id: string) =>
      id === 'a' ? Promise.reject(new Error('boom')) : Promise.resolve(okResponse(diagnosis('b'))),
    );

    render(<NumberOwnership />);

    await waitFor(() => expect(screen.getByText('o servidor não respondeu a este cliente')).toBeInTheDocument());
    expect(screen.getByText('Migra sozinho')).toBeInTheDocument();
  });

  it('cliente ilegível vira "Não consegui ler" com o motivo do servidor', async () => {
    listTenants.mockResolvedValue(okResponse([tenant('a', 'Sem tabela')]));
    diagnose.mockResolvedValue(okResponse(diagnosis('a', {
      verdict: 'unreadable',
      reason: 'este cliente ainda não tem as tabelas da roleta',
      summary: { numbers: 0, owned: 0, shared: 0, needs_review: 0 },
    })));

    render(<NumberOwnership />);

    await waitFor(() => expect(screen.getByText('este cliente ainda não tem as tabelas da roleta')).toBeInTheDocument());
  });

  it('lista quebrada mostra o aviso de "Não consegui carregar"', async () => {
    listTenants.mockRejectedValue(new Error('rede caiu'));

    render(<NumberOwnership />);

    await screen.findByText('Não consegui carregar a lista de clientes. Tente Atualizar.');
  });

  it('mostra os que precisam conferir antes dos que migram sozinhos', async () => {
    listTenants.mockResolvedValue(okResponse([tenant('a', 'Cliente Tranquilo'), tenant('b', 'Cliente Bagunçado')]));
    diagnose.mockImplementation((id: string) =>
      Promise.resolve(
        okResponse(
          id === 'a'
            ? diagnosis('a')
            : diagnosis('b', { verdict: 'needs_review', summary: { numbers: 1, owned: 0, shared: 0, needs_review: 1 } }),
        ),
      ),
    );

    render(<NumberOwnership />);

    await waitFor(() => expect(screen.getByText('Precisa conferir (1)')).toBeInTheDocument());
    const nameCells = screen.getAllByRole('row').map(r => r.textContent ?? '');
    const bagunçadoIndex = nameCells.findIndex(t => t.includes('Cliente Bagunçado'));
    const tranquiloIndex = nameCells.findIndex(t => t.includes('Cliente Tranquilo'));
    expect(bagunçadoIndex).toBeGreaterThan(-1);
    expect(bagunçadoIndex).toBeLessThan(tranquiloIndex);
  });

  it('clicar num cliente lido abre o detalhe por número e por pessoa', async () => {
    listTenants.mockResolvedValue(okResponse([tenant('a', 'Cliente A')]));
    diagnose.mockResolvedValue(
      okResponse(
        diagnosis('a', {
          numbers: [
            {
              inbox_id: 'i1',
              name: 'WhatsApp do Fulano',
              phone: '+5511999990001',
              connection: 'connected',
              responsible: { id: 'u1', name: 'Fulano', active: true },
              roletas: [],
              liberated: [],
              suggested_owner: { id: 'u1', name: 'Fulano', active: true },
              source: 'responsible',
              source_roleta: null,
              phone_matches: true,
              conflicts: [],
            },
          ],
          people: [
            { id: 'u1', name: 'Fulano', corretor: true, active: true, numbers: [{ inbox_id: 'i1', name: 'WhatsApp do Fulano' }], no_number: false },
          ],
        }),
      ),
    );

    render(<NumberOwnership />);

    const row = await screen.findByText('Cliente A');
    await userEvent.click(row);

    expect(await screen.findByText('Pessoa por pessoa')).toBeInTheDocument();
    expect(screen.getByText('+5511999990001', { exact: false })).toBeInTheDocument();
    expect(screen.getAllByText('Fulano').length).toBeGreaterThan(0);
  });

  it('cliente ilegível não abre detalhe ao clicar', async () => {
    listTenants.mockResolvedValue(okResponse([tenant('a', 'Sem tabela')]));
    diagnose.mockResolvedValue(okResponse(diagnosis('a', {
      verdict: 'unreadable',
      reason: 'este cliente ainda não tem as tabelas da roleta',
      summary: { numbers: 0, owned: 0, shared: 0, needs_review: 0 },
    })));

    render(<NumberOwnership />);

    const row = await screen.findByText('Sem tabela');
    await userEvent.click(row);

    expect(screen.queryByText('Pessoa por pessoa')).not.toBeInTheDocument();
  });

  it('Atualizar pede o diagnóstico de novo com refresh', async () => {
    listTenants.mockResolvedValue(okResponse([tenant('a', 'Cliente A')]));
    diagnose.mockResolvedValue(okResponse(diagnosis('a')));

    render(<NumberOwnership />);

    await waitFor(() => expect(diagnose).toHaveBeenCalledWith('a', false));

    await userEvent.click(screen.getByRole('button', { name: /Atualizar/ }));

    await waitFor(() => expect(diagnose).toHaveBeenCalledWith('a', true));
  });

  it('mostra o resumo no topo com as contagens da carteira', async () => {
    listTenants.mockResolvedValue(okResponse([tenant('a', 'Cliente A')]));
    diagnose.mockResolvedValue(okResponse(diagnosis('a')));

    render(<NumberOwnership />);

    await waitFor(() => expect(screen.getByText(/1 cliente migra sozinho/)).toBeInTheDocument());
  });
});
