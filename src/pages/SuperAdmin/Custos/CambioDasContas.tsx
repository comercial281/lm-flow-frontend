import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label,
} from '@/components/ui/ds';
import { costsService } from '@/services/superAdmin/costsService';
import type { AccountingRate } from '@/types/admin/costs';

// Câmbio das contas (Tony, 06/10/2026): fixo, editável, R$ 5,46 por padrão
// (dólar 5,20 + 5%). Vale em Custos, Margem, Visão Geral e no uso de IA de
// Clientes, para as telas baterem entre si. `aoMudar`: a tela recarrega o que
// mostra em R$. Lido por conta própria: aparece mesmo se o resumo falhar.
const VALOR = /^\d+([.,]\d+)?$/;
// O servidor guarda 4 casas: o campo abre com elas, para salvar sem mexer não mudar as contas em silêncio.
const reais = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;

export default function CambioDasContas({ aoMudar }: { aoMudar: () => void }) {
  const [cambio, setCambio] = useState<AccountingRate | null>(null);
  const [erro, setErro] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState('');
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setErro(false);
    try {
      setCambio(await costsService.cambio());
    } catch {
      setErro(true);
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  const bruto = texto.trim();
  const novo = VALOR.test(bruto) ? Number(bruto.replace(',', '.')) : NaN;
  // O servidor é o dono da regra; aqui só evita o pedido óbvio errado.
  const valido = novo > 0 && novo < 100;
  const msgErro = Number.isFinite(novo) && novo >= 100 ? 'Digite um valor menor que 100, como 5,46.' : 'Digite um valor maior que zero, como 5,46.';

  const salvar = async () => {
    setSalvando(true);
    try {
      setCambio(await costsService.salvarCambio(bruto));
      toast.success('Câmbio das contas salvo.');
      setAberto(false);
      aoMudar();
    } catch (e) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Não deu pra salvar o câmbio.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Câmbio das contas:</span>
      {erro ? (
        <>
          <span className="text-destructive">não deu pra ler</span>
          <Button variant="link" size="sm" className="h-auto p-0" onClick={() => void carregar()}>Tentar de novo</Button>
        </>
      ) : cambio ? (
        <>
          <span className="font-medium tabular-nums">{reais(cambio.value)}</span>
          <span aria-hidden="true" className="text-muted-foreground">·</span>
          <Button variant="link" size="sm" className="h-auto p-0" onClick={() => { setTexto(cambio.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })); setAberto(true); }}>
            Mudar
          </Button>
        </>
      ) : (
        <span aria-busy="true" className="inline-block h-4 w-16 animate-pulse rounded bg-muted" />
      )}

      <Dialog open={aberto} onOpenChange={(v) => { if (!v && !salvando) setAberto(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Câmbio das contas</DialogTitle>
            <DialogDescription>
              Quanto vale um dólar nas contas do admin. Muda de uma vez Custos, Margem, Visão Geral e o uso de IA na lista de Clientes.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="cambio-valor">Reais por dólar</Label>
            <Input id="cambio-valor" inputMode="decimal" value={texto} aria-invalid={!valido}
              aria-describedby={!valido ? 'cambio-valor-erro' : undefined} onChange={(e) => setTexto(e.target.value)} />
            {!valido && <p id="cambio-valor-erro" className="mt-1 text-xs text-destructive">{msgErro}</p>}
            {cambio && valido && (
              <p className="mt-1 text-xs text-muted-foreground">Hoje: {reais(cambio.value)}. Todas as contas passam a usar {reais(novo)}.</p>
            )}
            {cambio && (
              <p className="mt-1 text-xs text-muted-foreground">Padrão: {reais(cambio.default_value)} (dólar 5,20 + 5%).</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={salvando} onClick={() => setAberto(false)}>Cancelar</Button>
            <Button disabled={!valido || salvando} onClick={() => void salvar()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
