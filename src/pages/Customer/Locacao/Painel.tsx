import { Button, Card } from '@/components/ui/ds';
import Carregando from '@/components/base/Carregando';
import EmptyState from '@/components/base/EmptyState';
import { dinheiro } from '@/lib/formato';
import { locacaoService } from '@/features/locacao/locacaoService';
import { PASSOS_DO_DINHEIRO } from '@/features/locacao/textos';
import type { AbaDaFicha, AbaDaLocacao, AvisoDoPainel } from '@/features/locacao/tipos';
import { Falha, Numero, Selo, Titulo } from './comum';
import { COR_DO_PONTO, useCarga } from './usoComum';

interface Props {
  aoIrParaAba: (aba: AbaDaLocacao) => void;
  aoAbrirContrato: (id: string, aba?: AbaDaFicha) => void;
}

export default function Painel({ aoIrParaAba, aoAbrirContrato }: Props) {
  const { dados, erro, recarregar } = useCarga(() => locacaoService.painel(), 'painel');

  if (erro) return <Falha erro={erro} aoTentar={recarregar} />;
  if (!dados) return <Carregando variante="cartoes" linhas={4} rotulo="Carregando o painel…" />;

  const { kpis, avisos } = dados;

  const agir = (a: AvisoDoPainel) => {
    if (a.contrato_id) return aoAbrirContrato(a.contrato_id, a.aba_do_contrato ?? undefined);
    if (a.acao_tipo && a.acao_tipo !== 'contrato') aoIrParaAba(a.acao_tipo);
  };

  return (
    <div className="grid gap-6">
      <Card className="grid grid-cols-2 gap-6 p-5 md:grid-cols-4">
        <Numero
          rotulo="Em atraso"
          valor={dinheiro(kpis.em_atraso_total)}
          ajuda={kpis.em_atraso_qtd === 1 ? '1 boleto vencido' : `${kpis.em_atraso_qtd} boletos vencidos`}
          tom={kpis.em_atraso_qtd > 0 ? 'bad' : undefined}
        />
        <Numero rotulo="Contratos ativos" valor={kpis.contratos_ativos} ajuda={`${dinheiro(kpis.aluguel_mensal_total)} de aluguel por mês`} />
        <Numero rotulo="A repassar" valor={dinheiro(kpis.a_repassar_total)} ajuda={`${dinheiro(kpis.no_lote_total)} já no lote`} />
        <Numero rotulo="Receita dos próximos 30 dias" valor={dinheiro(kpis.receita_30_dias)} ajuda="taxas que ficam com a imobiliária" />
      </Card>

      <section className="grid gap-3">
        <Titulo>Precisa da sua atenção</Titulo>
        {avisos.length === 0 ? (
          <EmptyState tamanho="compacto" title="Nada pendente" description="Quando algo precisar de você, aparece aqui." />
        ) : (
          <Card className="gap-0 divide-y divide-border/60 p-1">
            {avisos.map(a => (
              <div key={a.id} className="flex flex-wrap items-center gap-3 px-3 py-3">
                <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-full ${COR_DO_PONTO[a.sev]}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{a.titulo}</span>
                    <Selo sev={a.sev}>{a.tag}</Selo>
                  </div>
                  <p className="text-sm text-muted-foreground">{a.descricao}</p>
                </div>
                {a.acao_rotulo && (
                  <Button variant="outline" size="sm" onClick={() => agir(a)}>{a.acao_rotulo}</Button>
                )}
              </div>
            ))}
          </Card>
        )}
      </section>

      <section className="grid gap-3">
        <Titulo>Como o dinheiro anda</Titulo>
        <Card className="grid gap-4 p-5 md:grid-cols-5">
          {PASSOS_DO_DINHEIRO.map((p, i) => (
            <div key={p.titulo} className="grid content-start gap-1">
              <span className="text-xs font-medium text-primary">Passo {i + 1}</span>
              <span className="text-sm font-medium">{p.titulo}</span>
              <span className="text-sm text-muted-foreground">{p.texto}</span>
            </div>
          ))}
        </Card>
      </section>
    </div>
  );
}
