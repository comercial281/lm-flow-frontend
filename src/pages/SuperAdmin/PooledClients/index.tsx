import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Workflow } from 'lucide-react';
import { toast } from 'sonner';
import EmptyState from '@/components/base/EmptyState';
import { Button, Input } from '@/components/ui/ds';
import { clientesService } from '@/services/superAdmin/clientesService';
import { overviewService } from '@/services/superAdmin/overviewService';
import type { ClientePooled } from '@/types/admin/clientes';
import type { Atencao } from '@/types/admin/overview';
import CartaoDoCliente from './CartaoDoCliente';
import ClientFollowupRolloutModal from './ClientFollowupRolloutModal';
import NewTenantWizard from './NewTenantWizard';
import { chaveDoCliente, filtrarCartoes, filtroValido, ordenarCartoes, problemasPorCliente, type FiltroLista } from './lista';
import { rotuloDaSituacao } from './situacao';

// Clientes → Clientes. Cartões na largura toda; o cartão abre a página do
// cliente (/admin/clientes/:id). Regras de ordem e filtro em lista.ts.
const FILTROS: { valor: FiltroLista; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Todos' }, { valor: 'com_problema', rotulo: 'Com problema' }, { valor: 'arquivados', rotulo: 'Arquivados' },
];

export default function PooledClients() {
  const [params, setParams] = useSearchParams();
  const filtro = filtroValido(params.get('filtro'));
  const busca = params.get('q') ?? '';
  const [clientes, setClientes] = useState<ClientePooled[] | null>(null);
  const [erro, setErro] = useState(false);
  const [atencao, setAtencao] = useState<Atencao | null>(null);
  const [entrando, setEntrando] = useState<string | null>(null);
  const [mostrarNovo, setMostrarNovo] = useState(false);
  const [mostrarFunil, setMostrarFunil] = useState(false);
  const seq = useRef(0);

  const carregar = useCallback(async () => {
    const minha = ++seq.current;
    setErro(false);
    setClientes(null);
    try {
      const lista = await clientesService.listar(filtro === 'arquivados');
      if (minha === seq.current) setClientes(lista);
    } catch {
      if (minha === seq.current) setErro(true);
    }
  }, [filtro]);

  useEffect(() => { void carregar(); }, [carregar]);
  // Selos de problema: em paralelo e sem segurar a lista; se falhar, os cartões ficam sem selo.
  useEffect(() => { overviewService.atencao().then(setAtencao).catch(() => setAtencao(null)); }, []);

  // Cliente sendo criado: recarrega até sair de "Provisionando".
  useEffect(() => {
    if (!clientes?.some((t) => rotuloDaSituacao(t.situation, t.status).provisionando)) return undefined;
    const id = setTimeout(() => { void carregar(); }, 4000);
    return () => clearTimeout(id);
  }, [clientes, carregar]);

  const problemas = useMemo(() => problemasPorCliente(atencao), [atencao]);
  const visiveis = useMemo(
    () => ordenarCartoes(filtrarCartoes(clientes ?? [], filtro, busca, problemas), problemas),
    [clientes, filtro, busca, problemas],
  );

  const mudarUrl = (k: string, v: string | null) => setParams((atual) => {
    const novo = new URLSearchParams(atual);
    if (v) novo.set(k, v); else novo.delete(k);
    return novo;
  }, { replace: true });

  const entrar = async (t: ClientePooled) => {
    setEntrando(t.id);
    try { window.open(await clientesService.entrar(t.id), '_blank'); } catch { toast.error('Falha ao gerar acesso.'); } finally { setEntrando(null); }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input aria-label="Buscar cliente" placeholder="Buscar cliente…" value={busca} onChange={(e) => mudarUrl('q', e.target.value || null)} className="w-full sm:w-64" />
        <div className="flex gap-1" role="group" aria-label="Filtro">
          {FILTROS.map((f) => (
            <Button key={f.valor} size="sm" variant={filtro === f.valor ? 'default' : 'outline'}
              aria-pressed={filtro === f.valor} onClick={() => mudarUrl('filtro', f.valor === 'todos' ? null : f.valor)}>
              {f.rotulo}
            </Button>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" disabled={!clientes?.length} onClick={() => setMostrarFunil(true)}>
            <Workflow className="mr-1.5 h-4 w-4" /> Funil em vários clientes
          </Button>
          <Button size="sm" onClick={() => setMostrarNovo(true)}><Plus className="mr-1.5 h-4 w-4" /> Novo cliente</Button>
        </div>
      </div>

      {erro ? (
        <EmptyState tipo="erro" title="Não deu para carregar os clientes" aoTentarDeNovo={() => void carregar()} />
      ) : clientes === null ? (
        <div aria-busy="true" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-40 animate-pulse rounded-xl bg-muted" />)}
        </div>
      ) : visiveis.length === 0 ? (
        <EmptyState tipo={busca || filtro !== 'todos' ? 'semResultado' : 'vazio'}
          title={filtro === 'arquivados' ? 'Nenhum cliente arquivado' : 'Nenhum cliente encontrado'}
          aoLimparFiltros={busca || filtro !== 'todos' ? () => setParams({}, { replace: true }) : undefined} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {visiveis.map((t) => (
            <CartaoDoCliente key={t.id} cliente={t} problema={problemas.get(chaveDoCliente(t))}
              aoEntrar={entrar} entrando={entrando === t.id} />
          ))}
        </div>
      )}

      {mostrarNovo && <NewTenantWizard onClose={() => setMostrarNovo(false)} onCreated={() => { setMostrarNovo(false); void carregar(); }} />}
      {mostrarFunil && <ClientFollowupRolloutModal tenants={clientes ?? []} onClose={() => setMostrarFunil(false)} />}
    </div>
  );
}
