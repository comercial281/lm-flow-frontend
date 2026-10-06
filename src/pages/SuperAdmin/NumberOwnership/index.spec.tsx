import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

// A aba Números lê a lista de clientes e o diagnóstico de cada um em lotes de
// 4 (loadInBatches, de verdade — não é dublado aqui: é ele quem faz a tabela
// preencher cliente a cliente, e um teste que o dublasse não provaria a fiação
// real). O que é dublado é só a fala com o servidor (o serviço).
const listTenants = vi.hoisted(() => vi.fn());
const diagnose = vi.hoisted(() => vi.fn());
const enableRule = vi.hoisted(() => vi.fn());
const disableRule = vi.hoisted(() => vi.fn());
const platformNumbers = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());

vi.mock('@/services/superAdmin/numberOwnershipService', () => ({
  default: { listTenants, diagnose, enableRule, disableRule, platformNumbers },
}));
vi.mock('sonner', () => ({ toast: { success: toastSuccess, error: toastError } }));

import NumberOwnership from './index';
import type {
  ConnectionSummary, OwnershipDiagnosis, OwnershipNumber, OwnershipTenant,
} from '@/services/superAdmin/numberOwnershipService';

// Entrega 4: o resumo de conexão que a lista traz. Padrão = 1 número conectado.
function resumo(over: Partial<ConnectionSummary> = {}): ConnectionSummary {
  return { connected: 1, connecting: 0, down: 0, never: 0, official: 0, unknown: 0, total: 1, ...over };
}

function tenant(id: string, name: string, connectionSummary: ConnectionSummary | null = resumo()): OwnershipTenant {
  return { id, name, slug: name.toLowerCase(), schema: `tenant_${id}`, connection_summary: connectionSummary };
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

function numero(over: Partial<OwnershipNumber> = {}): OwnershipNumber {
  return {
    inbox_id: 'i1', name: 'Número', phone: null, connection: 'connected', situation: 'connected', disconnected_at: null,
    responsible: null, roletas: [], liberated: [], suggested_owner: null, source: 'shared', source_roleta: null,
    phone_matches: false, conflicts: [], conflict_codes: [], ...over,
  };
}

function okResponse<T>(data: T) {
  return { data: { data } };
}

// A tela lê o endereço (?cliente=): sempre dentro de um roteador.
function montar(url = '/admin/clientes/numeros') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <NumberOwnership />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  listTenants.mockReset();
  diagnose.mockReset();
  enableRule.mockReset();
  disableRule.mockReset();
  platformNumbers.mockReset();
  platformNumbers.mockResolvedValue(okResponse({ unreadable: false, numbers: [] }));
  toastSuccess.mockReset();
  toastError.mockReset();
});

describe('NumberOwnership', () => {
  it('lista os clientes e mostra "lendo…" antes do diagnóstico chegar', async () => {
    listTenants.mockResolvedValue(okResponse([tenant('a', 'APTO PREMIUM')]));
    let resolveDiag: (v: unknown) => void = () => {};
    diagnose.mockReturnValue(new Promise(res => { resolveDiag = res; }));

    montar();

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

    montar();

    await waitFor(() => expect(screen.getByText('Precisa conferir (2)')).toBeInTheDocument());
    expect(diagnose).toHaveBeenCalledWith('a', false);
  });

  it('cliente cuja leitura falhou aparece como "Não consegui ler", e o resto segue', async () => {
    listTenants.mockResolvedValue(okResponse([tenant('a', 'Quebrado'), tenant('b', 'Bom')]));
    diagnose.mockImplementation((id: string) =>
      id === 'a' ? Promise.reject(new Error('boom')) : Promise.resolve(okResponse(diagnosis('b'))),
    );

    montar();

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

    montar();

    await waitFor(() => expect(screen.getByText('este cliente ainda não tem as tabelas da roleta')).toBeInTheDocument());
  });

  // Review Focus 2: erro de leitura nunca aparece como lista vazia.
  it('lista quebrada é erro com "Tentar de novo", nunca lista vazia', async () => {
    listTenants.mockRejectedValueOnce(new Error('rede caiu')).mockResolvedValue(okResponse([tenant('a', 'Cliente A')]));
    diagnose.mockResolvedValue(okResponse(diagnosis('a')));

    montar();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('Nenhum cliente em uso')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Cliente A')).toBeInTheDocument();
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

    montar();

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
              situation: 'connected',
              disconnected_at: null,
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

    montar();

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

    montar();

    const row = await screen.findByText('Sem tabela');
    await userEvent.click(row);

    expect(screen.queryByText('Pessoa por pessoa')).not.toBeInTheDocument();
  });

  it('Atualizar pede o diagnóstico de novo com refresh', async () => {
    listTenants.mockResolvedValue(okResponse([tenant('a', 'Cliente A')]));
    diagnose.mockResolvedValue(okResponse(diagnosis('a')));

    montar();

    await waitFor(() => expect(diagnose).toHaveBeenCalledWith('a', false));

    await userEvent.click(screen.getByRole('button', { name: /Atualizar/ }));

    await waitFor(() => expect(diagnose).toHaveBeenCalledWith('a', true));
  });

  it('mostra o resumo no topo com as contagens da carteira', async () => {
    listTenants.mockResolvedValue(okResponse([tenant('a', 'Cliente A')]));
    diagnose.mockResolvedValue(okResponse(diagnosis('a')));

    montar();

    await waitFor(() => expect(screen.getByText(/1 cliente migra sozinho/)).toBeInTheDocument());
  });
});

// Fase 2b.1 — Ligar/Desligar dono do número. Escrita em produção: o botão pede
// confirmação (o Dialog da casa, nunca a caixinha do navegador), mostra a
// leitura NOVA que o servidor devolve e, na recusa, o motivo dele.
describe('NumberOwnership — Ligar/Desligar dono do número', () => {
  const desligada = { enabled: false, last: null };

  async function abrir(nome: string) {
    await userEvent.click(await screen.findByText(nome));
  }

  it('Ligar: confirma, chama o servidor e mostra a regra ligada', async () => {
    listTenants.mockResolvedValue(okResponse([tenant('a', 'APTO PREMIUM')]));
    diagnose.mockResolvedValue(okResponse(diagnosis('a', { rule: desligada })));
    enableRule.mockResolvedValue(okResponse(diagnosis('a', {
      rule: { enabled: true, last: { action: 'enable', at: '2026-09-28T15:04:05-03:00', by: 'fulano@x', changed: 1 } },
    })));

    montar();
    await abrir('APTO PREMIUM');
    await userEvent.click(await screen.findByRole('button', { name: 'Ligar dono do número' }));

    expect(await screen.findByText('Ligar dono do número em APTO PREMIUM?')).toBeInTheDocument();
    expect(enableRule).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Ligar' }));

    await waitFor(() => expect(enableRule).toHaveBeenCalledWith('a'));
    expect(await screen.findByText('Ligado em 28/09/2026 15:04 por fulano@x · 1 dono gravado')).toBeInTheDocument();
    expect(toastSuccess).toHaveBeenCalledWith('Dono do número ligado em APTO PREMIUM: 1 dono gravado.');
  });

  it('cancelar a confirmação não chama o servidor', async () => {
    listTenants.mockResolvedValue(okResponse([tenant('a', 'APTO PREMIUM')]));
    diagnose.mockResolvedValue(okResponse(diagnosis('a', { rule: desligada })));

    montar();
    await abrir('APTO PREMIUM');
    await userEvent.click(await screen.findByRole('button', { name: 'Ligar dono do número' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));

    expect(enableRule).not.toHaveBeenCalled();
  });

  it('precisa conferir: o botão fica desligado, com o caminho', async () => {
    listTenants.mockResolvedValue(okResponse([tenant('a', 'Cliente B')]));
    diagnose.mockResolvedValue(okResponse(diagnosis('a', {
      verdict: 'needs_review', summary: { numbers: 1, owned: 0, shared: 0, needs_review: 1 }, rule: desligada,
    })));

    montar();
    await abrir('Cliente B');

    expect(await screen.findByRole('button', { name: 'Ligar dono do número' })).toBeDisabled();
    expect(screen.getByText(/Precisa conferir antes: resolva cada número abaixo/)).toBeInTheDocument();
  });

  it('recusa do servidor: o motivo dele no aviso, e a linha continua como estava', async () => {
    listTenants.mockResolvedValue(okResponse([tenant('a', 'APTO PREMIUM')]));
    diagnose.mockResolvedValue(okResponse(diagnosis('a', { rule: desligada })));
    enableRule.mockRejectedValue({ response: { status: 422, data: { error: 'Não consegui ler a Equipe do painel raiz agora.' } } });

    montar();
    await abrir('APTO PREMIUM');
    await userEvent.click(await screen.findByRole('button', { name: 'Ligar dono do número' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Ligar' }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Não consegui ler a Equipe do painel raiz agora.'));
    expect(screen.getByText('Dono do número: desligado')).toBeInTheDocument();
  });

  it('falha inesperada (500) também mostra a frase do servidor, não a genérica', async () => {
    listTenants.mockResolvedValue(okResponse([tenant('a', 'APTO PREMIUM')]));
    diagnose.mockResolvedValue(okResponse(diagnosis('a', { rule: desligada })));
    enableRule.mockRejectedValue({
      response: { status: 500, data: { error: 'Não consegui ligar agora; nada foi gravado. Tente de novo em instantes.' } },
    });

    montar();
    await abrir('APTO PREMIUM');
    await userEvent.click(await screen.findByRole('button', { name: 'Ligar dono do número' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Ligar' }));

    await waitFor(() => expect(toastError)
      .toHaveBeenCalledWith('Não consegui ligar agora; nada foi gravado. Tente de novo em instantes.'));
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it('Desligar: pede confirmação e chama o servidor', async () => {
    listTenants.mockResolvedValue(okResponse([tenant('a', 'APTO PREMIUM')]));
    diagnose.mockResolvedValue(okResponse(diagnosis('a', { rule: { enabled: true, last: null } })));
    disableRule.mockResolvedValue(okResponse(diagnosis('a', {
      rule: { enabled: false, last: { action: 'disable', at: '2026-09-29T09:00:00-03:00', by: 'fulano@x', changed: 0 } },
    })));

    montar();
    await abrir('APTO PREMIUM');
    await userEvent.click(await screen.findByRole('button', { name: 'Desligar dono do número' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Desligar' }));

    await waitFor(() => expect(disableRule).toHaveBeenCalledWith('a'));
    expect(await screen.findByText('Desligado em 29/09/2026 09:00 por fulano@x')).toBeInTheDocument();
  });

  it('servidor antigo (sem a regra): nenhum botão de ligar', async () => {
    listTenants.mockResolvedValue(okResponse([tenant('a', 'APTO PREMIUM')]));
    diagnose.mockResolvedValue(okResponse(diagnosis('a')));

    montar();
    await abrir('APTO PREMIUM');

    expect(await screen.findByText('Pessoa por pessoa')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /dono do número/ })).not.toBeInTheDocument();
  });

  it('cada conflito mostra o caminho para resolver, escolhido pelo código', async () => {
    listTenants.mockResolvedValue(okResponse([tenant('a', 'Cliente C')]));
    diagnose.mockResolvedValue(okResponse(diagnosis('a', {
      verdict: 'needs_review',
      summary: { numbers: 1, owned: 0, shared: 1, needs_review: 1 },
      rule: desligada,
      numbers: [{
        inbox_id: 'i1', name: 'Do suporte', phone: null, connection: 'unknown', situation: 'unknown', disconnected_at: null,
        responsible: { id: 'u9', name: 'Suporte LM', active: true }, roletas: [], liberated: [],
        suggested_owner: null, source: 'shared', source_roleta: null, phone_matches: false,
        conflicts: ['O dono sugerido (Suporte LM) é da equipe da Leal Mídia: conta de suporte não vira dona de número'],
        conflict_codes: ['support_owner'],
      }],
    })));

    montar();
    await abrir('Cliente C');

    expect(await screen.findByText('Tire a conta da Leal Mídia do Dono do número em Canais.')).toBeInTheDocument();
  });
});

// Entrega 4 — Números conectados: contadores, selo por cliente, caído no topo,
// "Só caídos" e a situação de cada número no detalhe.
describe('NumberOwnership — Números conectados', () => {
  it('topo com os contadores e selo de conexão em cada cliente', async () => {
    listTenants.mockResolvedValue(okResponse([
      tenant('a', 'Alfa', resumo({ connected: 2, total: 2 })),
      tenant('b', 'Bravo', resumo({ connected: 1, down: 2, total: 3 })),
      tenant('c', 'Charlie', null),
    ]));
    diagnose.mockImplementation((id: string) => Promise.resolve(okResponse(diagnosis(id))));

    montar();

    expect(await screen.findByText('5 números · 3 conectados · 2 caídos · 0 sem leitura · 1 cliente sem leitura'))
      .toBeInTheDocument();
    expect(screen.getByText('Tudo conectado')).toBeInTheDocument();
    expect(screen.getByText('2 caídos')).toBeInTheDocument();
    expect(screen.getByText('Sem leitura')).toBeInTheDocument();
  });

  it('cliente com número caído sobe para o topo, antes de quem precisa conferir', async () => {
    listTenants.mockResolvedValue(okResponse([
      tenant('a', 'Alfa Conferir'),
      tenant('b', 'Bravo Caído', resumo({ connected: 0, down: 1, total: 1 })),
    ]));
    diagnose.mockImplementation((id: string) => Promise.resolve(okResponse(
      id === 'a'
        ? diagnosis('a', { verdict: 'needs_review', summary: { numbers: 1, owned: 0, shared: 0, needs_review: 1 } })
        : diagnosis('b'),
    )));

    montar();

    await waitFor(() => expect(screen.getByText('Precisa conferir (1)')).toBeInTheDocument());
    const linhas = screen.getAllByRole('row').map((r) => r.textContent ?? '');
    expect(linhas.findIndex((t) => t.includes('Bravo Caído'))).toBeLessThan(linhas.findIndex((t) => t.includes('Alfa Conferir')));
  });

  it('"Só caídos" deixa só quem tem número caído', async () => {
    listTenants.mockResolvedValue(okResponse([
      tenant('a', 'Alfa'), tenant('b', 'Bravo', resumo({ connected: 0, down: 1, total: 1 })),
    ]));
    diagnose.mockImplementation((id: string) => Promise.resolve(okResponse(diagnosis(id))));

    montar();
    await screen.findByText('Alfa');
    await userEvent.click(screen.getByRole('button', { name: 'Só caídos' }));

    expect(screen.queryByText('Alfa')).not.toBeInTheDocument();
    expect(screen.getByText('Bravo')).toBeInTheDocument();
  });

  it('"Só caídos" sem nenhum caído diz isso e deixa limpar', async () => {
    listTenants.mockResolvedValue(okResponse([tenant('a', 'Alfa')]));
    diagnose.mockResolvedValue(okResponse(diagnosis('a')));

    montar();
    await screen.findByText('Alfa');
    await userEvent.click(screen.getByRole('button', { name: 'Só caídos' }));

    expect(screen.getByText('Nenhum número caído')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(screen.getByText('Alfa')).toBeInTheDocument();
  });

  it('detalhe: número caído primeiro, com "Caiu há…"; os outros com o texto da situação', async () => {
    const desde = new Date(Date.now() - (2 * 60 + 5) * 60_000).toISOString();
    listTenants.mockResolvedValue(okResponse([
      tenant('a', 'Alfa', resumo({ connected: 0, down: 1, official: 1, never: 1, total: 3 })),
    ]));
    diagnose.mockResolvedValue(okResponse(diagnosis('a', {
      numbers: [
        numero({ inbox_id: 'i1', name: 'Oficial', connection: 'unknown', situation: 'official' }),
        numero({ inbox_id: 'i2', name: 'Novo', connection: 'disconnected', situation: 'never' }),
        numero({ inbox_id: 'i3', name: 'Plantão', connection: 'disconnected', situation: 'disconnected', disconnected_at: desde }),
      ],
    })));

    montar();
    await userEvent.click(await screen.findByText('Alfa'));

    expect(await screen.findByText(/^Caiu há 2 h \(desde \d{2}\/\d{2} \d{2}:\d{2}\)$/)).toBeInTheDocument();
    expect(screen.getByText('API oficial · sem conexão a vigiar')).toBeInTheDocument();
    expect(screen.getByText('Nunca conectado')).toBeInTheDocument();
    const plantao = screen.getByText('Plantão');
    expect(plantao.compareDocumentPosition(screen.getByText('Oficial')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('nenhum cliente em uso: estado vazio, não erro', async () => {
    listTenants.mockResolvedValue(okResponse([]));

    montar();

    expect(await screen.findByText('Nenhum cliente em uso')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
