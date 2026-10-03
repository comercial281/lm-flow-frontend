import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Checkbox } from '@/components/ui/ds';
import BaseTable from '@/components/base/BaseTable';
import { BaseStatusBadge } from '@/components/base';
import EmptyState from '@/components/base/EmptyState';
import { Seletor } from '@/components/base/Seletor';
import { dataHora, dinheiro, numero } from '@/lib/formato';
import { costsService } from '@/services/superAdmin/costsService';
import type { CostCall, CostCallsPage, CostSlice } from '@/types/admin/costs';
import { tamanho } from './formatoCustos';
import DetalheDaChamada from './DetalheDaChamada';

const FORNECEDORES = [
  { valor: '', rotulo: 'Todos os fornecedores' },
  { valor: 'anthropic', rotulo: 'Anthropic' },
  { valor: 'openai', rotulo: 'OpenAI' },
  { valor: 'elevenlabs', rotulo: 'ElevenLabs' },
];

export default function ListaDeChamadas({ month, tenant, funcoes }: { month: string; tenant: string | null; funcoes: CostSlice[] }) {
  const [feature, setFeature] = useState('');
  const [provider, setProvider] = useState('');
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [dados, setDados] = useState<CostCallsPage | null>(null);
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
      setDados(r);
    } catch {
      if (minha !== seq.current) return;
      setErro(true);
    }
  }, [month, tenant, feature, provider, onlyErrors, page]);

  useEffect(() => { void carregar(); }, [carregar]);

  const paginas = dados ? Math.max(1, Math.ceil(dados.meta.total / dados.meta.per_page)) : 1;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Chamadas {dados ? `(${numero(dados.meta.total)})` : ''}</h3>
        <div className="flex flex-wrap items-center gap-3">
          <Seletor aria-label="Função" value={feature} onChange={(e) => setFeature(e.target.value)} className="w-56">
            <option value="">Todas as funções</option>
            {funcoes.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
          </Seletor>
          <Seletor aria-label="Fornecedor" value={provider} onChange={(e) => setProvider(e.target.value)} className="w-48">
            {FORNECEDORES.map((f) => <option key={f.valor} value={f.valor}>{f.rotulo}</option>)}
          </Seletor>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={onlyErrors} onCheckedChange={(v) => setOnlyErrors(v === true)} aria-label="Só erros" />
            Só erros
          </label>
        </div>
      </div>

      {erro ? (
        <EmptyState tipo="erro" title="Não deu para carregar as chamadas" aoTentarDeNovo={carregar} />
      ) : (
        <BaseTable<CostCall>
          data={dados?.items ?? []}
          loading={!dados}
          getRowKey={(c) => c.id}
          emptyTitle="Nenhuma chamada com esses filtros"
          columns={[
            { key: 'created_at', label: 'Quando', render: (c) => dataHora(c.created_at) },
            { key: 'tenant_name', label: 'Cliente', render: (c) => c.tenant_name },
            { key: 'feature_label', label: 'Função', render: (c) => (
              <button type="button" className="text-left underline-offset-2 hover:underline" onClick={() => setAberta(c.id)}>{c.feature_label}</button>
            ) },
            { key: 'model', label: 'Modelo', render: (c) => c.model ?? '—' },
            { key: 'tamanho', label: 'Tamanho', render: (c) => tamanho(c) },
            { key: 'cost_brl', label: 'Custo', align: 'right', render: (c) => (c.priced ? dinheiro(c.cost_brl) : 'Sem preço') },
            { key: 'status', label: 'Situação', render: (c) => (
              <BaseStatusBadge status={c.status === 'ok' ? 'success' : 'error'} text={c.status === 'ok' ? 'Ok' : 'Falhou'} />
            ) },
          ]}
        />
      )}

      {dados && paginas > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => irPara(page - 1)}>Anterior</Button>
          <span className="tabular-nums text-muted-foreground">{page} de {paginas}</span>
          <Button variant="outline" size="sm" disabled={page >= paginas} onClick={() => irPara(page + 1)}>Próxima</Button>
        </div>
      )}

      {aberta && <DetalheDaChamada id={aberta} aoFechar={() => setAberta(null)} />}
    </section>
  );
}
