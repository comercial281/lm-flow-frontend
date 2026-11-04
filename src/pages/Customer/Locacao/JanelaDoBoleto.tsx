import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Copy, ExternalLink, Printer, Send } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/ds';
import Aviso from '@/components/base/Aviso';
import Carregando from '@/components/base/Carregando';
import { apiErrorMessage } from '@/utils/apiHelpers';
import { data, dinheiro, plural } from '@/lib/formato';
import { locacaoService } from '@/features/locacao/locacaoService';
import { imovelCurto } from '@/features/locacao/contratoDoc';
import { DESTINO, ORDEM_DOS_DESTINOS } from '@/features/locacao/textos';
import type { Cobranca, SegundaVia } from '@/features/locacao/tipos';
import { Dado } from './comum';

function Copiavel({ rotulo, texto, aoCopiar }: { rotulo: string; texto: string; aoCopiar: () => void }) {
  return (
    <div className="grid gap-1">
      <span className="text-xs text-muted-foreground">{rotulo}</span>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 break-all rounded-md bg-muted px-2 py-1.5 text-xs">{texto}</code>
        <Button variant="outline" size="sm" onClick={aoCopiar}><Copy className="mr-1 h-4 w-4" />Copiar</Button>
      </div>
    </div>
  );
}

/** A 2ª via do boleto: a cobrança com a multa e os juros de hoje, pronta para copiar, imprimir ou mandar. */
export default function JanelaDoBoleto({ cobranca, aoFechar }: { cobranca: Cobranca | null; aoFechar: () => void }) {
  const [via, setVia] = useState<SegundaVia | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    setVia(null);
    setFalhou(false);
    if (!cobranca) return;
    let vivo = true;
    locacaoService.segundaVia(cobranca.id).then(v => { if (vivo) setVia(v); }).catch(() => { if (vivo) setFalhou(true); });
    return () => { vivo = false; };
  }, [cobranca]);

  const copiar = async (texto: string, oQue: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success(`${oQue} copiado.`);
    } catch {
      toast.error('Não deu pra copiar. Selecione o texto e copie à mão.');
    }
  };

  const enviar = async () => {
    if (!cobranca) return;
    setEnviando(true);
    try {
      await locacaoService.enviarSegundaVia(cobranca.id);
      toast.success('2ª via enviada no WhatsApp do inquilino.');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Não deu pra enviar a 2ª via.'));
    } finally {
      setEnviando(false);
    }
  };

  const total = via?.total_hoje ?? via?.total ?? 0;

  return (
    <Dialog open={cobranca !== null} onOpenChange={v => !v && aoFechar()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {cobranca?.tipo === 'final' ? 'Acerto de rescisão' : 'Boleto'}
            {cobranca?.imovel_descricao ? ` · ${imovelCurto(cobranca.imovel_descricao)}` : ''}
          </DialogTitle>
          <DialogDescription>{cobranca?.inquilino_nome}</DialogDescription>
        </DialogHeader>

        {falhou ? (
          <Aviso tom="erro">Não deu pra carregar o boleto. Feche e abra de novo.</Aviso>
        ) : !via ? (
          <Carregando variante="texto" linhas={4} rotulo="Carregando o boleto…" />
        ) : (
          <div className="grid gap-4">
            {via.dias_atraso > 0 && (
              <Aviso tom="atencao">
                Vencido há {plural(via.dias_atraso, 'dia', 'dias')}. O valor abaixo já tem a multa e os juros de hoje.
              </Aviso>
            )}

            <div className="grid">
              <Dado rotulo="Vencimento">{data(via.vencimento)}</Dado>
              {via.periodo_ini && via.periodo_fim && <Dado rotulo="Período cobrado">{data(via.periodo_ini)} a {data(via.periodo_fim)}</Dado>}
              {via.endereco && <Dado rotulo="Imóvel">{via.endereco}</Dado>}
            </div>

            <div className="grid gap-3">
              {ORDEM_DOS_DESTINOS.map(d => {
                const itens = via.itens.filter(i => i.dest === d);
                if (itens.length === 0) return null;
                return (
                  <div key={d} className="grid gap-1">
                    <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <span aria-hidden className={`h-2 w-2 rounded-full ${DESTINO[d].cor}`} />
                      {DESTINO[d].rotulo}
                      <span className="font-normal">· {DESTINO[d].ajuda}</span>
                    </p>
                    {itens.map(i => (
                      <Dado key={`${i.desc}-${i.valor}`} rotulo={i.estimado && !/estimado/i.test(i.desc) ? `${i.desc} (estimado)` : i.desc}>{dinheiro(i.valor)}</Dado>
                    ))}
                  </div>
                );
              })}
              {via.multa_hoje > 0 && <Dado rotulo="Multa">{dinheiro(via.multa_hoje)}</Dado>}
              {via.juros_hoje > 0 && <Dado rotulo="Juros de mora">{dinheiro(via.juros_hoje)}</Dado>}
              <div className="flex items-baseline justify-between border-t border-border pt-2">
                <span className="text-sm font-medium">Total a pagar hoje</span>
                <span className="text-lg font-semibold tabular-nums">{dinheiro(total)}</span>
              </div>
            </div>

            {via.linha_digitavel && <Copiavel rotulo="Linha digitável" texto={via.linha_digitavel} aoCopiar={() => void copiar(via.linha_digitavel ?? '', 'Código')} />}
            {via.pix_copia_cola && <Copiavel rotulo="PIX copia e cola" texto={via.pix_copia_cola} aoCopiar={() => void copiar(via.pix_copia_cola ?? '', 'PIX')} />}
            {!via.linha_digitavel && !via.pix_copia_cola && !via.link_boleto && (
              <Aviso tom="neutro" compacto>Este boleto ainda não tem código de pagamento. Nesta conta a cobrança é registrada à mão.</Aviso>
            )}
          </div>
        )}

        <DialogFooter>
          {via?.link_boleto && (
            <Button variant="outline" onClick={() => window.open(via.link_boleto ?? '', '_blank', 'noopener,noreferrer')}>
              <ExternalLink className="mr-1 h-4 w-4" />Abrir o boleto
            </Button>
          )}
          <Button variant="outline" disabled={!via} onClick={() => window.print()}><Printer className="mr-1 h-4 w-4" />Imprimir</Button>
          <Button disabled={!via || enviando} onClick={() => void enviar()}><Send className="mr-1 h-4 w-4" />Enviar no WhatsApp</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
