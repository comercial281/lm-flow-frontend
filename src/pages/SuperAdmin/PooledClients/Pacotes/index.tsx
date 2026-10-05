import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import EmptyState from '@/components/base/EmptyState';
import { Seletor } from '@/components/base/Seletor';
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label } from '@/components/ui/ds';
import { clientesService } from '@/services/superAdmin/clientesService';
import { pacotesService } from '@/services/superAdmin/pacotesService';
import type { ClientePooled } from '@/types/admin/clientes';
import type { PacoteDaLista } from '@/types/admin/pacotes';
import { plural } from '@/lib/formato';

// Clientes → Pacotes: lista e "Novo pacote" (do zero, de um pacote ou de um cliente).
export default function Pacotes() {
  const navigate = useNavigate();
  const [pacotes, setPacotes] = useState<PacoteDaLista[] | null>(null);
  const [erro, setErro] = useState(false);
  const [novo, setNovo] = useState(false);
  const [nome, setNome] = useState('');
  const [origem, setOrigem] = useState('');
  const [clientes, setClientes] = useState<ClientePooled[]>([]);
  const [erroClientes, setErroClientes] = useState(false);
  const [criando, setCriando] = useState(false);

  const carregar = useCallback(async () => {
    setErro(false);
    try { setPacotes(await pacotesService.listar()); } catch { setErro(true); }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => {
    if (!novo) return;
    setErroClientes(false);
    clientesService.listar(false).then(setClientes).catch(() => { setClientes([]); setErroClientes(true); });
  }, [novo]);

  const criar = async () => {
    if (criando) return;
    const [tipo, valor] = origem.split(':');
    setCriando(true);
    try {
      const p = await pacotesService.criar({ name: nome.trim(), ...(tipo === 'pacote' ? { from_package_id: valor } : {}), ...(tipo === 'cliente' ? { from_tenant_id: valor } : {}) });
      navigate(`/admin/clientes/pacotes/${p.id}`);
    } catch (e: any) { toast.error(e?.response?.data?.error || 'Não deu pra criar.'); }
    finally { setCriando(false); }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex"><Button className="ml-auto" onClick={() => setNovo(true)}>Novo pacote</Button></div>
      {erro ? <EmptyState tipo="erro" title="Não deu para carregar os pacotes" aoTentarDeNovo={() => void carregar()} />
        : pacotes === null ? <div aria-busy="true" className="h-40 animate-pulse rounded-lg bg-muted" />
        : pacotes.length === 0 ? <EmptyState tipo="vazio" title="Nenhum pacote ainda" description="Crie o primeiro a partir de um cliente que já está do jeito certo." />
        : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pacotes.map((p) => (
              <Link key={p.id} to={`/admin/clientes/pacotes/${p.id}`} className="rounded-xl border bg-card p-4 hover:border-primary/50">
                <h3 className="font-semibold">{p.name}</h3>
                <p className="text-sm text-muted-foreground">{plural(p.clients_count, 'cliente', 'clientes')} · {plural(p.features_on, 'função ligada', 'funções ligadas')}</p>
              </Link>
            ))}
          </div>
        )}
      <Dialog open={novo} onOpenChange={setNovo}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo pacote</DialogTitle></DialogHeader>
          <div><Label htmlFor="np-nome">Nome</Label><Input id="np-nome" value={nome} onChange={(e) => setNome(e.target.value)} /></div>
          <div><Label htmlFor="np-origem">Começar de</Label>
            <Seletor id="np-origem" aria-label="Começar de" value={origem} onChange={(e) => setOrigem(e.target.value)}>
              <option value="">Padrão do sistema</option>
              {(pacotes ?? []).map((p) => <option key={p.id} value={`pacote:${p.id}`}>Pacote {p.name}</option>)}
              {clientes.map((c) => <option key={c.id} value={`cliente:${c.id}`}>Cliente {c.name}</option>)}
            </Seletor>
            {erroClientes && <p role="alert" className="mt-1 text-xs text-destructive">Não deu pra carregar os clientes.</p>}
          </div>
          <DialogFooter><Button disabled={!nome.trim() || criando} onClick={() => void criar()}>Criar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
