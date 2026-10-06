import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import EmptyState from '@/components/base/EmptyState';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label } from '@/components/ui/ds';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { pacotesService } from '@/services/superAdmin/pacotesService';
import type { EdicaoDoPacote, LimitesDoPacote, MudancasDoPacote, PacoteDetalhe } from '@/types/admin/pacotes';
import QuadrosDeFuncoes from '../QuadrosDeFuncoes';
import { validarLimites } from '../limites';
import { plural } from '@/lib/formato';
import { resumoDeMudancas } from './resumoDeMudancas';

// Editor de pacote: nome, funções (os mesmos quadros da página do cliente) e
// limites. Salvar mostra a prévia e pergunta se aplica aos clientes do pacote;
// aplicar preserva os ajustes manuais de cada cliente (servidor).
export default function Editor() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  const [pacote, setPacote] = useState<PacoteDetalhe | null>(null);
  const [erro, setErro] = useState(false);
  const [nome, setNome] = useState('');
  const [funcoes, setFuncoes] = useState<Record<string, boolean>>({});
  const [limites, setLimites] = useState<{ numeros: string; franquia: string; preco: string }>({ numeros: '', franquia: '', preco: '' });
  const [previa, setPrevia] = useState<{ clients_count: number; changes: MudancasDoPacote } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [pedindo, setPedindo] = useState(false);

  const carregar = useCallback(async () => {
    setErro(false);
    try {
      const p = await pacotesService.obter(id);
      setPacote(p); setNome(p.name); setFuncoes(p.features);
      setLimites({ numeros: String(p.limits.max_whatsapp_channels), franquia: p.limits.ai_leads_included == null ? '' : String(p.limits.ai_leads_included), preco: String(p.limits.ai_lead_overage_price_brl) });
    } catch { setErro(true); }
  }, [id]);

  useEffect(() => { void carregar(); }, [carregar]);

  const { erros, valores } = validarLimites(limites);

  // Só manda o que mudou em relação ao pacote carregado.
  const edicao = (): EdicaoDoPacote => {
    const mudadas = Object.fromEntries(Object.entries(funcoes).filter(([k, v]) => pacote?.features[k] !== v));
    const lim: Partial<LimitesDoPacote> = {};
    if (pacote && valores) {
      (Object.keys(valores) as (keyof LimitesDoPacote)[]).forEach((k) => {
        if (valores[k] !== pacote.limits[k]) (lim as Record<string, number | null>)[k] = valores[k];
      });
    }
    return {
      name: nome.trim(),
      ...(Object.keys(mudadas).length ? { features: mudadas } : {}),
      ...(Object.keys(lim).length ? { limits: lim } : {}),
    };
  };

  const pedirSalvar = async () => {
    if (!valores || pedindo) return;
    setPedindo(true);
    try { setPrevia(await pacotesService.previa(id, edicao())); }
    catch (e: any) { toast.error(e?.response?.data?.error || 'Não deu pra calcular a prévia.'); }
    finally { setPedindo(false); }
  };

  const salvar = async (aplicar: boolean) => {
    setSalvando(true);
    try {
      const r = await pacotesService.salvar(id, edicao(), aplicar);
      setPrevia(null);
      if (r.result?.failed.length) toast.error(`Não deu pra aplicar em: ${r.result.failed.map((f) => f.name).join(', ')}`);
      else toast.success(aplicar ? `Pacote salvo e aplicado a ${plural(r.result?.applied ?? 0, 'cliente', 'clientes')}.` : 'Pacote salvo.');
      void carregar();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Não deu pra salvar.');
    } finally { setSalvando(false); }
  };

  const apagar = async () => {
    if (!pacote) return;
    if (!(await confirmar({ titulo: `Apagar o pacote ${pacote.name}?`, descricao: 'Ele some da lista de pacotes.', rotuloDaAcao: 'Apagar', destrutivo: true }))) return;
    try { await pacotesService.apagar(id); navigate('/admin/clientes/pacotes'); }
    catch (e: any) { toast.error(e?.response?.data?.error || 'Não deu pra apagar.'); }
  };

  if (erro) return <EmptyState tipo="erro" title="Não deu para carregar o pacote" aoTentarDeNovo={() => void carregar()} />;
  if (!pacote) return <div aria-busy="true" className="h-60 animate-pulse rounded-lg bg-muted" />;
  const linhas = previa ? resumoDeMudancas(previa.changes) : [];

  return (
    <div className="flex flex-col gap-4">
      <Link to="/admin/clientes/pacotes" className="text-sm text-muted-foreground hover:text-foreground">← Pacotes</Link>
      <div className="flex flex-wrap items-end gap-3">
        <div><Label htmlFor="pk-nome">Nome</Label><Input id="pk-nome" value={nome} onChange={(e) => setNome(e.target.value)} className="w-64" /></div>
        <p className="text-sm text-muted-foreground">{plural(pacote.clients_count, 'cliente', 'clientes')} neste pacote</p>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" disabled={pacote.clients_count > 0} title={pacote.clients_count > 0 ? 'Só dá pra apagar pacote sem clientes' : undefined} onClick={() => void apagar()}>Apagar</Button>
          <Button disabled={!valores || pedindo} onClick={() => void pedirSalvar()}>Salvar pacote</Button>
        </div>
      </div>
      <section aria-labelledby="pk-limites" className="rounded-lg border p-4">
        <h2 id="pk-limites" className="mb-3 text-sm font-semibold">Limites</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div><Label htmlFor="pk-num">Números de WhatsApp</Label><Input id="pk-num" aria-invalid={!!erros.numeros} aria-describedby={erros.numeros ? 'pk-num-erro' : undefined} inputMode="numeric" value={limites.numeros} onChange={(e) => setLimites({ ...limites, numeros: e.target.value })} />{erros.numeros && <p id="pk-num-erro" className="mt-1 text-xs text-destructive">{erros.numeros}</p>}</div>
          <div><Label htmlFor="pk-fr">Franquia de leads da IA</Label><Input id="pk-fr" aria-invalid={!!erros.franquia} aria-describedby={erros.franquia ? 'pk-fr-erro' : undefined} inputMode="numeric" placeholder="sem franquia" value={limites.franquia} onChange={(e) => setLimites({ ...limites, franquia: e.target.value })} />{erros.franquia && <p id="pk-fr-erro" className="mt-1 text-xs text-destructive">{erros.franquia}</p>}</div>
          <div><Label htmlFor="pk-pr">Preço do excedente (R$)</Label><Input id="pk-pr" aria-invalid={!!erros.preco} aria-describedby={erros.preco ? 'pk-pr-erro' : undefined} inputMode="decimal" value={limites.preco} onChange={(e) => setLimites({ ...limites, preco: e.target.value })} />{erros.preco && <p id="pk-pr-erro" className="mt-1 text-xs text-destructive">{erros.preco}</p>}</div>
        </div>
      </section>
      <QuadrosDeFuncoes catalog={pacote.catalog} ligada={(k) => funcoes[k] !== false}
        aoMudar={async (patch) => { setFuncoes((f) => ({ ...f, ...patch })); return true; }} />

      <Dialog open={!!previa} onOpenChange={(v) => { if (!v) setPrevia(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{previa && previa.clients_count > 0 ? `Aplicar ${previa.clients_count === 1 ? 'ao' : 'aos'} ${plural(previa.clients_count, 'cliente', 'clientes')} deste pacote?` : 'Salvar o pacote?'}</DialogTitle>
            <DialogDescription>{linhas.length ? 'O que muda:' : 'Nenhuma função ou limite muda.'}{previa && previa.clients_count > 0 ? ' Ajustes manuais de cada cliente são mantidos.' : ''}</DialogDescription>
          </DialogHeader>
          <ul className="list-disc pl-5 text-sm">{linhas.map((l) => <li key={l}>{l}</li>)}</ul>
          <DialogFooter>
            <Button variant="outline" disabled={salvando} onClick={() => void salvar(false)}>Só salvar o pacote</Button>
            {previa && previa.clients_count > 0 && <Button disabled={salvando} onClick={() => void salvar(true)}>Salvar e aplicar</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {dialogoDeConfirmacao}
    </div>
  );
}
