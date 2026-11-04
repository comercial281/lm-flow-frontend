import { Card } from '@/components/ui/ds';
import { data, dinheiro, plural, porcentagem } from '@/lib/formato';
import { fimContrato, aluguelEm } from '@/features/locacao/motor';
import { GARANTIA, INTERMEDIACAO } from '@/features/locacao/textos';
import type { Contrato } from '@/features/locacao/tipos';
import { Dado, Titulo } from '../comum';

export default function AbaResumo({ contrato: c, hoje }: { contrato: Contrato; hoje: string }) {
  const atual = aluguelEm(c.historico_aluguel.length ? c.historico_aluguel : [{ desde: c.inicio, valor: c.aluguel_inicial }], hoje);
  const eventos = [...(c.eventos ?? [])].sort((a, b) => b.data.localeCompare(a.data));

  return (
    <div className="grid gap-6">
      <div className="grid gap-6 md:grid-cols-2">
        <section className="grid content-start gap-3">
          <Titulo>Dados do contrato</Titulo>
          <Card className="gap-0 p-4">
            <Dado rotulo="Imóvel">{c.imovel_descricao}</Dado>
            {c.imovel_endereco && <Dado rotulo="Endereço">{c.imovel_endereco}</Dado>}
            <Dado rotulo="Proprietário">{c.proprietario_nome}</Dado>
            <Dado rotulo="Inquilino">{c.inquilino_nome}</Dado>
            {c.inquilino_telefone && <Dado rotulo="WhatsApp do inquilino">{c.inquilino_telefone}</Dado>}
            <Dado rotulo="Aluguel hoje">{dinheiro(atual)}</Dado>
            <Dado rotulo="Vencimento">todo dia {c.dia_vencimento}</Dado>
            <Dado rotulo="Cobrança">{c.cobranca === 'vencido' ? 'Mês vencido' : 'Mês adiantado'}</Dado>
            <Dado rotulo="Início">{data(c.inicio)}</Dado>
            <Dado rotulo="Prazo">{plural(c.meses, 'mês', 'meses')} · até {data(fimContrato(c.inicio, c.meses))}</Dado>
            <Dado rotulo="Reajuste">{c.indice}{c.politica_negativo === 'manter' ? ' · índice negativo mantém o aluguel' : ''}</Dado>
            <Dado rotulo="Taxa de administração">{c.taxa_adm_pct.toString().replace('.', ',')}%</Dado>
            <Dado rotulo="1º aluguel">{INTERMEDIACAO[c.intermediacao]}</Dado>
            <Dado rotulo="Garantia">{GARANTIA[c.garantia.tipo]}{c.garantia.valor > 0 ? ` · ${dinheiro(c.garantia.valor)}` : ''}</Dado>
            {c.garantia.detalhe && <Dado rotulo="Detalhe da garantia">{c.garantia.detalhe}</Dado>}
            {c.garantia.vence && <Dado rotulo="Apólice vence em">{data(c.garantia.vence)}</Dado>}
            {c.condominio_estimado > 0 && <Dado rotulo="Condomínio estimado">{dinheiro(c.condominio_estimado)}</Dado>}
            {c.iptu.resp === 'inq' && c.iptu.parcela > 0 && <Dado rotulo="IPTU (parcela)">{dinheiro(c.iptu.parcela)}</Dado>}
            {c.seguro_incendio > 0 && <Dado rotulo="Seguro incêndio">{dinheiro(c.seguro_incendio)}</Dado>}
            {c.corretor_locacao && <Dado rotulo="Corretor da locação">{c.corretor_locacao}</Dado>}
            {c.corretor_captacao && <Dado rotulo="Corretor da captação">{c.corretor_captacao}</Dado>}
          </Card>
        </section>

        <div className="grid content-start gap-6">
          <section className="grid gap-3">
            <Titulo>Histórico do aluguel</Titulo>
            <Card className="gap-0 p-4">
              {c.historico_aluguel.length === 0 ? (
                <Dado rotulo={data(c.inicio)}>{dinheiro(c.aluguel_inicial)}</Dado>
              ) : c.historico_aluguel.map(h => (
                <Dado key={h.desde} rotulo={`Desde ${data(h.desde)}${h.pct != null ? ` · ${h.indice ?? c.indice} ${porcentagem(h.pct)}` : ''}`}>{dinheiro(h.valor)}</Dado>
              ))}
            </Card>
          </section>

          <section className="grid gap-3">
            <Titulo>Linha do tempo</Titulo>
            <Card className="gap-0 divide-y divide-border/60 p-1">
              {eventos.length === 0 ? (
                <p className="px-3 py-3 text-sm text-muted-foreground">Nada registrado ainda.</p>
              ) : eventos.map((ev, i) => (
                <div key={`${ev.data}-${i}`} className="flex gap-3 px-3 py-2 text-sm">
                  <span className="w-20 shrink-0 text-xs text-muted-foreground">{data(ev.data)}</span>
                  <span>{ev.texto}</span>
                </div>
              ))}
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}
