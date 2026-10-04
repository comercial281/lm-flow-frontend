import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Clock, LogIn, MonitorSmartphone, Timer } from 'lucide-react';
import AdminConteudo from '@/pages/Admin/Area/AdminConteudo';
import BaseStatsGrid from '@/components/base/BaseStatsGrid';
import BaseTable from '@/components/base/BaseTable';
import { BaseStatusBadge } from '@/components/base';
import EmptyState from '@/components/base/EmptyState';
import { dataHora, numero, tempoDesde, VAZIO } from '@/lib/formato';
import { usersService } from '@/services/superAdmin/usersService';
import type { UserEntry, UserProfile } from '@/types/admin/users';
import AcoesDeAcesso from './AcoesDeAcesso';
import NotificacoesDaPessoa from './NotificacoesDaPessoa';
import { duracao, rotuloSituacao, statusDaSituacao } from './formatoUsuarios';

// Ficha de uma pessoa (Clientes → Usuários → clique no nome). A chave é cliente + id.
type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'erro' }
  | { tipo: 'naoEncontrado' }
  | { tipo: 'pronto'; perfil: UserProfile };

export default function FichaDoUsuario() {
  const { tenant = '', userId = '' } = useParams();
  const { search } = useLocation();
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' });
  // Só a última busca vale: ficha de outra URL não é sobrescrita por resposta atrasada.
  const seq = useRef(0);

  const carregar = useCallback(async () => {
    const minha = ++seq.current;
    setEstado({ tipo: 'carregando' });
    try {
      const perfil = await usersService.profile(tenant, userId);
      if (minha !== seq.current) return;
      setEstado({ tipo: 'pronto', perfil });
    } catch (e) {
      if (minha !== seq.current) return;
      setEstado((e as { response?: { status?: number } })?.response?.status === 404 ? { tipo: 'naoEncontrado' } : { tipo: 'erro' });
    }
  }, [tenant, userId]);

  useEffect(() => { void carregar(); }, [carregar]);

  const voltar = (
    <Link to={`/admin/usuarios${search}`} className="text-sm text-primary underline-offset-2 hover:underline">← Usuários</Link>
  );

  let corpo: React.ReactNode;
  if (estado.tipo === 'carregando') {
    corpo = (
      <div aria-busy="true" className="flex flex-col gap-3">
        <div className="h-10 w-64 animate-pulse rounded-lg bg-muted" />
        <div className="h-24 animate-pulse rounded-lg bg-muted" />
        <div className="h-48 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  } else if (estado.tipo === 'naoEncontrado') {
    corpo = <EmptyState tipo="vazio" title="Usuário não encontrado" description="Esta pessoa não existe mais ou o endereço está errado." />;
  } else if (estado.tipo === 'erro') {
    corpo = <EmptyState tipo="erro" title="Não deu para carregar esta pessoa" aoTentarDeNovo={() => void carregar()} />;
  } else {
    corpo = <Conteudo perfil={estado.perfil} aoTentarDeNovo={() => void carregar()} />;
  }

  return (
    <AdminConteudo>
      <div className="flex flex-col gap-4">
        {voltar}
        {corpo}
      </div>
    </AdminConteudo>
  );
}

function Conteudo({ perfil, aoTentarDeNovo }: { perfil: UserProfile; aoTentarDeNovo: () => void }) {
  const { person, summary, entries, actions, notifications } = perfil;
  const telaTop = summary.top_screens[0];
  const maximo = Math.max(1, ...summary.top_screens.map((t) => t.seconds));

  const cards = [
    { title: 'Último acesso', value: person.last_seen_at ? tempoDesde(person.last_seen_at) : VAZIO, icon: Clock, valueFormat: 'custom' as const },
    { title: 'Acessos (30 dias)', value: numero(person.accesses_30d), icon: LogIn, valueFormat: 'custom' as const },
    { title: 'Tempo de uso (30 dias)', value: duracao(person.seconds_30d), icon: Timer, valueFormat: 'custom' as const },
    { title: 'Tela mais usada', value: telaTop?.screen ?? VAZIO, icon: MonitorSmartphone, valueFormat: 'custom' as const },
  ];

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="truncate text-xl font-semibold">{person.name}</h2>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {person.email && <><span>{person.email}</span><span aria-hidden="true">·</span></>}
            <span>{person.tenant_name}</span>
            <span aria-hidden="true">·</span>
            <span>{person.role}</span>
            <span aria-hidden="true">·</span>
            <BaseStatusBadge status={statusDaSituacao(person.situation)} text={rotuloSituacao(person.situation)} />
          </div>
        </div>
        <AcoesDeAcesso row={person} />
      </div>

      <BaseStatsGrid cards={cards} columns={4} />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">Entradas</h3>
          {entries.length === 0 ? (
            <EmptyState tipo="vazio" title="Ainda não entrou no LM Flow" />
          ) : (
            <BaseTable<UserEntry & { pos: number }>
              data={entries.map((e, pos) => ({ ...e, pos }))}
              getRowKey={(e) => `${e.started_at}:${e.ip ?? ''}:${e.device}:${e.pos}`}
              columns={[
                { key: 'started_at', label: 'Quando', render: (e) => dataHora(e.started_at) },
                { key: 'device', label: 'Aparelho', render: (e) => (
                  <div className="flex flex-wrap items-center gap-2">
                    <span>{e.device || VAZIO}</span>
                    {e.new_device && <BaseStatusBadge status="warning" text="Aparelho novo" />}
                  </div>
                ) },
                { key: 'ip', label: 'Rede (IP)', render: (e) => e.ip ?? VAZIO },
                { key: 'duration_seconds', label: 'Duração', render: (e) => duracao(e.duration_seconds) },
              ]}
            />
          )}
        </section>

        <section className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">Telas que mais usa</h3>
          {summary.top_screens.length === 0 ? (
            <EmptyState tipo="vazio" title="Sem uso registrado nos últimos 30 dias" />
          ) : (
            <ul className="flex flex-col gap-3">
              {summary.top_screens.map((t) => (
                <li key={t.screen} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate">{t.screen}</span>
                    <span className="shrink-0 tabular-nums">{duracao(t.seconds)}</span>
                  </div>
                  <div aria-hidden="true" className="h-1.5 w-full rounded-full bg-muted">
                    <div className="h-1.5 rounded-full bg-primary" style={{ width: `${Math.min(100, (t.seconds / maximo) * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <NotificacoesDaPessoa dados={notifications ?? null} telefone={person.phone} aoTentarDeNovo={aoTentarDeNovo} />

      <section className="rounded-lg border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold">Histórico de ações</h3>
        {actions.length === 0 ? (
          <EmptyState tipo="vazio" title="Nenhuma ação registrada" />
        ) : (
          <ul className="flex flex-col divide-y">
            {actions.map((a, i) => (
              <li key={`${a.occurred_at}:${i}`} className="flex flex-col gap-0.5 py-2 text-sm">
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <span className="tabular-nums text-muted-foreground">{dataHora(a.occurred_at)}</span>
                  <span className="font-medium">{a.title ?? [a.category, a.action].filter(Boolean).join(' · ')}</span>
                </div>
                {a.description && <span className="text-muted-foreground">{a.description}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
