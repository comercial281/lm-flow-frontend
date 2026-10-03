import { useEffect, useRef, useState } from 'react';
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input } from '@/components/ui/ds';
import { costsService } from '@/services/superAdmin/costsService';
import type { Invoice, InvoiceInput } from '@/types/admin/costs';
import { rotuloMes } from './formatoCustos';

// Uma vez por mês: o valor de cada fatura em US$. Vazio apaga o lançamento.
export default function LancarFaturas({ month, aberta, aoFechar, aoSalvar }: { month: string; aberta: boolean; aoFechar: () => void; aoSalvar: () => void }) {
  const [linhas, setLinhas] = useState<(InvoiceInput & { label: string })[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  // Só a última abertura/mês vale: resposta atrasada de outro mês é descartada.
  const seq = useRef(0);

  useEffect(() => {
    const minha = ++seq.current;
    // Limpa sempre: ao reabrir (ou trocar o mês) não sobra valor do mês anterior.
    setLinhas([]);
    setErro(null);
    if (!aberta) return;
    costsService.invoices(month)
      .then((list: Invoice[]) => {
        if (minha !== seq.current) return;
        setLinhas(list.map((i) => ({
          provider: i.provider, label: i.label, amount_usd: i.amount_usd == null ? '' : String(i.amount_usd).replace('.', ','), note: i.note ?? '',
        })));
      })
      .catch(() => {
        if (minha !== seq.current) return;
        setErro('Não deu para carregar as faturas deste mês.');
      });
  }, [aberta, month]);

  const salvar = async () => {
    setSalvando(true);
    setErro(null);
    try {
      await costsService.saveInvoices(month, linhas.map(({ provider, amount_usd, note }) => ({ provider, amount_usd, note })));
      aoSalvar();
      aoFechar();
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setErro(msg ?? 'Não deu para salvar. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={aberta} onOpenChange={(o) => { if (!o) aoFechar(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Faturas de {rotuloMes(month)}</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-3">
          {linhas.map((l, idx) => (
            <label key={l.provider} className="flex items-center justify-between gap-3 text-sm">
              <span>{l.label} (US$)</span>
              <Input
                aria-label={`${l.label} (US$)`}
                inputMode="decimal"
                className="w-40 text-right"
                value={l.amount_usd}
                onChange={(e) => setLinhas((ls) => ls.map((x, i) => (i === idx ? { ...x, amount_usd: e.target.value } : x)))}
              />
            </label>
          ))}
          <p className="text-xs text-muted-foreground">Deixe vazio o que não tem fatura neste mês.</p>
          {erro && <p className="text-sm text-destructive" role="alert">{erro}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={aoFechar}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando || linhas.length === 0}>{salvando ? 'Salvando…' : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
