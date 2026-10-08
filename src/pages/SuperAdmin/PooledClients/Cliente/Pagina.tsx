import type { ReactElement } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import Abas from '@/components/base/Abas';
import EmptyState from '@/components/base/EmptyState';
import { clientesService } from '@/services/superAdmin/clientesService';
import type { ClientePooled } from '@/types/admin/clientes';
import BotaoEntrar from '../BotaoEntrar';
import { ESQUELETO, PAGINA, SELO } from '@/pages/Admin/Area/estilo';
import { rotuloDaSituacao } from '../situacao';
import AbaContrato from './AbaContrato';
import AbaFuncoes from './AbaFuncoes';
import AbaOperacao from './AbaOperacao';
import AbaPessoas from './AbaPessoas';
import AbaResumo from './AbaResumo';
import MenuDoCliente from './MenuDoCliente';
import { useNomeDaAba } from '@/components/layout/nomeDaAba';

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
  contrato: (p) => <AbaContrato {...p} />,
  funcoes: (p) => <AbaFuncoes {...p} />,
  pessoas: (p) => <AbaPessoas {...p} />,
  operacao: (p) => <AbaOperacao {...p} />,
};

export default function Pagina() {
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const abaUrl = params.get('aba');
  const aba: ChaveDaAba = ABAS.some((a) => a.chave === abaUrl) ? (abaUrl as ChaveDaAba) : 'resumo';
  const [estado, setEstado] = useState<{ tipo: 'carregando' } | { tipo: 'erro' } | { tipo: 'naoEncontrado' } | { tipo: 'pronto'; cliente: ClientePooled }>({ tipo: 'carregando' });
  const seq = useRef(0);
  useNomeDaAba(estado.tipo === 'pronto' ? estado.cliente.name : null);

  // silencioso: recarga com a página pronta. Se falhar, mantém o cliente que já está na tela.
  const carregar = useCallback(async (silencioso = false) => {
    const minha = ++seq.current;
    try {
      const c = await clientesService.obter(id);
      if (minha === seq.current) setEstado({ tipo: 'pronto', cliente: c });
    } catch (e: any) {
      if (silencioso) return;
      if (minha === seq.current) setEstado({ tipo: e?.response?.status === 404 ? 'naoEncontrado' : 'erro' });
    }
  }, [id]);

  useEffect(() => { setEstado({ tipo: 'carregando' }); void carregar(); }, [carregar]);

  if (estado.tipo === 'carregando') return <div aria-busy="true" className={`h-40 ${ESQUELETO}`} />;
  if (estado.tipo === 'naoEncontrado') return <EmptyState tipo="vazio" title="Cliente não encontrado" description="Ele pode ter sido excluído." />;
  if (estado.tipo === 'erro') return <EmptyState tipo="erro" title="Não deu para carregar o cliente" aoTentarDeNovo={() => void carregar()} />;

  const t = estado.cliente;
  const st = rotuloDaSituacao(t.situation, t.status);
  const props: PropsDaAba = { cliente: t, aoMudar: (c) => setEstado({ tipo: 'pronto', cliente: c }), recarregar: () => void carregar(true) };
  const Conteudo = CONTEUDO[aba];

  const entrar = async () => {
    try { window.open(await clientesService.entrar(t.id), '_blank'); } catch { toast.error('Falha ao gerar acesso.'); }
  };

  return (
    <div className={PAGINA}>
      <header className="flex flex-col gap-3">
        <Link to="/admin/clientes" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Clientes
        </Link>
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex min-w-0 flex-col gap-2">
            <h1 className="truncate text-2xl font-semibold">{t.name}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`${SELO} ${st.cls}`}>{st.label}</span>
              {t.package !== undefined && (
                <span className={`${SELO} text-muted-foreground`}>{t.package?.name ?? 'Personalizado'}</span>
              )}
              <a href={`https://${t.slug}.lmflow.com.br`} target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                {t.slug}.lmflow.com.br <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <BotaoEntrar desabilitado={st.provisionando} aoClicar={() => void entrar()} />
            <MenuDoCliente cliente={t} recarregar={props.recarregar} />
          </div>
        </div>
      </header>
      <Abas rotulo="Seções do cliente" abas={ABAS.map((a) => ({ chave: a.chave, rotulo: a.rotulo }))} ativa={aba}
        aoTrocar={(chave) => setParams((atual) => { const n = new URLSearchParams(atual); if (chave === 'resumo') n.delete('aba'); else n.set('aba', chave); return n; }, { replace: true })} />
      {Conteudo ? <Conteudo {...props} /> : null}
    </div>
  );
}
