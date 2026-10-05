import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import EmptyState from '@/components/base/EmptyState';
import { Seletor } from '@/components/base/Seletor';
import { Button } from '@/components/ui/ds';
import { dinheiro, numero, plural } from '@/lib/formato';
import { overviewService } from '@/services/superAdmin/overviewService';
import type { LinhaCliente, Numeros as DadosNumeros, TotaisNumeros } from '@/types/admin/overview';
import GraficoDoPeriodo from './GraficoDoPeriodo';
import { atualizadoHa, COLUNAS_ORDENAVEIS, OPCOES_PERIODO, periodoValido, variacao } from './formatoNumeros';

// Visão Geral → Números: o período em números, total e por cliente.
// Filtros na URL (?periodo, tenant), como Usuários e Logs.
const TODOS = '__todos__';

const CARTOES: { chave: keyof TotaisNumeros; rotulo: string; dinheiro?: boolean }[] = [
  { chave: 'leads', rotulo: 'Leads' },
  { chave: 'conversations', rotulo: 'Conversas' },
  { chave: 'users_active', rotulo: 'Usuários ativos' },
  { chave: 'ai_attended', rotulo: 'Atendidos pela IA' },
  { chave: 'ai_visits', rotulo: 'Visitas pela IA' },
  { chave: 'ai_cost_brl', rotulo: 'Custo da IA', dinheiro: true },
];

export default function Numeros() {
  const [params, setParams] = useSearchParams();
  const periodo = periodoValido(params.get('periodo'));
  const tenant = params.get('tenant');

  const [dados, setDados] = useState<DadosNumeros | null>(null);
  const [tenants, setTenants] = useState<DadosNumeros['tenants']>([]);
  const [erro, setErro] = useState(false);
  const [ordem, setOrdem] = useState<keyof LinhaCliente>('leads');
  const seq = useRef(0);

  const atualizarUrl = useCallback((mudanca: Record<string, string | null>) => {
    setParams((atual) => {
      const novo = new URLSearchParams(atual);
      for (const [k, v] of Object.entries(mudanca)) { if (v) novo.set(k, v); else novo.delete(k); }
      return novo;
    }, { replace: true });
  }, [setParams]);

  // Só a última consulta vale: resposta atrasada de filtro antigo não sobrescreve.
  const carregar = useCallback(async (refresh = false) => {
    const minha = ++seq.current;
    setErro(false);
    if (!refresh) setDados(null);
    try {
      const r = await overviewService.numeros({ periodo, tenant, refresh });
      if (minha === seq.current) { setDados(r); setTenants(r.tenants); }
    } catch {
      if (minha === seq.current) setErro(true);
    }
  }, [periodo, tenant]);

  useEffect(() => { void carregar(); }, [carregar]);

  const linhas = useMemo(() => {
    const valor = (c: LinhaCliente) => (ordem === 'ai_cost_brl' ? Number(c.ai_cost_brl ?? 0) : c.readable ? Number(c[ordem] ?? 0) : -1);
    return [...(dados?.clients ?? [])].sort((a, b) => valor(b) - valor(a) || a.name.localeCompare(b.name));
  }, [dados, ordem]);

  const ilegiveis = dados?.clients.filter((c) => !c.readable).length ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Seletor aria-label="Período" value={periodo} onChange={(e) => atualizarUrl({ periodo: e.target.value })} className="w-full sm:w-44">
          {OPCOES_PERIODO.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
        </Seletor>
        <Seletor aria-label="Cliente" value={tenant ?? TODOS} onChange={(e) => atualizarUrl({ tenant: e.target.value === TODOS ? null : e.target.value })} className="w-full sm:w-56">
          <option value={TODOS}>Todos os clientes</option>
          {tenants.map((t) => <option key={t.schema} value={t.schema}>{t.name}</option>)}
        </Seletor>
        {dados && (
          <span className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
            {atualizadoHa(dados.generated_at)}
            <Button variant="outline" size="sm" onClick={() => void carregar(true)}>Atualizar</Button>
          </span>
        )}
      </div>

      {erro ? (
        <EmptyState tipo="erro" title="Não deu para carregar os números" aoTentarDeNovo={() => void carregar()} />
      ) : !dados ? (
        <div aria-busy="true" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {CARTOES.map((c) => <div key={c.chave} className="h-24 animate-pulse rounded-lg bg-muted" />)}
        </div>
      ) : (
        <>
          {dados.unreadable.length > 0 && (
            <div role="status" className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
              Não deu pra ler: {dados.unreadable.map((u) => u.name).join(', ')}.
              {ilegiveis > 0 && <> Totais {`sem ${plural(ilegiveis, 'cliente', 'clientes')}`}.</>}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {CARTOES.map((c) => {
              const atual = dados.totals[c.chave] as number | null;
              const v = variacao(atual, dados.previous_totals[c.chave] as number | null);
              // Custo subindo não é boa notícia: no cartão de custo a variação fica sempre neutra.
              const neutro = c.chave === 'ai_cost_brl' || v?.sentido === 'igual';
              const corVariacao = neutro
                ? 'text-xs text-muted-foreground'
                : v?.sentido === 'sobe'
                  ? 'text-xs text-emerald-700 dark:text-emerald-300'
                  : 'text-xs text-red-700 dark:text-red-300';
              return (
                <div key={c.chave} className="rounded-lg border bg-card p-4">
                  <p className="text-xs text-muted-foreground">{c.rotulo}</p>
                  <p className="mt-1 text-2xl font-semibold">{c.dinheiro ? dinheiro(atual) : numero(atual)}</p>
                  {v && <p className={corVariacao}>{v.texto}</p>}
                  {c.chave === 'users_active' && dados.totals.users_missing !== undefined && (
                    <p className="text-xs text-muted-foreground">{plural(dados.totals.users_missing, 'sumida', 'sumidas')} há 7+ dias</p>
                  )}
                </div>
              );
            })}
            {dados.structure && (
              <div className="rounded-lg border bg-card p-4">
                <p className="text-xs text-muted-foreground">Estrutura do mês</p>
                {dados.structure.launched.length === 0 ? (
                  <p className="mt-1 text-sm">Faturas do mês ainda não lançadas</p>
                ) : (
                  <p className="mt-1 text-2xl font-semibold">{dinheiro(dados.structure.brl)}</p>
                )}
              </div>
            )}
          </div>

          <GraficoDoPeriodo series={dados.series} tipo={dados.period.bucket} />

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2">Cliente</th>
                  {COLUNAS_ORDENAVEIS.map((col) => (
                    <th key={col.chave} scope="col" className="px-3 py-2 text-right" aria-sort={ordem === col.chave ? 'descending' : 'none'}>
                      <button type="button" onClick={() => setOrdem(col.chave)} className="hover:text-foreground">{col.rotulo}</button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {linhas.map((c) => (
                  <tr key={c.schema} className="border-t">
                    <td className="px-3 py-2">
                      <button type="button" className="text-left font-medium hover:underline" onClick={() => atualizarUrl({ tenant: c.schema })}>{c.name}</button>
                    </td>
                    {COLUNAS_ORDENAVEIS.map((col) => (
                      <td key={col.chave} className="px-3 py-2 text-right tabular-nums">
                        {col.chave === 'ai_cost_brl'
                          ? dinheiro(c.ai_cost_brl)
                          : !c.readable
                            ? <span className="text-muted-foreground">não deu pra ler</span>
                            : col.chave === 'users_active'
                              ? `${numero(c.users_active ?? 0)} de ${numero(c.users_total ?? 0)}`
                              : numero((c[col.chave] as number | undefined) ?? 0)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
