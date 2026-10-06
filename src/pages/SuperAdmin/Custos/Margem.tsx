import { useCallback, useEffect, useRef, useState } from 'react';
import { Coins, TrendingUp, Wallet } from 'lucide-react';
import Abas from '@/components/base/Abas';
import BaseStatsGrid from '@/components/base/BaseStatsGrid';
import BaseTable from '@/components/base/BaseTable';
import EmptyState from '@/components/base/EmptyState';
import { Button } from '@/components/ui/ds';
import { dinheiro, plural, porcentagem } from '@/lib/formato';
import { costsService } from '@/services/superAdmin/costsService';
import type { MarginRow, MarginsReport } from '@/types/admin/costs';
import { AVISO, CORPO_SECAO, ESQUELETO, SECAO, SUBTITULO_SECAO, TITULO_SECAO } from '@/pages/Admin/Area/estilo';

// Clientes → Custos → Margem (Tony, 06/10/2026). Receita − IA do cliente − parte dele
// na estrutura (Railway + Vercel + Evolution lançadas). O servidor faz a conta
// (Costs::Margins); a tela só mostra. Cliente sem receita aparece, mas fica fora
// dos totais (nunca margem negativa falsa). Mês sem fatura = "parcial", dito com os nomes.

const FILTROS = [
  { chave: 'todos', rotulo: 'Todos' },
  { chave: 'avulso', rotulo: 'Avulso' },
  { chave: 'performance', rotulo: 'Performance' },
];
const TIPO: Record<string, string> = { avulso: 'Avulso', performance: 'Performance' };

const reais = (v: number | null) => (v == null ? '—' : dinheiro(v, { centavos: true }));

function origem(r: MarginRow): string {
  if (r.revenue_brl == null) return 'Sem receita';
  return r.revenue_source === 'package' ? `Cota do plano ${r.package_name ?? ''}`.trim() : 'Valor digitado';
}

export default function Margem({ month, kind, aoMudarKind, recarga = 0, aoLancar }: {
  month: string; kind: string; aoMudarKind: (k: string) => void; recarga?: number; aoLancar: () => void;
}) {
  const [dados, setDados] = useState<MarginsReport | null>(null);
  const [estado, setEstado] = useState<'carregando' | 'pronto' | 'erro'>('carregando');
  // Só a última busca vale: trocar Avulso → Performance rápido não deixa a do meio por cima.
  const seq = useRef(0);

  const carregar = useCallback(async () => {
    const minha = ++seq.current;
    setEstado('carregando');
    try {
      const r = await costsService.margens({ month, kind });
      if (minha !== seq.current) return;
      setDados(r);
      setEstado('pronto');
    } catch {
      if (minha !== seq.current) return;
      setEstado('erro');
    }
  }, [month, kind]);

  useEffect(() => { void carregar(); }, [carregar, recarga]);

  return (
    <section aria-labelledby="margem" className={SECAO}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="margem" className={TITULO_SECAO}>Margem</h2>
          <p className={SUBTITULO_SECAO}>
            Receita menos a IA do cliente e a parte dele na estrutura. Rateio aproximado, pela carteira e pelo disco de hoje:
            metade pelas mensagens do mês, metade pelo espaço que o cliente ocupa no banco.
          </p>
        </div>
        <Abas rotulo="Tipo de cliente" abas={FILTROS} ativa={kind} aoTrocar={aoMudarKind} />
      </div>
      <div className={`${CORPO_SECAO} flex flex-col gap-4`}>
        {estado === 'erro' && <EmptyState tipo="erro" title="Não deu pra carregar a margem" aoTentarDeNovo={() => void carregar()} />}
        {estado === 'carregando' && <div aria-busy="true" className={`h-48 ${ESQUELETO}`} />}
        {estado === 'pronto' && dados && <Conteudo dados={dados} aoLancar={aoLancar} />}
      </div>
    </section>
  );
}

function Conteudo({ dados, aoLancar }: { dados: MarginsReport; aoLancar: () => void }) {
  const t = dados.totals;
  // Ninguém com receita no filtro: totais zerados do servidor seriam um "R$ 0,00" falso.
  const semReceita = t.clients === 0;
  return (
    <>
      {dados.partial && (
        <div role="status" className={AVISO}>
          <span>Margem parcial: faltam as faturas de {dados.missing_invoices.join(', ')}.</span>
          <Button variant="outline" size="sm" onClick={aoLancar}>Lançar faturas</Button>
        </div>
      )}
      {dados.unreadable.length > 0 && (
        <div role="status" className={AVISO}>
          Não deu tempo de ler {dados.unreadable.map((u) => u.name).join(', ')}: a parte deles foi dividida entre os outros nesta leitura.
        </div>
      )}
      {dados.clients.length === 0 ? (
        <EmptyState
          title={dados.kind === 'todos' ? 'Nenhum cliente ativo' : `Nenhum cliente ${TIPO[dados.kind]}`}
          description="Marque o tipo e a receita no Contrato de cada cliente."
        />
      ) : (
        <>
          {semReceita && (
            <div role="status" className={AVISO}>
              Nenhum cliente com receita neste filtro. Marque a receita na aba Contrato de cada cliente.
            </div>
          )}
          <BaseStatsGrid
            columns={3}
            cards={[
              { title: 'Receita', value: semReceita ? '—' : reais(t.revenue_brl), icon: Wallet, valueFormat: 'custom' },
              { title: 'Custo', value: semReceita ? '—' : reais(t.cost_brl), icon: Coins, valueFormat: 'custom' },
              {
                title: 'Margem', icon: TrendingUp, valueFormat: 'custom',
                value: semReceita ? '—' : `${reais(t.margin_brl)}${t.margin_pct == null ? '' : ` · ${porcentagem(t.margin_pct)}`}`,
              },
            ]}
          />
          {dados.without_revenue > 0 && (
            <p className="text-sm text-muted-foreground">
              {plural(dados.without_revenue, 'cliente sem receita', 'clientes sem receita')} (fora da conta).
            </p>
          )}
          <BaseTable<MarginRow>
            data={dados.clients}
            getRowKey={(r) => r.schema}
            columns={[
              { key: 'name', label: 'Cliente', render: (r) => r.name },
              { key: 'kind', label: 'Tipo', render: (r) => (r.kind ? TIPO[r.kind] : '—') },
              { key: 'revenue_brl', label: 'Receita', render: (r) => (
                <div>
                  <div>{reais(r.revenue_brl)}</div>
                  <div className="text-xs text-muted-foreground">{origem(r)}</div>
                </div>
              ) },
              { key: 'ai_brl', label: 'IA', align: 'right', render: (r) => reais(r.ai_brl) },
              { key: 'structure_brl', label: 'Estrutura', align: 'right', render: (r) => (r.readable ? reais(r.structure_brl) : 'não lido') },
              { key: 'margin_brl', label: 'Margem', align: 'right', render: (r) => (
                r.revenue_brl == null
                  ? <span className="text-muted-foreground">Sem receita</span>
                  : <span className={r.margin_brl != null && r.margin_brl < 0 ? 'text-destructive' : undefined}>{reais(r.margin_brl)}</span>
              ) },
              { key: 'margin_pct', label: '%', align: 'right', render: (r) => (r.margin_pct == null ? '—' : porcentagem(r.margin_pct)) },
            ]}
          />
        </>
      )}
    </>
  );
}
