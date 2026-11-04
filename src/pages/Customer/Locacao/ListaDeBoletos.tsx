import { useState } from 'react';
import { toast } from 'sonner';
import { Button, Card, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input } from '@/components/ui/ds';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { data, dinheiro, hojeEmSaoPaulo } from '@/lib/formato';
import { locacaoService } from '@/features/locacao/locacaoService';
import { imovelCurto } from '@/features/locacao/contratoDoc';
import type { Cobranca, Severidade, StatusDaCobranca } from '@/features/locacao/tipos';
import JanelaDoBoleto from './JanelaDoBoleto';
import { Selo } from './comum';

const STATUS: Record<StatusDaCobranca, string> = {
  aberta: 'Em aberto',
  paga: 'Paga',
  acerto: 'Acerto',
  quitada_caucao: 'Paga com a caução',
  cancelada: 'Cancelada',
};

function seloDe(c: Cobranca, hoje: string): { sev: Severidade; rotulo: string } {
  if (c.status === 'aberta' && c.vencimento < hoje) return { sev: 'bad', rotulo: 'Vencida' };
  if (c.status === 'aberta') return { sev: 'info', rotulo: STATUS.aberta };
  if (c.status === 'cancelada') return { sev: 'warn', rotulo: STATUS.cancelada };
  return { sev: 'ok', rotulo: STATUS[c.status] };
}

interface Props {
  cobrancas: Cobranca[];
  aoMudar: () => void;
  mostrarImovel?: boolean;
}

/** A lista de boletos, com as ações de cada um (ver 2ª via, marcar como pago, cancelar). Serve ao mês, aos atrasados e à ficha. */
export default function ListaDeBoletos({ cobrancas, aoMudar, mostrarImovel = true }: Props) {
  const [aberto, setAberto] = useState<Cobranca | null>(null);
  const [pagando, setPagando] = useState<Cobranca | null>(null);
  const [dataDoPagamento, setDataDoPagamento] = useState('');
  const [salvando, setSalvando] = useState(false);
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const hoje = hojeEmSaoPaulo();

  const abrirPagamento = (c: Cobranca) => { setDataDoPagamento(hoje); setPagando(c); };

  const pagar = async () => {
    if (!pagando || !dataDoPagamento) return;
    setSalvando(true);
    try {
      await locacaoService.pagarCobranca(pagando.id, dataDoPagamento);
      toast.success('Pagamento registrado.');
      setPagando(null);
      aoMudar();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Não deu pra registrar o pagamento.'));
    } finally {
      setSalvando(false);
    }
  };

  const cancelar = async (c: Cobranca) => {
    const ok = await confirmar({
      titulo: 'Cancelar este boleto',
      descricao: 'O boleto deixa de valer e some da cobrança. O contrato continua ativo.',
      rotuloDaAcao: 'Cancelar boleto',
      destrutivo: true,
    });
    if (!ok) return;
    try {
      await locacaoService.cancelarCobranca(c.id);
      toast.success('Boleto cancelado.');
      aoMudar();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Não deu pra cancelar o boleto.'));
    }
  };

  return (
    <>
      <Card className="gap-0 divide-y divide-border/60 p-1">
        {cobrancas.map(c => {
          const selo = seloDe(c, hoje);
          const aberta = c.status === 'aberta';
          const titulo = mostrarImovel && c.imovel_descricao
            ? imovelCurto(c.imovel_descricao)
            : c.tipo === 'final' ? 'Acerto de rescisão' : `Aluguel de ${c.ref.slice(5, 7)}/${c.ref.slice(0, 4)}`;
          return (
            <div key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-3">
              <div className="min-w-0 flex-1 basis-56">
                <p className="truncate text-sm font-medium">{titulo}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {mostrarImovel && c.inquilino_nome ? `${c.inquilino_nome} · ` : ''}vence em {data(c.vencimento)}
                </p>
              </div>
              <span className="text-sm font-medium tabular-nums">{dinheiro(c.total)}</span>
              <Selo sev={selo.sev}>{selo.rotulo}</Selo>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={() => setAberto(c)}>Ver boleto</Button>
                {aberta && <Button variant="outline" size="sm" onClick={() => abrirPagamento(c)}>Marcar como pago</Button>}
                {aberta && <Button variant="ghost" size="sm" onClick={() => void cancelar(c)}>Cancelar</Button>}
              </div>
            </div>
          );
        })}
      </Card>

      <JanelaDoBoleto cobranca={aberto} aoFechar={() => setAberto(null)} />

      <Dialog open={pagando !== null} onOpenChange={v => !v && setPagando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar como pago</DialogTitle>
            <DialogDescription>Use quando o inquilino pagou fora do banco (dinheiro, transferência). O dinheiro entra no extrato do proprietário.</DialogDescription>
          </DialogHeader>
          <label className="grid gap-1.5 text-sm">
            <span className="text-[13px] font-medium text-foreground/80">Data do pagamento</span>
            <Input type="date" value={dataDoPagamento} max={hoje} onChange={e => setDataDoPagamento(e.target.value)} />
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPagando(null)}>Voltar</Button>
            <Button disabled={salvando || !dataDoPagamento} onClick={() => void pagar()}>Registrar pagamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {dialogoDeConfirmacao}
    </>
  );
}
