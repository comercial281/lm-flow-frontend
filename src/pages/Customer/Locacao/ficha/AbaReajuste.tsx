import { useState } from 'react';
import { toast } from 'sonner';
import { Button, Card } from '@/components/ui/ds';
import Aviso from '@/components/base/Aviso';
import Carregando from '@/components/base/Carregando';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { data, dinheiro, plural, porcentagem } from '@/lib/formato';
import { locacaoService } from '@/features/locacao/locacaoService';
import type { Contrato } from '@/features/locacao/tipos';
import { Dado, Falha, Numero, Titulo } from '../comum';
import { rotuloDoMes, useCarga } from '../usoComum';

export default function AbaReajuste({ contrato: c, aoMudar }: { contrato: Contrato; aoMudar: (c: Contrato) => void }) {
  const { dados: r, erro, recarregar } = useCarga(() => locacaoService.reajuste(c), `reajuste-${c.id}-${c.ultimo_reajuste ?? ''}`);
  const [aplicando, setAplicando] = useState(false);
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();

  if (erro) return <Falha erro={erro} aoTentar={recarregar} />;
  if (!r) return <Carregando linhas={4} rotulo="Calculando o reajuste…" />;

  const aplicar = async () => {
    const ok = await confirmar({
      titulo: 'Aplicar o reajuste',
      descricao: `O aluguel passa de ${dinheiro(r.aluguel_atual)} para ${dinheiro(r.aluguel_novo)} a partir de ${data(r.aniversario)}. Os boletos ainda não pagos seguem o valor novo.`,
      rotuloDaAcao: 'Aplicar reajuste',
    });
    if (!ok) return;
    setAplicando(true);
    try {
      aoMudar(await locacaoService.aplicarReajuste(c.id, r.aniversario));
      toast.success('Reajuste aplicado.');
      recarregar();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Não deu pra aplicar o reajuste.'));
    } finally {
      setAplicando(false);
    }
  };

  const faltam = r.dias_para_aniversario;

  return (
    <div className="grid gap-6">
      <section className="grid gap-3">
        <Titulo
          acao={r.pode_aplicar
            ? <Button size="sm" disabled={aplicando} onClick={() => void aplicar()}>Aplicar reajuste</Button>
            : undefined}
        >
          Próximo reajuste
        </Titulo>
        {r.erro && <Aviso tom="atencao">{r.erro}</Aviso>}
        <Card className="gap-4 p-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Numero rotulo="Aniversário do contrato" valor={data(r.aniversario)} ajuda={faltam < 0 ? `atrasado há ${plural(-faltam, 'dia', 'dias')}` : `em ${plural(faltam, 'dia', 'dias')}`} tom={faltam < 0 ? 'bad' : undefined} />
            <Numero rotulo={`${r.indice} acumulado`} valor={porcentagem(r.acumulado)} />
            <Numero rotulo="Aluguel hoje" valor={dinheiro(r.aluguel_atual)} />
            <Numero rotulo="Aluguel novo" valor={dinheiro(r.aluguel_novo)} ajuda={`reajuste de ${porcentagem(r.pct)}`} />
          </div>
          {!r.pode_aplicar && !r.erro && c.status === 'ativo' && (
            <Aviso tom="neutro" compacto>O reajuste libera 45 dias antes do aniversário do contrato.</Aviso>
          )}
        </Card>
      </section>

      <section className="grid gap-3">
        <Titulo>Os 12 meses do cálculo</Titulo>
        <Card className="gap-0 p-4">
          {r.meses.length === 0 ? (
            <p className="text-sm text-muted-foreground">Os índices desses meses ainda não foram publicados.</p>
          ) : r.meses.map(m => (
            <Dado key={m.mes} rotulo={rotuloDoMes(m.mes)}>{porcentagem(m.indice_mes)} · acumulado {porcentagem(m.acumulado)}</Dado>
          ))}
        </Card>
      </section>
      {dialogoDeConfirmacao}
    </div>
  );
}
