import { useEffect, useMemo, useState } from 'react';
import { Printer } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/ds';
import Aviso from '@/components/base/Aviso';
import Carregando from '@/components/base/Carregando';
import { data, dataCurta, dinheiro } from '@/lib/formato';
import { locacaoService } from '@/features/locacao/locacaoService';
import { imovelCurto } from '@/features/locacao/contratoDoc';
import type { Extrato, LancamentoDoExtrato } from '@/features/locacao/tipos';
import { Dado, Numero, Selo } from './comum';

/** O extrato do proprietário: o que entrou, o que foi descontado, o que já foi repassado, imóvel por imóvel. */
export default function JanelaDoExtrato({ chave, aoFechar }: { chave: string | null; aoFechar: () => void }) {
  const [extrato, setExtrato] = useState<Extrato | null>(null);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    setExtrato(null);
    setFalhou(false);
    if (!chave) return;
    let vivo = true;
    locacaoService.extrato(chave).then(e => { if (vivo) setExtrato(e); }).catch(() => { if (vivo) setFalhou(true); });
    return () => { vivo = false; };
  }, [chave]);

  const porImovel = useMemo(() => {
    const grupos = new Map<string, LancamentoDoExtrato[]>();
    (extrato?.lancamentos ?? []).forEach(l => {
      const chaveDoGrupo = `${l.contrato_id}|${l.imovel}`;
      grupos.set(chaveDoGrupo, [...(grupos.get(chaveDoGrupo) ?? []), l]);
    });
    return [...grupos.entries()].map(([k, linhas]) => ({ nome: k.split('|')[1], linhas }));
  }, [extrato]);

  return (
    <Dialog open={chave !== null} onOpenChange={v => !v && aoFechar()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Extrato do proprietário</DialogTitle>
          <DialogDescription>{extrato ? extrato.nome : 'Carregando…'}</DialogDescription>
        </DialogHeader>

        {falhou ? (
          <Aviso tom="erro">Não deu pra carregar o extrato. Feche e abra de novo.</Aviso>
        ) : !extrato ? (
          <Carregando variante="texto" linhas={5} rotulo="Carregando o extrato…" />
        ) : (
          <div className="grid gap-4">
            <div className="grid grid-cols-3 gap-4">
              <Numero rotulo="Entrou" valor={dinheiro(extrato.entradas)} />
              <Numero rotulo="Descontos" valor={dinheiro(extrato.descontos)} />
              <Numero rotulo="Saldo" valor={dinheiro(extrato.saldo)} />
            </div>
            <div className="grid">
              {extrato.doc && <Dado rotulo="CPF ou CNPJ">{extrato.doc}</Dado>}
              <Dado rotulo="Chave PIX">{extrato.pix_chave || 'não cadastrada'}</Dado>
            </div>

            {porImovel.length === 0 ? (
              <Aviso tom="neutro" compacto>Ainda não há lançamentos para este proprietário.</Aviso>
            ) : porImovel.map(g => (
              <div key={g.nome} className="grid gap-1">
                <h3 className="text-sm font-semibold">{imovelCurto(g.nome)}</h3>
                {g.linhas.map((l, i) => (
                  <div key={`${l.data}-${l.descricao}-${i}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border/60 py-1.5 text-sm last:border-0">
                    <span className="w-16 text-xs text-muted-foreground">{dataCurta(l.data)}</span>
                    <span className="min-w-0 flex-1 basis-40">{l.descricao}</span>
                    {l.repasse_status === 'enviado' && <Selo sev="ok">Repassado{l.repassado_em ? ` em ${data(l.repassado_em)}` : ''}</Selo>}
                    {l.repasse_status === 'aguardando' && <Selo sev="info">No lote</Selo>}
                    {!l.repasse_status && l.valor > 0 && l.disponivel_em && <Selo sev="warn">Libera em {dataCurta(l.disponivel_em)}</Selo>}
                    <span className={`font-medium tabular-nums ${l.valor < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>{dinheiro(l.valor)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" disabled={!extrato} onClick={() => window.print()}><Printer className="mr-1 h-4 w-4" />Imprimir</Button>
          <Button onClick={aoFechar}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
