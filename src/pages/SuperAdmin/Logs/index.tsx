import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import BaseTable from '@/components/base/BaseTable';
import { BaseStatusBadge } from '@/components/base';
import EmptyState from '@/components/base/EmptyState';
import { Seletor } from '@/components/base/Seletor';
import { Button, Checkbox, Input } from '@/components/ui/ds';
import { dataHora } from '@/lib/formato';
import { logsService } from '@/services/superAdmin/logsService';
import type { LogItem, LogPeriod, LogsPage } from '@/types/admin/logs';
import { OPCOES_PERIODO, quemFez, rotuloCategoria } from './formatoLogs';

// Usuários → Logs. O que as pessoas fizeram em todos os clientes, numa lista só.
const TODOS = '__todos__';
const ESPERA_DA_BUSCA_MS = 300;
const PERIODOS = OPCOES_PERIODO.map((o) => o.valor);

export default function Logs() {
  // Filtros moram na URL (?q, tenant, tipo, periodo, sensiveis=1, equipe=1): o link pode ser compartilhado.
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const tenant = params.get('tenant');
  const category = params.get('tipo') ?? '';
  const periodoUrl = params.get('periodo') ?? '';
  const period = (PERIODOS.includes(periodoUrl as LogPeriod) ? periodoUrl : '') as LogPeriod;
  const sensitiveOnly = params.get('sensiveis') === '1';
  const includeTeam = params.get('equipe') === '1';

  const [busca, setBusca] = useState(q);
  const [itens, setItens] = useState<LogItem[] | null>(null);
  const [pagina, setPagina] = useState<Omit<LogsPage, 'items'> | null>(null);
  const [erro, setErro] = useState(false);
  const [carregandoMais, setCarregandoMais] = useState(false);
  // Opções dos Seletores: última lista conhecida, sobrevive a erro e a troca de filtro.
  const [tenants, setTenants] = useState<LogsPage['tenants']>([]);
  const [categorias, setCategorias] = useState<string[]>([]);

  const atualizar = useCallback((mudanca: Record<string, string | null>) => {
    setParams((atual) => {
      const novo = new URLSearchParams(atual);
      for (const [k, v] of Object.entries(mudanca)) { if (v) novo.set(k, v); else novo.delete(k); }
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

  const filtros = { q, tenant, category, period, sensitiveOnly, includeTeam };
  // Só a última consulta vale: resposta atrasada de filtro antigo não sobrescreve.
  const seq = useRef(0);

  const carregar = useCallback(async () => {
    const minha = ++seq.current;
    setErro(false);
    setItens(null);
    try {
      const r = await logsService.list({ q, tenant, category, period, sensitiveOnly, includeTeam });
      if (minha !== seq.current) return;
      setItens(r.items);
      setPagina({ next_before: r.next_before, tenants: r.tenants, categories: r.categories, errors: r.errors });
      setTenants(r.tenants);
      setCategorias(r.categories);
    } catch {
      if (minha !== seq.current) return;
      setErro(true);
    }
  }, [q, tenant, category, period, sensitiveOnly, includeTeam]);

  useEffect(() => { void carregar(); }, [carregar]);

  const carregarMais = async () => {
    if (!pagina?.next_before) return;
    const minha = seq.current;
    setCarregandoMais(true);
    try {
      const r = await logsService.list(filtros, pagina.next_before);
      if (minha !== seq.current) return;
      setItens((atual) => [...(atual ?? []), ...r.items]);
      setPagina({ next_before: r.next_before, tenants: r.tenants, categories: r.categories, errors: r.errors });
    } catch {
      if (minha === seq.current) setErro(true);
    } finally {
      setCarregandoMais(false);
    }
  };

  const comFiltro = Boolean(q || tenant || category || period || sensitiveOnly || includeTeam);
  const limparFiltros = () => { escrito.current = ''; setBusca(''); setParams({}, { replace: true }); };
  const falhas = pagina?.errors ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input aria-label="Buscar pessoa" placeholder="Nome ou e-mail de quem fez" value={busca} onChange={(e) => setBusca(e.target.value)} className="w-full sm:w-64" />
        <Seletor aria-label="Cliente" value={tenant ?? TODOS} onChange={(e) => atualizar({ tenant: e.target.value === TODOS ? null : e.target.value })} className="w-full sm:w-56">
          <option value={TODOS}>Todos os clientes</option>
          {tenants.map((t) => <option key={t.schema} value={t.schema}>{t.name}</option>)}
        </Seletor>
        <Seletor aria-label="Tipo de ação" value={category} onChange={(e) => atualizar({ tipo: e.target.value || null })} className="w-full sm:w-48">
          <option value="">Todos os tipos</option>
          {categorias.map((c) => <option key={c} value={c}>{rotuloCategoria(c)}</option>)}
        </Seletor>
        <Seletor aria-label="Período" value={period} onChange={(e) => atualizar({ periodo: e.target.value || null })} className="w-full sm:w-48">
          {OPCOES_PERIODO.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
        </Seletor>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={sensitiveOnly} onCheckedChange={(v) => atualizar({ sensiveis: v === true ? '1' : null })} aria-label="Só sensíveis" />
          Só sensíveis
        </label>
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
        <EmptyState tipo="erro" title="Não deu para carregar os logs" aoTentarDeNovo={() => void carregar()} />
      ) : itens === null ? (
        <div aria-busy="true" className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />)}
        </div>
      ) : itens.length === 0 ? (
        comFiltro
          ? <EmptyState tipo="semResultado" title="Nenhuma ação com esses filtros" aoLimparFiltros={limparFiltros} />
          : <EmptyState tipo="vazio" title="Nenhuma ação registrada ainda" />
      ) : (
        <>
          <BaseTable<LogItem>
            data={itens}
            getRowKey={(i) => `${i.tenant_schema}:${i.id}`}
            columns={[
              { key: 'occurred_at', label: 'Quando', render: (i) => <span className="tabular-nums">{dataHora(i.occurred_at)}</span> },
              { key: 'actor', label: 'Quem', render: (i) => (
                <div className="flex flex-col">
                  <span>{quemFez(i)}</span>
                  {i.actor_email && i.actor_name && <span className="text-xs text-muted-foreground">{i.actor_email}</span>}
                </div>
              ) },
              { key: 'tenant_name', label: 'Cliente', render: (i) => i.tenant_name },
              { key: 'title', label: 'O que fez', render: (i) => (
                <div className="flex flex-col gap-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{i.title}</span>
                    {i.sensitive && <BaseStatusBadge status="warning" text="Sensível" />}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {rotuloCategoria(i.category)}{i.description ? ` · ${i.description}` : ''}
                  </span>
                </div>
              ) },
            ]}
          />
          {pagina?.next_before && (
            <div className="flex justify-center">
              <Button variant="outline" size="sm" disabled={carregandoMais} onClick={() => void carregarMais()}>Carregar mais</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
