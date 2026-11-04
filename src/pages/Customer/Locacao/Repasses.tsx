import { useState } from 'react';
import { toast } from 'sonner';
import { Button, Card } from '@/components/ui/ds';
import Aviso from '@/components/base/Aviso';
import Carregando from '@/components/base/Carregando';
import EmptyState from '@/components/base/EmptyState';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { data, dataCurta, dinheiro, plural } from '@/lib/formato';
import { imovelCurto } from '@/features/locacao/contratoDoc';
import { locacaoService } from '@/features/locacao/locacaoService';
import JanelaDoExtrato from './JanelaDoExtrato';
import { Falha, Selo, Titulo } from './comum';
import { useCarga } from './usoComum';

export default function Repasses() {
  const repasses = useCarga(() => locacaoService.repasses(), 'repasses');
  const comissoes = useCarga(() => locacaoService.comissoes(), 'comissoes');
  const terceiros = useCarga(() => locacaoService.terceiros(), 'terceiros');
  const [extrato, setExtrato] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();

  const recarregar = () => { repasses.recarregar(); comissoes.recarregar(); terceiros.recarregar(); };

  const rodar = async (acao: () => Promise<unknown>, sucesso: string, falha: string) => {
    setOcupado(true);
    try {
      await acao();
      toast.success(sucesso);
      recarregar();
    } catch (e) {
      toast.error(apiErrorMessage(e, falha));
    } finally {
      setOcupado(false);
    }
  };

  if (repasses.erro) return <Falha erro={repasses.erro} aoTentar={repasses.recarregar} />;
  if (!repasses.dados) return <Carregando linhas={5} rotulo="Carregando repasses…" />;

  const { saldos, prazo_dias_uteis } = repasses.dados;
  const lote = repasses.dados.repasses.filter(r => r.status === 'aguardando');
  const enviados = repasses.dados.repasses.filter(r => r.status === 'enviado');
  const totalDoLote = lote.reduce((s, r) => s + r.valor, 0);
  const comissoesAbertas = (comissoes.dados ?? []).filter(c => !c.pago);
  const contasAbertas = (terceiros.dados ?? []).filter(t => !t.pago);

  const montar = () => rodar(() => locacaoService.montarLote(), 'Lote montado. Confira antes de aprovar.', 'Não deu pra montar o lote.');

  const enviar = async () => {
    const ok = await confirmar({
      titulo: `Confirmar ${plural(lote.length, 'PIX', 'PIX')}`,
      descricao: `Vão sair ${dinheiro(totalDoLote)} para ${plural(lote.length, 'proprietário', 'proprietários')}. Depois de enviado, o PIX não volta.`,
      rotuloDaAcao: 'Aprovar e enviar',
    });
    if (ok) await rodar(() => locacaoService.enviarLote(), 'PIX enviados.', 'Não deu pra enviar o lote.');
  };

  const cancelar = async (id: string) => {
    const ok = await confirmar({ titulo: 'Tirar do lote', descricao: 'O valor volta para o saldo do proprietário.', rotuloDaAcao: 'Tirar do lote', destrutivo: true });
    if (ok) await rodar(() => locacaoService.cancelarRepasse(id), 'Tirado do lote.', 'Não deu pra tirar do lote.');
  };

  return (
    <div className="grid gap-6">
      <Aviso tom="info" compacto>
        O dinheiro do aluguel é liberado ao proprietário {plural(prazo_dias_uteis, 'dia útil', 'dias úteis')} depois do pagamento. Se o inquilino está em atraso, não há repasse, a não ser que o contrato tenha seguro-fiança.
      </Aviso>

      <section className="grid gap-3">
        <Titulo>Saldo de cada proprietário</Titulo>
        {saldos.length === 0 ? (
          <EmptyState tamanho="compacto" title="Nenhum saldo por enquanto" description="Quando um aluguel for pago, o saldo do proprietário aparece aqui." />
        ) : (
          <Card className="gap-0 divide-y divide-border/60 p-1">
            {saldos.map(s => (
              <div key={s.chave} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-3">
                <div className="min-w-0 flex-1 basis-56">
                  <p className="truncate text-sm font-medium">{s.nome}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {plural(s.imoveis, 'imóvel', 'imóveis')}{s.pix_chave ? ` · PIX ${s.pix_chave}` : ' · sem chave PIX'}
                  </p>
                </div>
                <div className="text-right text-sm tabular-nums">
                  <p className="font-medium">{dinheiro(s.liberado)} liberado</p>
                  <p className="text-xs text-muted-foreground">
                    {s.no_lote > 0 ? `${dinheiro(s.no_lote)} no lote · ` : ''}saldo {dinheiro(s.saldo)}{s.libera_em ? ` · libera em ${dataCurta(s.libera_em)}` : ''}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setExtrato(s.chave)}>Ver extrato</Button>
              </div>
            ))}
          </Card>
        )}
      </section>

      <section className="grid gap-3">
        <Titulo
          acao={lote.length === 0
            ? <Button size="sm" disabled={ocupado} onClick={() => void montar()}>Montar lote</Button>
            : <Button size="sm" disabled={ocupado} onClick={() => void enviar()}>Aprovar e enviar {plural(lote.length, 'PIX', 'PIX')}</Button>}
        >
          Lote esperando aprovação
        </Titulo>
        {lote.length === 0 ? (
          <EmptyState tamanho="compacto" title="Nenhum lote montado" description="Monte o lote para ver quem recebe e quanto. Nada sai antes da sua aprovação." />
        ) : (
          <Card className="gap-0 divide-y divide-border/60 p-1">
            {lote.map(r => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 px-3 py-3">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.proprietario_nome}</span>
                <span className="text-sm font-medium tabular-nums">{dinheiro(r.valor)}</span>
                <Button variant="ghost" size="sm" disabled={ocupado} onClick={() => void cancelar(r.id)}>Tirar do lote</Button>
              </div>
            ))}
          </Card>
        )}
      </section>

      <section className="grid gap-3">
        <Titulo>Contas de terceiros para a imobiliária pagar</Titulo>
        {contasAbertas.length === 0 && comissoesAbertas.length === 0 ? (
          <EmptyState tamanho="compacto" title="Nada a pagar" description="Condomínio, IPTU, seguros e comissões pendentes aparecem aqui." />
        ) : (
          <Card className="gap-0 divide-y divide-border/60 p-1">
            {contasAbertas.map(t => (
              <div key={t.id} className="flex flex-wrap items-center gap-3 px-3 py-3">
                <div className="min-w-0 flex-1 basis-56">
                  <p className="truncate text-sm font-medium">{t.descricao}</p>
                  <p className="truncate text-xs text-muted-foreground">{imovelCurto(t.imovel_descricao)}</p>
                </div>
                <span className="text-sm font-medium tabular-nums">{dinheiro(t.valor)}</span>
                <Button variant="outline" size="sm" disabled={ocupado} onClick={() => void rodar(() => locacaoService.pagarTerceiro(t.id), 'Conta marcada como paga.', 'Não deu pra registrar.')}>Marcar como paga</Button>
              </div>
            ))}
            {comissoesAbertas.map(c => (
              <div key={c.id} className="flex flex-wrap items-center gap-3 px-3 py-3">
                <div className="min-w-0 flex-1 basis-56">
                  <p className="truncate text-sm font-medium">Comissão de {c.papel} · {c.nome}</p>
                  <p className="truncate text-xs text-muted-foreground">{imovelCurto(c.imovel_descricao)} · {c.pct}% sobre {dinheiro(c.base)}</p>
                </div>
                <span className="text-sm font-medium tabular-nums">{dinheiro(c.valor)}</span>
                <Button variant="outline" size="sm" disabled={ocupado} onClick={() => void rodar(() => locacaoService.pagarComissao(c.id), 'Comissão marcada como paga.', 'Não deu pra registrar.')}>Marcar como paga</Button>
              </div>
            ))}
          </Card>
        )}
      </section>

      <section className="grid gap-3">
        <Titulo>Repasses enviados</Titulo>
        {enviados.length === 0 ? (
          <EmptyState tamanho="compacto" title="Nenhum repasse enviado ainda" />
        ) : (
          <Card className="gap-0 divide-y divide-border/60 p-1">
            {enviados.map(r => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 px-3 py-3">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.proprietario_nome}</span>
                <span className="text-xs text-muted-foreground">{r.enviado_em ? data(r.enviado_em) : ''}</span>
                <span className="text-sm font-medium tabular-nums">{dinheiro(r.valor)}</span>
                <Selo sev="ok">Enviado</Selo>
              </div>
            ))}
          </Card>
        )}
      </section>

      <JanelaDoExtrato chave={extrato} aoFechar={() => setExtrato(null)} />
      {dialogoDeConfirmacao}
    </div>
  );
}
