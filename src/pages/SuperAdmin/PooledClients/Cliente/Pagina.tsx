import type { ReactElement } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ExternalLink, LogIn } from 'lucide-react';
import { toast } from 'sonner';
import Abas from '@/components/base/Abas';
import EmptyState from '@/components/base/EmptyState';
import { Button } from '@/components/ui/ds';
import { clientesService } from '@/services/superAdmin/clientesService';
import type { ClientePooled } from '@/types/admin/clientes';
import { rotuloDaSituacao } from '../situacao';
import AbaFuncoes from './AbaFuncoes';
import AbaResumo from './AbaResumo';
import MenuDoCliente from './MenuDoCliente';

// Página do cliente (/admin/clientes/:id). Abas no endereço (?aba=). Cada aba
// carrega e falha sozinha; o topo fica de pé mesmo se uma aba quebrar.
export type PropsDaAba = { cliente: ClientePooled; aoMudar: (c: ClientePooled) => void; recarregar: () => void };

const ABAS = [
  { chave: 'resumo', rotulo: 'Resumo' },
  { chave: 'contrato', rotulo: 'Contrato' },
  { chave: 'funcoes', rotulo: 'Funções' },
  { chave: 'pessoas', rotulo: 'Pessoas' },
  { chave: 'operacao', rotulo: 'Operação' },
] as const;
type ChaveDaAba = (typeof ABAS)[number]['chave'];

const CONTEUDO: Partial<Record<ChaveDaAba, (p: PropsDaAba) => ReactElement>> = {
  resumo: ({ cliente }) => <AbaResumo cliente={cliente} />,
  funcoes: (p) => <AbaFuncoes {...p} />,
};

export default function Pagina() {
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const abaUrl = params.get('aba');
  const aba: ChaveDaAba = ABAS.some((a) => a.chave === abaUrl) ? (abaUrl as ChaveDaAba) : 'resumo';
  const [estado, setEstado] = useState<{ tipo: 'carregando' } | { tipo: 'erro' } | { tipo: 'naoEncontrado' } | { tipo: 'pronto'; cliente: ClientePooled }>({ tipo: 'carregando' });
  const seq = useRef(0);

  const carregar = useCallback(async () => {
    const minha = ++seq.current;
    try {
      const c = await clientesService.obter(id);
      if (minha === seq.current) setEstado({ tipo: 'pronto', cliente: c });
    } catch (e: any) {
      if (minha === seq.current) setEstado({ tipo: e?.response?.status === 404 ? 'naoEncontrado' : 'erro' });
    }
  }, [id]);

  useEffect(() => { setEstado({ tipo: 'carregando' }); void carregar(); }, [carregar]);

  if (estado.tipo === 'carregando') return <div aria-busy="true" className="h-40 animate-pulse rounded-lg bg-muted" />;
  if (estado.tipo === 'naoEncontrado') return <EmptyState tipo="vazio" title="Cliente não encontrado" description="Ele pode ter sido excluído." />;
  if (estado.tipo === 'erro') return <EmptyState tipo="erro" title="Não deu para carregar o cliente" aoTentarDeNovo={() => void carregar()} />;

  const t = estado.cliente;
  const st = rotuloDaSituacao(t.situation, t.status);
  const props: PropsDaAba = { cliente: t, aoMudar: (c) => setEstado({ tipo: 'pronto', cliente: c }), recarregar: () => void carregar() };
  const Conteudo = CONTEUDO[aba];

  const entrar = async () => {
    try { window.open(await clientesService.entrar(t.id), '_blank'); } catch { toast.error('Falha ao gerar acesso.'); }
  };

  return (
    <div className="flex flex-col gap-4">
      <Link to="/admin/clientes" className="text-sm text-muted-foreground hover:text-foreground">← Clientes</Link>
      <header className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold">{t.name}</h1>
        <span className={`rounded-full border px-2 py-0.5 text-xs ${st.cls}`}>{st.label}</span>
        {t.package !== undefined && (
          <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">{t.package?.name ?? 'Personalizado'}</span>
        )}
        <a href={`https://${t.slug}.lmflow.com.br`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          {t.slug}.lmflow.com.br <ExternalLink className="h-3.5 w-3.5" />
        </a>
        <div className="ml-auto flex gap-2">
          <Button size="sm" disabled={st.provisionando} onClick={() => void entrar()}><LogIn className="mr-1.5 h-4 w-4" /> Entrar</Button>
          <MenuDoCliente cliente={t} recarregar={props.recarregar} />
        </div>
      </header>
      <Abas rotulo="Seções do cliente" abas={ABAS.map((a) => ({ chave: a.chave, rotulo: a.rotulo }))} ativa={aba}
        aoTrocar={(chave) => setParams((atual) => { const n = new URLSearchParams(atual); if (chave === 'resumo') n.delete('aba'); else n.set('aba', chave); return n; }, { replace: true })} />
      {Conteudo ? <Conteudo {...props} /> : null}
    </div>
  );
}
