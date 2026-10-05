// src/pages/SuperAdmin/PooledClients/Cliente/AbaContrato.tsx
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Seletor } from '@/components/base/Seletor';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label } from '@/components/ui/ds';
import { clientesService } from '@/services/superAdmin/clientesService';
import { pacotesService } from '@/services/superAdmin/pacotesService';
import { plural } from '@/lib/formato';
import type { PacoteDaLista } from '@/types/admin/pacotes';
import type { ClientePooled } from '@/types/admin/clientes';
import { resumoDeMudancas, type DiffDoCliente } from '../Pacotes/resumoDeMudancas';
import { groupJidsFrom, groupsPatch } from '../clientGroups';
import { validarLimites } from '../limites';
import type { PropsDaAba } from './Pagina';

// Contrato do cliente. Pacote (trocar / voltar ao pacote, com prévia) e os três limites (números de WhatsApp, franquia de
// leads da IA, preço do excedente). O PATCH reenvia os grupos de WhatsApp: o
// servidor faz compact! nessas chaves e uma omissão apagaria os grupos.

export default function AbaContrato({ cliente, aoMudar }: PropsDaAba) {
  // `key` pelos limites: se o cliente mudar por fora (ex.: troca de pacote), os campos recomeçam dele.
  const chave = `${cliente.max_whatsapp_channels}|${cliente.ai_leads_included}|${cliente.ai_lead_overage_price_brl}`;
  return (
    <div className="space-y-4">
      <BlocoDoPacote cliente={cliente} aoMudar={aoMudar} />
      <FormularioDeLimites key={chave} cliente={cliente} aoMudar={aoMudar} />
    </div>
  );
}

type Previa = { changes: DiffDoCliente; undone: number };

// Pacote do cliente. Trocar ou voltar ao pacote DESFAZ os ajustes manuais: a prévia mostra o que muda e quantos ajustes somem.
function BlocoDoPacote({ cliente, aoMudar }: Pick<PropsDaAba, 'cliente' | 'aoMudar'>) {
  const [modo, setModo] = useState<'trocar' | 'voltar' | null>(null);
  const diferencas = cliente.package_diff_count ?? 0;
  return (
    <section aria-labelledby="pacote" className="max-w-xl rounded-lg border p-4">
      <h2 id="pacote" className="mb-1 text-sm font-semibold">Pacote</h2>
      <p className="text-sm">
        {cliente.package ? cliente.package.name : 'Personalizado'}
        {cliente.package && diferencas > 0 && <span className="ml-2 text-xs text-amber-700 dark:text-amber-300">{plural(diferencas, 'diferença', 'diferenças')} do pacote</span>}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setModo('trocar')}>Trocar pacote</Button>
        {cliente.package && diferencas > 0 && <Button variant="outline" onClick={() => setModo('voltar')}>Voltar ao pacote</Button>}
      </div>
      {modo && <DialogoDoPacote key={modo} modo={modo} cliente={cliente} aoMudar={aoMudar} aoFechar={() => setModo(null)} />}
    </section>
  );
}

function DialogoDoPacote({ modo, cliente, aoMudar, aoFechar }: { modo: 'trocar' | 'voltar'; cliente: ClientePooled; aoMudar: (c: ClientePooled) => void; aoFechar: () => void }) {
  const [pacotes, setPacotes] = useState<PacoteDaLista[]>([]);
  const [escolhido, setEscolhido] = useState('');
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [aplicando, setAplicando] = useState(false);

  const verPrevia = async (pkg?: string) => {
    setCarregando(true); setPrevia(null);
    try {
      const r = modo === 'trocar' ? await clientesService.trocarPacote(cliente.id, pkg!, true) : await clientesService.voltarAoPacote(cliente.id, true);
      setPrevia({ changes: r.changes as DiffDoCliente, undone: r.undone });
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Não deu pra ver o que muda.');
    } finally { setCarregando(false); }
  };

  useEffect(() => {
    if (modo === 'voltar') { void verPrevia(); return; }
    pacotesService.listar().then(setPacotes).catch(() => toast.error('Não deu pra carregar os pacotes.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const aplicar = async () => {
    setAplicando(true);
    try {
      const r = modo === 'trocar' ? await clientesService.trocarPacote(cliente.id, escolhido, false) : await clientesService.voltarAoPacote(cliente.id, false);
      aoMudar({ ...cliente, ...r.cliente });
      toast.success(modo === 'trocar' ? 'Pacote trocado.' : 'Cliente de volta ao pacote.');
      aoFechar();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Não deu pra aplicar.');
    } finally { setAplicando(false); }
  };

  const linhas = previa ? resumoDeMudancas(previa.changes) : [];
  const titulo = modo === 'trocar' ? 'Trocar pacote' : 'Voltar ao pacote';
  const pronto = !!previa && (modo === 'voltar' || !!escolhido);
  return (
    <Dialog open onOpenChange={(v) => { if (!v) aoFechar(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{modo === 'trocar' ? `Escolha o pacote de ${cliente.name}.` : `${cliente.name} volta a ser igual ao pacote ${cliente.package?.name ?? ''}.`}</DialogDescription>
        </DialogHeader>
        {modo === 'trocar' && (
          <div>
            <Label htmlFor="novo-pacote">Novo pacote</Label>
            <Seletor id="novo-pacote" aria-label="Novo pacote" value={escolhido} onChange={(e) => { setEscolhido(e.target.value); if (e.target.value) void verPrevia(e.target.value); else setPrevia(null); }}>
              <option value="">Escolher…</option>
              {pacotes.filter((p) => p.id !== cliente.package?.id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Seletor>
          </div>
        )}
        {carregando && <div aria-busy="true" className="h-12 animate-pulse rounded-lg bg-muted" />}
        {previa && (
          <div className="space-y-2 text-sm">
            {linhas.length > 0 ? <ul className="list-disc pl-5">{linhas.map((l) => <li key={l}>{l}</li>)}</ul> : <p>Nenhuma função ou limite muda.</p>}
            {previa.undone > 0 && <p>{`Os ${previa.undone} ajustes manuais deste cliente serão desfeitos.`}</p>}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={aoFechar}>Cancelar</Button>
          <Button disabled={!pronto || aplicando} onClick={() => void aplicar()}>{modo === 'trocar' ? 'Trocar' : 'Voltar ao pacote'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FormularioDeLimites({ cliente, aoMudar }: Pick<PropsDaAba, 'cliente' | 'aoMudar'>) {
  const diferentes = new Set((cliente.package_diff?.limits ?? []).map((l) => l.key));
  const marca = (k: string) => diferentes.has(k as never) ? <span className="ml-2 text-xs text-amber-700 dark:text-amber-300">≠ pacote</span> : null;
  const [numeros, setNumeros] = useState(String(cliente.max_whatsapp_channels ?? 5));
  const [franquia, setFranquia] = useState(cliente.ai_leads_included == null ? '' : String(cliente.ai_leads_included));
  const [preco, setPreco] = useState(String(cliente.ai_lead_overage_price_brl ?? 2.49));
  const [salvando, setSalvando] = useState(false);

  const { erros, valores } = validarLimites({ numeros, franquia, preco });
  const erroNumeros = erros.numeros ?? null;
  const erroFranquia = erros.franquia ?? null;
  const erroPreco = erros.preco ?? null;

  const salvar = async () => {
    if (!valores) return;
    setSalvando(true);
    try {
      const atualizado = await clientesService.atualizar(cliente.id, {
        name: cliente.name,
        ...groupsPatch(groupJidsFrom(cliente.settings ?? {})),
        ...valores,
      });
      aoMudar({ ...cliente, ...atualizado });
      toast.success('Limites salvos.');
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Não deu pra salvar.');
    } finally { setSalvando(false); }
  };

  const msg = (id: string, t: string | null) => t ? <p id={id} className="mt-1 text-xs text-destructive">{t}</p> : null;

  return (
    <section aria-labelledby="limites" className="max-w-xl rounded-lg border p-4">
      <h2 id="limites" className="mb-3 text-sm font-semibold">Limites</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <div><Label htmlFor="lim-num">Números de WhatsApp</Label>{marca('max_whatsapp_channels')}
          <Input id="lim-num" inputMode="numeric" aria-invalid={!!erroNumeros} aria-describedby={erroNumeros ? 'lim-num-erro' : undefined} value={numeros} onChange={(e) => setNumeros(e.target.value)} />
          {msg('lim-num-erro', erroNumeros)}
          <p className="mt-1 text-xs text-muted-foreground">0 = ilimitado · em uso: {cliente.whatsapp_channels_used ?? '—'}</p></div>
        <div><Label htmlFor="lim-fr">Franquia de leads da IA</Label>{marca('ai_leads_included')}
          <Input id="lim-fr" inputMode="numeric" placeholder="sem franquia" aria-invalid={!!erroFranquia} aria-describedby={erroFranquia ? 'lim-fr-erro' : undefined} value={franquia} onChange={(e) => setFranquia(e.target.value)} />
          {msg('lim-fr-erro', erroFranquia)}</div>
        <div><Label htmlFor="lim-pr">Preço do excedente (R$)</Label>{marca('ai_lead_overage_price_brl')}
          <Input id="lim-pr" inputMode="decimal" aria-invalid={!!erroPreco} aria-describedby={erroPreco ? 'lim-pr-erro' : undefined} value={preco} onChange={(e) => setPreco(e.target.value)} />
          {msg('lim-pr-erro', erroPreco)}</div>
      </div>
      <Button className="mt-3" disabled={salvando || !valores} onClick={() => void salvar()}>Salvar limites</Button>
    </section>
  );
}
