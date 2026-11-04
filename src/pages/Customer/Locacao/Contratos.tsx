import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Card, Input } from '@/components/ui/ds';
import BotoesDeEscolha from '@/components/base/BotoesDeEscolha';
import Carregando from '@/components/base/Carregando';
import EmptyState from '@/components/base/EmptyState';
import { dinheiro, hojeEmSaoPaulo, plural } from '@/lib/formato';
import { locacaoService } from '@/features/locacao/locacaoService';
import { passaNoFiltro, situacaoDoContrato, type FiltroDeContratos } from '@/features/locacao/chips';
import { imovelCurto } from '@/features/locacao/contratoDoc';
import { GARANTIA } from '@/features/locacao/textos';
import type { Contrato } from '@/features/locacao/tipos';
import { Falha, Selo } from './comum';
import { useCarga } from './usoComum';

const FILTROS: { valor: FiltroDeContratos; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'atencao', rotulo: 'Precisam de atenção' },
  { valor: 'em_dia', rotulo: 'Em dia' },
  { valor: 'encerrados', rotulo: 'Encerrados' },
];

const aluguelAtual = (c: Contrato): number => c.historico_aluguel.at(-1)?.valor ?? c.aluguel_inicial;

export default function Contratos({ aoAbrir, aoNovo }: { aoAbrir: (id: string) => void; aoNovo: () => void }) {
  const { dados, erro, recarregar } = useCarga(() => locacaoService.contratos(), 'contratos');
  const [filtro, setFiltro] = useState<FiltroDeContratos>('todos');
  const [busca, setBusca] = useState('');
  const hoje = hojeEmSaoPaulo();

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (dados ?? []).filter(c =>
      passaNoFiltro(c, filtro, hoje)
      && (!q || [c.imovel_descricao, c.inquilino_nome, c.proprietario_nome, c.codigo ?? ''].some(t => t.toLowerCase().includes(q))));
  }, [dados, filtro, busca, hoje]);

  if (erro) return <Falha erro={erro} aoTentar={recarregar} />;
  if (!dados) return <Carregando linhas={5} rotulo="Carregando contratos…" />;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Buscar contrato" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por imóvel, inquilino ou proprietário" className="pl-9" />
        </div>
        <BotoesDeEscolha rotulo="Mostrar" valor={filtro} opcoes={FILTROS} aoEscolher={setFiltro} />
      </div>

      {dados.length === 0 ? (
        <EmptyState
          title="Nenhum contrato ainda"
          description="Cadastre o primeiro contrato e a cobrança do aluguel passa a sair sozinha."
          action={{ label: 'Novo contrato', onClick: aoNovo }}
        />
      ) : lista.length === 0 ? (
        <EmptyState tipo="semResultado" aoLimparFiltros={() => { setFiltro('todos'); setBusca(''); }} />
      ) : (
        <Card className="gap-0 divide-y divide-border/60 p-1">
          {lista.map(c => {
            const s = situacaoDoContrato(c, hoje);
            return (
              <button key={c.id} type="button" onClick={() => aoAbrir(c.id)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-3 py-3 text-left hover:bg-muted/50">
                <div className="min-w-0 flex-1 basis-60">
                  <p className="truncate text-sm font-medium">{imovelCurto(c.imovel_descricao)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {c.inquilino_nome} · proprietário {c.proprietario_nome}
                  </p>
                </div>
                <div className="text-right text-sm tabular-nums">
                  <p className="font-medium">{dinheiro(aluguelAtual(c))}</p>
                  <p className="text-xs text-muted-foreground">{GARANTIA[c.garantia.tipo]} · {plural(c.meses, 'mês', 'meses')}</p>
                </div>
                <div className="flex flex-wrap justify-end gap-1.5 basis-56">
                  {s.chips.map(ch => <Selo key={ch.rotulo} sev={ch.sev}>{ch.rotulo}</Selo>)}
                </div>
              </button>
            );
          })}
        </Card>
      )}
    </div>
  );
}
