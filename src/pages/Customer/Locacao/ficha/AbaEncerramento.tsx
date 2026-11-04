import { useEffect, useState } from 'react';
import { rotuloDoTotalDoAcerto } from '@/features/locacao/textos';
import { toast } from 'sonner';
import { Button, Card, Checkbox, Input } from '@/components/ui/ds';
import Aviso from '@/components/base/Aviso';
import BotoesDeEscolha from '@/components/base/BotoesDeEscolha';
import Carregando from '@/components/base/Carregando';
import { CampoDaJanela, GradeDaJanela } from '@/components/base/janela';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { data, dinheiro, hojeEmSaoPaulo, lerDinheiro } from '@/lib/formato';
import { locacaoService } from '@/features/locacao/locacaoService';
import type { Acerto, Contrato, MotivoDoEncerramento, ParametrosDoAcerto } from '@/features/locacao/tipos';
import { Dado, Falha, Titulo } from '../comum';

const MOTIVOS: { valor: MotivoDoEncerramento; rotulo: string }[] = [
  { valor: 'fim', rotulo: 'Fim do prazo' },
  { valor: 'antecipada', rotulo: 'Saída antes do prazo' },
  { valor: 'despejo', rotulo: 'Despejo' },
];

const DESTINO_DA_LINHA: Record<string, string> = {
  prop: 'Para o proprietário',
  aberto: 'Em aberto com o inquilino',
  caucao: 'Pago com a caução',
};

const paraNumero = (s: string) => Number(s.replace(',', '.'));

export default function AbaEncerramento({ contrato: c, aoMudar }: { contrato: Contrato; aoMudar: (c: Contrato) => void }) {
  const encerrado = c.status === 'encerrado';
  const e = c.encerramento;
  const [saida, setSaida] = useState(c.saida ?? hojeEmSaoPaulo());
  const [motivo, setMotivo] = useState<MotivoDoEncerramento>(e?.motivo ?? 'fim');
  const [multaMeses, setMultaMeses] = useState(e?.multa_meses != null ? String(e.multa_meses).replace('.', ',') : '3');
  const [rendimento, setRendimento] = useState(e?.rend_caucao_mes != null ? String(e.rend_caucao_mes).replace('.', ',') : '0');
  const [isento, setIsento] = useState(e?.isento ?? false);
  const [avisoDado, setAvisoDado] = useState(e?.aviso_dado ?? false);
  const [acerto, setAcerto] = useState<Acerto | null>(null);
  const [erro, setErro] = useState<unknown>(null);
  const [calculando, setCalculando] = useState(false);
  const [encerrando, setEncerrando] = useState(false);
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();

  const parametros = (): ParametrosDoAcerto => ({
    saida,
    motivo,
    multa_meses: Number.isFinite(paraNumero(multaMeses)) ? paraNumero(multaMeses) : 0,
    rend_caucao_mes: lerDinheiro(rendimento) ?? 0,
    isento,
    aviso_dado: avisoDado,
  });

  // O servidor refaz a conta a cada mudança; o cálculo é dele, a tela só mostra.
  useEffect(() => {
    if (!saida) return;
    let vivo = true;
    setCalculando(true);
    const id = window.setTimeout(() => {
      locacaoService.acerto(c.id, parametros())
        .then(r => { if (vivo) { setAcerto(r); setErro(null); } })
        .catch((x: unknown) => { if (vivo) setErro(x); })
        .finally(() => { if (vivo) setCalculando(false); });
    }, 350);
    return () => { vivo = false; window.clearTimeout(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- parametros() lê exatamente os estados listados aqui
  }, [c.id, saida, motivo, multaMeses, rendimento, isento, avisoDado]);

  const encerrar = async () => {
    const ok = await confirmar({
      titulo: 'Encerrar o contrato',
      descricao: `O contrato de ${c.inquilino_nome} termina em ${data(saida)}. Os boletos que faltam são cancelados e o acerto final é gerado. Isso não se desfaz.`,
      rotuloDaAcao: 'Encerrar contrato',
      destrutivo: true,
    });
    if (!ok) return;
    setEncerrando(true);
    try {
      aoMudar(await locacaoService.encerrar(c.id, parametros()));
      toast.success('Contrato encerrado.');
    } catch (x) {
      toast.error(apiErrorMessage(x, 'Não deu pra encerrar o contrato.'));
    } finally {
      setEncerrando(false);
    }
  };

  if (erro && !acerto) return <Falha erro={erro} aoTentar={() => setErro(null)} />;

  const titulo = encerrado ? 'Acerto final' : motivo === 'fim' ? 'Acerto final' : 'Acerto de rescisão';

  return (
    <div className="grid gap-6">
      {encerrado && (
        <Aviso tom="info" titulo={`Contrato encerrado em ${data(c.saida ?? saida)}`}>
          O termo de rescisão e o acerto final já foram gerados. Os dados abaixo ficam só para consulta.
        </Aviso>
      )}

      <section className="grid gap-3">
        <Titulo>Dados da saída</Titulo>
        <Card className="gap-4 p-4">
          <BotoesDeEscolha rotulo="Motivo do encerramento" valor={motivo} opcoes={MOTIVOS} aoEscolher={v => { if (!encerrado) setMotivo(v); }} />
          <GradeDaJanela>
            <CampoDaJanela rotulo="Data da saída" htmlFor="enc-saida">
              <Input id="enc-saida" type="date" value={saida} disabled={encerrado} onChange={ev => setSaida(ev.target.value)} />
            </CampoDaJanela>
            {motivo === 'antecipada' && (
              <>
                <CampoDaJanela rotulo="Multa em meses de aluguel" htmlFor="enc-multa" ajuda="Proporcional ao tempo que falta, conforme a lei.">
                  <Input id="enc-multa" inputMode="decimal" value={multaMeses} disabled={encerrado} onChange={ev => setMultaMeses(ev.target.value)} />
                </CampoDaJanela>
                <CampoDaJanela rotulo="" colunas={2}>
                  <div className="grid gap-2 pt-1">
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox checked={avisoDado} disabled={encerrado} onCheckedChange={v => setAvisoDado(v === true)} />
                      O inquilino avisou com 30 dias de antecedência
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox checked={isento} disabled={encerrado} onCheckedChange={v => setIsento(v === true)} />
                      Isentar da multa (troca de emprego, acordo, etc.)
                    </label>
                  </div>
                </CampoDaJanela>
              </>
            )}
            {c.garantia.tipo === 'caucao' && (
              <CampoDaJanela rotulo="Rendimento da caução por mês (R$)" htmlFor="enc-rend" ajuda="Devolvido junto com a caução.">
                <Input id="enc-rend" inputMode="decimal" value={rendimento} disabled={encerrado} onChange={ev => setRendimento(ev.target.value)} />
              </CampoDaJanela>
            )}
          </GradeDaJanela>
          {!c.vistoria?.saida?.concluida && !encerrado && (
            <Aviso tom="atencao" compacto>A vistoria de saída ainda não foi concluída. Danos encontrados nela entram neste acerto.</Aviso>
          )}
        </Card>
      </section>

      <section className="grid gap-3">
        <Titulo acao={calculando ? <span className="text-xs text-muted-foreground">Calculando…</span> : undefined}>{titulo}</Titulo>
        {!acerto ? (
          <Carregando linhas={4} rotulo="Calculando o acerto…" />
        ) : (
          <Card className="gap-0 p-4">
            {acerto.linhas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nada a acertar nesta saída.</p>
            ) : acerto.linhas.map((l, i) => (
              <Dado key={`${l.desc}-${i}`} rotulo={`${l.desc} · ${DESTINO_DA_LINHA[l.dest] ?? l.dest}`}>
                <span className={l.valor < 0 ? 'text-destructive' : undefined}>{dinheiro(l.valor)}</span>
              </Dado>
            ))}
            <div className="mt-2 flex items-center justify-between border-t border-border pt-3 text-sm font-semibold">
              <span>{rotuloDoTotalDoAcerto(acerto.total)}</span>
              <span>{dinheiro(Math.abs(acerto.total))}</span>
            </div>
            {acerto.antes_do_prazo && <p className="mt-2 text-xs text-muted-foreground">A saída é antes do fim do prazo do contrato.</p>}
          </Card>
        )}
      </section>

      {!encerrado && (
        <div className="flex justify-end">
          <Button variant="destructive" disabled={encerrando || !acerto} onClick={() => void encerrar()}>Encerrar contrato</Button>
        </div>
      )}
      {dialogoDeConfirmacao}
    </div>
  );
}
