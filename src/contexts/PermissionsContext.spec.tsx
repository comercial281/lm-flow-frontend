import React, { useEffect } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  user: { id: 'gestor' } as { id: string } | null,
  perms: { gestor: ['sales_agents.read'], corretor: ['contacts.read'] } as Record<string, string[]>,
  clearCache: vi.fn(),
}));
const atuais = () => (mocks.user ? mocks.perms[mocks.user.id] ?? [] : []);

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/services/permissions', () => ({
  permissionsService: {
    clearCache: (...a: unknown[]) => mocks.clearCache(...a),
    getResourceActions: vi.fn(async () => ({ data: { all_permissions: atuais().map(key => ({ key, display_name: key })) } })),
    getUserPermissions: vi.fn(async () => atuais()),
    getAccountPermissions: vi.fn(async () => atuais()),
  },
}));

import { useAuthStore } from '@/store/authStore';
import { useAuth } from '@/contexts/AuthContext';
import { permissionsService } from '@/services/permissions';
import { PermissionsProvider, usePermissions } from './PermissionsContext';

function Sonda() {
  const { can, isReady } = usePermissions();
  if (!isReady) return <p>carregando</p>;
  return <p>{can('sales_agents', 'read') ? 'vê IA' : 'não vê IA'}</p>;
}
const arvore = () => <PermissionsProvider><Sonda /></PermissionsProvider>;

// Sonda que grava, a cada COMMIT (nunca em render descartado), quem era o
// `user` e o que `can()` respondia naquele instante — é o jeito de flagrar a
// janela de 1 render em que `user` já é B mas as listas ainda são de A, sem
// depender da ordem de flush do `act()`.
type LogEntry = { userId?: string; can: boolean; isReady: boolean };
function SondaGravada({ log }: { log: LogEntry[] }) {
  const { can, isReady } = usePermissions();
  const { user } = useAuth();
  useEffect(() => {
    log.push({ userId: user?.id, can: can('sales_agents', 'read'), isReady });
  });
  if (!isReady) return <p>carregando</p>;
  return <p>{can('sales_agents', 'read') ? 'vê IA' : 'não vê IA'}</p>;
}
const arvoreGravada = (log: LogEntry[]) => (
  <PermissionsProvider><SondaGravada log={log} /></PermissionsProvider>
);

// Sonda que expõe as listas CRUAS (sem passar pelo `can()`/`isValidPermission`,
// que filtra pelo `resourceActions` — e o `resourceActions` da pessoa NOVA já
// está certo bem antes das listas de permissão, então `can()` mascara um
// vazamento de `accountPermissions`/`userPermissions`). É o teste do I2.
function SondaCrua() {
  const { accountPermissions, userPermissions, isReady } = usePermissions();
  if (!isReady) return <p>carregando</p>;
  return <p>conta:{accountPermissions.join('|')};usuario:{userPermissions.join('|')}</p>;
}
const arvoreCrua = () => <PermissionsProvider><SondaCrua /></PermissionsProvider>;

describe('PermissionsProvider na troca de pessoa', () => {
  beforeEach(() => {
    mocks.user = { id: 'gestor' };
    mocks.clearCache.mockClear();
    useAuthStore.setState({ isLoggedIn: true });
    vi.mocked(permissionsService.getUserPermissions).mockImplementation(async () => atuais());
    vi.mocked(permissionsService.getAccountPermissions).mockImplementation(async () => atuais());
    vi.mocked(permissionsService.getResourceActions).mockImplementation(async () => ({
      data: { all_permissions: atuais().map(key => ({ key, display_name: key })) },
    }) as never);
  });

  it('o corretor que entra depois do gestor NÃO herda o menu do gestor', async () => {
    const { rerender } = render(arvore());
    expect(await screen.findByText('vê IA')).toBeInTheDocument();
    mocks.user = { id: 'corretor' };
    rerender(arvore());
    expect(await screen.findByText('não vê IA')).toBeInTheDocument();
    expect(mocks.clearCache).toHaveBeenCalled();
  });

  it('logout limpa o cache do serviço', async () => {
    const { rerender } = render(arvore());
    await screen.findByText('vê IA');
    mocks.clearCache.mockClear();
    mocks.user = null;
    rerender(arvore());
    expect(mocks.clearCache).toHaveBeenCalled();
  });

  it('o mesmo usuário re-renderizando NÃO busca de novo nem limpa o cache', async () => {
    const { rerender } = render(arvore());
    await screen.findByText('vê IA');
    mocks.clearCache.mockClear();
    vi.mocked(permissionsService.getUserPermissions).mockClear();
    vi.mocked(permissionsService.getAccountPermissions).mockClear();
    vi.mocked(permissionsService.getResourceActions).mockClear();

    // Mesmo id de usuário (nova referência de objeto, como um re-render comum) —
    // não é troca de pessoa nem logout.
    mocks.user = { id: 'gestor' };
    rerender(arvore());
    await screen.findByText('vê IA');

    expect(mocks.clearCache).not.toHaveBeenCalled();
    expect(permissionsService.getUserPermissions).not.toHaveBeenCalled();
    expect(permissionsService.getAccountPermissions).not.toHaveBeenCalled();
    expect(permissionsService.getResourceActions).not.toHaveBeenCalled();
  });

  // Fix round 1 (I1): a troca roda no corpo do render (bail-out), nunca só num
  // useEffect — senão, por UM render, `user` já é B mas as listas e o
  // `isReady` ainda são os de A. Não checamos isso no DOM logo após o
  // rerender (o `act()` do RTL pode já ter flushado os efeitos síncronos até
  // lá) — em vez disso GRAVAMOS todo commit e provamos que nenhum deles
  // mostrou as permissões de A com o usuário já sendo B.
  it('nenhum commit mostra a lista do gestor com o usuário já sendo corretor', async () => {
    const log: LogEntry[] = [];
    const { rerender } = render(arvoreGravada(log));
    await screen.findByText('vê IA');

    mocks.user = { id: 'corretor' };
    rerender(arvoreGravada(log));
    await screen.findByText('não vê IA');

    const vazamento = log.some(entry => entry.userId === 'corretor' && entry.can === true);
    expect(vazamento).toBe(false);
  });

  // Fix round 1 (I2): resposta atrasada de quem SAIU não pode sobrescrever
  // quem entrou. Controlamos a ordem de resolução das promessas para
  // simular exatamente isso: a do gestor (que já estava em voo) resolve
  // DEPOIS da do corretor.
  it('a promessa do gestor resolvendo DEPOIS da do corretor não sobrescreve o corretor', async () => {
    let resolveGestor!: (v: string[]) => void;
    let resolveCorretor!: (v: string[]) => void;
    const gestorPromise = new Promise<string[]>(res => { resolveGestor = res; });
    const corretorPromise = new Promise<string[]>(res => { resolveCorretor = res; });

    vi.mocked(permissionsService.getUserPermissions)
      .mockImplementationOnce(() => gestorPromise)
      .mockImplementationOnce(() => corretorPromise);
    vi.mocked(permissionsService.getAccountPermissions)
      .mockImplementationOnce(() => gestorPromise)
      .mockImplementationOnce(() => corretorPromise);

    const { rerender } = render(arvoreCrua()); // dispara o efeito do gestor (pendente)

    mocks.user = { id: 'corretor' };
    rerender(arvoreCrua()); // limpeza do efeito do gestor + efeito do corretor (pendente)

    // o corretor chega primeiro
    await act(async () => {
      resolveCorretor(mocks.perms.corretor);
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    expect(await screen.findByText('conta:contacts.read;usuario:contacts.read')).toBeInTheDocument();

    // o gestor chega depois, atrasado — se não fosse descartado pela
    // limpeza do efeito anterior, sobrescreveria o corretor de volta. O
    // `act(async ...)` com um tick de macrotask de verdade é necessário
    // aqui: sem ele, a atualização (bugada ou não) fica só ENFILEIRADA no
    // agendador do React e nunca chega a comitar no DOM dentro do teste —
    // o que faria este teste "passar" mesmo com o defeito presente.
    await act(async () => {
      resolveGestor(mocks.perms.gestor);
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Checamos a lista CRUA (não o `can()`): o `resourceActions` da pessoa
    // nova já é o certo bem antes disso, e mascararia o vazamento se
    // checássemos só pelo `can()`.
    expect(screen.queryByText(/sales_agents\.read/)).not.toBeInTheDocument();
    expect(screen.getByText('conta:contacts.read;usuario:contacts.read')).toBeInTheDocument();
  });
});
