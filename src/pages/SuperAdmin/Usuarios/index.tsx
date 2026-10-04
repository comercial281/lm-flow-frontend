import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
import { OPCOES_SITUACAO, duracao, rotuloSituacao, statusDaSituacao } from './formatoUsuarios';

// Clientes → Usuários. Todas as pessoas de todos os clientes numa lista só.
const TODOS = '__todos__';
const ESPERA_DA_BUSCA_MS = 300;

const SITUACOES = OPCOES_SITUACAO.map((o) => o.valor);

export default function Usuarios() {
  // Filtros e página moram na URL (?q, tenant, role, situation, equipe=1, page): voltar da ficha
  // devolve a mesma lista, e o link pode ser compartilhado.
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const tenant = params.get('tenant');
  const role = params.get('role') ?? '';
  const situacaoUrl = params.get('situation') ?? '';
  const situation = (SITUACOES.includes(situacaoUrl as UserFilters['situation']) ? situacaoUrl : '') as UserFilters['situation'];
  const includeTeam = params.get('equipe') === '1';
  const page = Math.max(1, parseInt(params.get('page') ?? '', 10) || 1);

  const [busca, setBusca] = useState(q);
  const [dados, setDados] = useState<(UsersPage & { chave: string }) | null>(null);
  const [erro, setErro] = useState(false);
  // Opções dos Seletores: última lista conhecida, sobrevive a erro e a troca de filtro.
  const [tenants, setTenants] = useState<UsersPage['tenants']>([]);
  const [roles, setRoles] = useState<string[]>([]);

  // Mudou qualquer filtro, volta pra página 1 (só `page` explícito preserva a página).
  const atualizar = useCallback((mudanca: Record<string, string | null>) => {
    setParams((atual) => {
      const novo = new URLSearchParams(atual);
      for (const [k, v] of Object.entries(mudanca)) { if (v) novo.set(k, v); else novo.delete(k); }
      if (!('page' in mudanca)) novo.delete('page');
      return novo;
    }, { replace: true });
  }, [setParams]);

  // Espera 300 ms depois da última tecla antes de jogar a busca na URL (e buscar).
  const escrito = useRef(q);
  useEffect(() => {
    const t = setTimeout(() => {
      const valor = busca.trim();
      escrito.current = valor;
      if (valor !== q) atualizar({ q: valor || null });
    }, ESPERA_DA_BUSCA_MS);
    return () => clearTimeout(t);
  }, [busca, q, atualizar]);
  // URL mudou por fora (voltar, limpar filtros): o campo acompanha.
  useEffect(() => { if (q !== escrito.current) { escrito.current = q; setBusca(q); } }, [q]);

  const chave = `${q}|${tenant ?? ''}|${role}|${situation}|${includeTeam}`;
  const irPara = (p: number) => atualizar({ page: p > 1 ? String(p) : null });

  // Só a última busca vale: resposta atrasada de filtro/página antiga não sobrescreve.
  const seq = useRef(0);

  const carregar = useCallback(async () => {
    const minha = ++seq.current;
    setErro(false);
    try {
      const r = await usersService.list({ q, tenant, role, situation, includeTeam, page });
      if (minha !== seq.current) return;
      setDados({ ...r, chave });
      setTenants(r.tenants);
      setRoles(r.roles);
    } catch {
      if (minha !== seq.current) return;
      setDados(null);
      setErro(true);
    }
  }, [q, tenant, role, situation, includeTeam, page, chave]);

  useEffect(() => { void carregar(); }, [carregar]);

  // Dados de outro conjunto de filtros contam como "carregando": nada de linha velha sob filtro novo.
  const atual = dados && dados.chave === chave && !erro ? dados : null;
  const trocandoPagina = Boolean(atual && atual.meta.page !== page);
  const comFiltro = Boolean(q || tenant || role || situation || includeTeam);
  const limparFiltros = () => { escrito.current = ''; setBusca(''); setParams({}, { replace: true }); };
  const paginas = atual ? Math.max(1, Math.ceil(atual.meta.total / atual.meta.per_page)) : 1;
  const falhas = atual?.errors ?? [];

  return (
    <AdminConteudo>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Input aria-label="Buscar" placeholder="Nome, e-mail ou telefone" value={busca} onChange={(e) => setBusca(e.target.value)} className="w-full sm:w-64" />
          <Seletor aria-label="Cliente" value={tenant ?? TODOS} onChange={(e) => atualizar({ tenant: e.target.value === TODOS ? null : e.target.value })} className="w-full sm:w-56">
            <option value={TODOS}>Todos os clientes</option>
            {tenants.map((t) => <option key={t.schema} value={t.schema}>{t.name}</option>)}
          </Seletor>
          <Seletor aria-label="Cargo" value={role} onChange={(e) => atualizar({ role: e.target.value || null })} className="w-full sm:w-48">
            <option value="">Todos os cargos</option>
            {roles.map((r) => <option key={r} value={r}>{r}</option>)}
          </Seletor>
          <Seletor aria-label="Situação" value={situation} onChange={(e) => atualizar({ situation: e.target.value || null })} className="w-full sm:w-48">
            {OPCOES_SITUACAO.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
          </Seletor>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={includeTeam} onCheckedChange={(v) => atualizar({ equipe: v === true ? '1' : null })} aria-label="Incluir equipe Leal Mídia" />
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
                    <Link to={`/admin/usuarios/${u.tenant_schema}/${u.user_id}${params.toString() ? `?${params}` : ''}`} className="text-primary underline-offset-2 hover:underline">{u.name}</Link>
                    {u.email && <span className="text-xs text-muted-foreground">{u.email}</span>}
                  </div>
                ) },
                { key: 'tenant_name', label: 'Cliente', render: (u) => u.tenant_name },
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
