import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminConteudo from '@/pages/Admin/Area/AdminConteudo';
import BaseTable from '@/components/base/BaseTable';
import { BaseStatusBadge } from '@/components/base';
import EmptyState from '@/components/base/EmptyState';
import { Seletor } from '@/components/base/Seletor';
import { Button, Checkbox, Input } from '@/components/ui/ds';
import { dataHora, numero, plural, tempoDesde, VAZIO } from '@/lib/formato';
import { usersService } from '@/services/superAdmin/usersService';
import type { UserFilters, UserRow, UsersPage } from '@/types/admin/users';
import AcoesDeAcesso from './AcoesDeAcesso';
import { OPCOES_SITUACAO, duracao, nomeDoCliente, rotuloSituacao, statusDaSituacao } from './formatoUsuarios';

// Clientes → Usuários. Todas as pessoas de todos os clientes numa lista só.
const TODOS = '__todos__';
const ESPERA_DA_BUSCA_MS = 300;

export default function Usuarios() {
  const [busca, setBusca] = useState('');
  const [q, setQ] = useState('');
  const [tenant, setTenant] = useState<string | null>(null);
  const [role, setRole] = useState('');
  const [situation, setSituation] = useState<UserFilters['situation']>('');
  const [includeTeam, setIncludeTeam] = useState(false);
  const [dados, setDados] = useState<(UsersPage & { chave: string }) | null>(null);
  const [erro, setErro] = useState(false);

  // Espera 300 ms depois da última tecla antes de buscar.
  useEffect(() => {
    const t = setTimeout(() => setQ(busca.trim()), ESPERA_DA_BUSCA_MS);
    return () => clearTimeout(t);
  }, [busca]);

  // A página vale só pro conjunto de filtros em que foi escolhida; mudou o filtro, volta pra 1.
  const chave = `${q}|${tenant ?? ''}|${role}|${situation}|${includeTeam}`;
  const [escolha, setEscolha] = useState({ chave, page: 1 });
  const page = escolha.chave === chave ? escolha.page : 1;
  const irPara = (p: number) => setEscolha({ chave, page: p });

  // Só a última busca vale: resposta atrasada de filtro/página antiga não sobrescreve.
  const seq = useRef(0);

  const carregar = useCallback(async () => {
    const minha = ++seq.current;
    setErro(false);
    try {
      const r = await usersService.list({ q, tenant, role, situation, includeTeam, page });
      if (minha !== seq.current) return;
      setDados({ ...r, chave });
    } catch {
      if (minha !== seq.current) return;
      setDados(null);
      setErro(true);
    }
  }, [q, tenant, role, situation, includeTeam, page, chave]);

  useEffect(() => { void carregar(); }, [carregar]);

  // Dados de outro conjunto de filtros contam como "carregando": nada de linha velha sob filtro novo.
  const atual = dados && dados.chave === chave && !erro ? dados : null;
  // Listas dos Seletores sobrevivem à troca de filtro (vêm da última resposta, qualquer que seja).
  const tenants = dados?.tenants ?? [];
  const roles = dados?.roles ?? [];
  const trocandoPagina = Boolean(atual && atual.meta.page !== page);
  const comFiltro = Boolean(q || tenant || role || situation || includeTeam);
  const limparFiltros = () => { setBusca(''); setQ(''); setTenant(null); setRole(''); setSituation(''); setIncludeTeam(false); };
  const paginas = atual ? Math.max(1, Math.ceil(atual.meta.total / atual.meta.per_page)) : 1;
  const falhas = atual?.errors ?? [];

  return (
    <AdminConteudo>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Input aria-label="Buscar" placeholder="Nome, e-mail ou telefone" value={busca} onChange={(e) => setBusca(e.target.value)} className="w-64" />
          <Seletor aria-label="Cliente" value={tenant ?? TODOS} onChange={(e) => setTenant(e.target.value === TODOS ? null : e.target.value)} className="w-56">
            <option value={TODOS}>Todos os clientes</option>
            {tenants.map((t) => <option key={t.schema} value={t.schema}>{nomeDoCliente(t.schema, t.name)}</option>)}
          </Seletor>
          <Seletor aria-label="Cargo" value={role} onChange={(e) => setRole(e.target.value)} className="w-48">
            <option value="">Todos os cargos</option>
            {roles.map((r) => <option key={r} value={r}>{r}</option>)}
          </Seletor>
          <Seletor aria-label="Situação" value={situation} onChange={(e) => setSituation(e.target.value as UserFilters['situation'])} className="w-48">
            {OPCOES_SITUACAO.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
          </Seletor>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={includeTeam} onCheckedChange={(v) => setIncludeTeam(v === true)} aria-label="Incluir equipe Leal Mídia" />
            Incluir equipe Leal Mídia
          </label>
        </div>

        {falhas.length > 0 && (
          <div role="status" className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm text-muted-foreground">
            <span>Não deu para ler: {falhas.map((f) => f.tenant_name).join(', ')}.</span>
            <Button variant="outline" size="sm" onClick={() => void carregar()}>Tentar de novo</Button>
          </div>
        )}

        {erro ? (
          <EmptyState tipo="erro" title="Não deu para carregar os usuários" aoTentarDeNovo={() => void carregar()} />
        ) : atual && atual.items.length === 0 ? (
          comFiltro
            ? <EmptyState tipo="semResultado" title="Nenhum usuário com esses filtros" aoLimparFiltros={limparFiltros} />
            : <EmptyState tipo="vazio" title="Nenhum usuário" />
        ) : !atual ? (
          <div aria-busy="true" className="flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />)}
          </div>
        ) : (
          <div aria-busy={trocandoPagina} className={trocandoPagina ? 'opacity-60' : undefined}>
            <h2 className="mb-2 text-sm font-semibold">{plural(atual.meta.total, 'usuário', 'usuários')}</h2>
            <BaseTable<UserRow>
              data={atual.items}
              getRowKey={(u) => `${u.tenant_schema}:${u.user_id}`}
              columns={[
                { key: 'name', label: 'Nome', render: (u) => (
                  <div className="flex flex-col">
                    <Link to={`/admin/usuarios/${u.tenant_schema}/${u.user_id}`} className="text-primary underline-offset-2 hover:underline">{u.name}</Link>
                    {u.email && <span className="text-xs text-muted-foreground">{u.email}</span>}
                  </div>
                ) },
                { key: 'tenant_name', label: 'Cliente', render: (u) => nomeDoCliente(u.tenant_schema, u.tenant_name) },
                { key: 'role', label: 'Cargo', render: (u) => u.role },
                { key: 'last_seen_at', label: 'Último acesso', render: (u) => (
                  u.last_seen_at ? <span title={dataHora(u.last_seen_at)}>{tempoDesde(u.last_seen_at)}</span> : VAZIO
                ) },
                { key: 'accesses_30d', label: 'Acessos (30 dias)', render: (u) => (
                  <div className="flex flex-col">
                    <span className="tabular-nums">{numero(u.accesses_30d)}</span>
                    <span className="text-xs text-muted-foreground">{duracao(u.seconds_30d)}</span>
                  </div>
                ) },
                { key: 'situation', label: 'Situação', render: (u) => (
                  <BaseStatusBadge status={statusDaSituacao(u.situation)} text={rotuloSituacao(u.situation)} />
                ) },
                { key: 'acoes', label: 'Ações', align: 'right', render: (u) => <AcoesDeAcesso row={u} /> },
              ]}
            />
          </div>
        )}

        {atual && !erro && paginas > 1 && (
          <div className="flex items-center justify-end gap-2 text-sm">
            <Button variant="outline" size="sm" disabled={trocandoPagina || page <= 1} onClick={() => irPara(page - 1)}>Anterior</Button>
            <span className="tabular-nums text-muted-foreground">{page} de {paginas}</span>
            <Button variant="outline" size="sm" disabled={trocandoPagina || page >= paginas} onClick={() => irPara(page + 1)}>Próxima</Button>
          </div>
        )}
      </div>
    </AdminConteudo>
  );
}
