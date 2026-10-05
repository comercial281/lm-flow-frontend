import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Checkbox } from '@/components/ui/ds';
import BaseTable from '@/components/base/BaseTable';
import { BaseStatusBadge } from '@/components/base';
import EmptyState from '@/components/base/EmptyState';
import { Seletor } from '@/components/base/Seletor';
import { dataHora, dinheiro, numero } from '@/lib/formato';
import { costsService } from '@/services/superAdmin/costsService';
import type { CostCall, CostCallsPage, CostSlice } from '@/types/admin/costs';
import { OPCOES_FORNECEDOR, tamanho } from './formatoCustos';
import DetalheDaChamada from './DetalheDaChamada';

// `soErrosInicial` + `aoMudarSoErros`: a lista some e volta a cada mês/cliente; quem a
// usa guarda a escolha do "Só erros" pra ela voltar como a pessoa deixou (e não como o endereço pediu).
export default function ListaDeChamadas({ month, tenant, funcoes, soErrosInicial = false, aoMudarSoErros }: {
  month: string; tenant: string | null; funcoes: CostSlice[]; soErrosInicial?: boolean; aoMudarSoErros?: (v: boolean) => void;
}) {
  const [feature, setFeature] = useState('');
  const [provider, setProvider] = useState('');
  const [onlyErrors, setOnlyErrorsLocal] = useState(soErrosInicial);
  const setOnlyErrors = (v: boolean) => { setOnlyErrorsLocal(v); aoMudarSoErros?.(v); };
  const [dados, setDados] = useState<(CostCallsPage & { chave: string }) | null>(null);
  const [erro, setErro] = useState(false);
  const [aberta, setAberta] = useState<string | null>(null);

  // A página vale só pro conjunto de filtros em que foi escolhida. Mudou o filtro, a
  // página efetiva volta pra 1 na mesma renderização: nenhuma busca da página velha.
  const chave = `${month}|${tenant ?? ''}|${feature}|${provider}|${onlyErrors}`;
  const [escolha, setEscolha] = useState({ chave, page: 1 });
  const page = escolha.chave === chave ? escolha.page : 1;
  const irPara = (p: number) => setEscolha({ chave, page: p });

  // Só a última busca vale: resposta atrasada de filtro/página antiga não sobrescreve.
  const seq = useRef(0);

  const carregar = useCallback(async () => {
    const minha = ++seq.current;
    setErro(false);
    try {
      const r = await costsService.calls({ month, tenant, feature, provider, onlyErrors, page });
      if (minha !== seq.current) return;
      setDados({ ...r, chave });
    } catch {
      if (minha !== seq.current) return;
      setDados(null);
      setErro(true);
    }
  }, [month, tenant, feature, provider, onlyErrors, page, chave]);

  useEffect(() => { void carregar(); }, [carregar]);

  // Dados de outro conjunto de filtros contam como "carregando": nada de linha velha sob filtro novo.
  // Só troca de página mantém as linhas antigas até a próxima chegar.
  const atual = dados && dados.chave === chave && !erro ? dados : null;
  const trocandoPagina = Boolean(atual && atual.meta.page !== page);
  const comFiltro = Boolean(feature || provider || onlyErrors);
  const limparFiltros = () => { setFeature(''); setProvider(''); setOnlyErrors(false); };
  const paginas = atual ? Math.max(1, Math.ceil(atual.meta.total / atual.meta.per_page)) : 1;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Chamadas {atual ? `(${numero(atual.meta.total)})` : ''}</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Seletor aria-label="Função" value={feature} onChange={(e) => setFeature(e.target.value)} className="w-56">
            <option value="">Todas as funções</option>
            {funcoes.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
          </Seletor>
          <Seletor aria-label="Fornecedor" value={provider} onChange={(e) => setProvider(e.target.value)} className="w-48">
            {OPCOES_FORNECEDOR.map((f) => <option key={f.valor} value={f.valor}>{f.rotulo}</option>)}
          </Seletor>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={onlyErrors} onCheckedChange={(v) => setOnlyErrors(v === true)} aria-label="Só erros" />
            Só erros
          </label>
        </div>
      </div>

      {erro ? (
        <EmptyState tipo="erro" title="Não deu para carregar as chamadas" aoTentarDeNovo={carregar} />
      ) : atual && atual.items.length === 0 ? (
        comFiltro
          ? <EmptyState tipo="semResultado" title="Nenhuma chamada com esses filtros" aoLimparFiltros={limparFiltros} />
          : <EmptyState tipo="vazio" title="Nenhuma chamada de IA neste mês" />
      ) : (
        <div aria-busy={trocandoPagina} className={trocandoPagina ? 'opacity-60' : undefined}>
        <BaseTable<CostCall>
          data={atual?.items ?? []}
          loading={!atual}
          getRowKey={(c) => c.id}
          columns={[
            { key: 'created_at', label: 'Quando', render: (c) => dataHora(c.created_at) },
            { key: 'tenant_name', label: 'Cliente', render: (c) => c.tenant_name },
            { key: 'feature_label', label: 'Função', render: (c) => (
              <button type="button" className="text-left text-primary underline-offset-2 hover:underline" onClick={() => setAberta(c.id)}>{c.feature_label}</button>
            ) },
            { key: 'model', label: 'Modelo', render: (c) => c.model ?? '—' },
            { key: 'tamanho', label: 'Tamanho', render: (c) => tamanho(c) },
            { key: 'cost_brl', label: 'Custo', align: 'right', render: (c) => (!c.priced ? 'Sem preço' : Number(c.cost_brl) > 0 && Number(c.cost_brl) < 0.01 ? `< ${dinheiro(0.01)}` : dinheiro(c.cost_brl)) },
            { key: 'status', label: 'Situação', render: (c) => (
              <BaseStatusBadge status={c.status === 'ok' ? 'success' : 'error'} text={c.status === 'ok' ? 'Ok' : 'Falhou'} />
            ) },
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

      {aberta && <DetalheDaChamada id={aberta} aoFechar={() => setAberta(null)} />}
    </section>
  );
}
