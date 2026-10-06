import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertTriangle, Loader2, Plus, Shuffle } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/ds';
import Abas from '@/components/base/Abas';
import BaseHeader from '@/components/base/BaseHeader';
import BaseStatusBadge from '@/components/base/BaseStatusBadge';
import EmptyState from '@/components/base/EmptyState';
import { CampoTexto } from '@/components/base/Campo';
import { useCan } from '@/hooks/useCan';
import { usePodeSair } from './usePodeSair';
import { apiErrorMessage } from '@/utils/apiHelpers';
import {
  roletaConfigService,
  roletaLabel,
  type RoletaConfig,
} from '@/services/roletaConfig/roletaConfigService';
import { atencaoTexto, horarioTexto, origensEFila, prazoFrase } from './roletaNovaTextos';
import { ENDERECO_DA_ROLETA } from './enderecos';
import HistoricoLista from './HistoricoLista';
import AvisosAba from './AvisosAba';

// ── ROLETA DE LEADS (a roleta nova, a única desde 06/10/2026) ───────────────
//
// Página com três abas (D1): Roletas (um cartão por roleta, lido como frase),
// Histórico (de todas as roletas) e Avisos (valem pra todas, D7). A aba mora no
// endereço (`?aba=historico|avisos`), então dá pra mandar o link.
// Spec: LM FLOW/specs/2026-10-06-roleta-reestruturacao-design.md.

type Aba = 'roletas' | 'historico' | 'avisos';
const ABAS: Aba[] = ['roletas', 'historico', 'avisos'];

function CartaoDaRoleta({ roleta }: { roleta: RoletaConfig }) {
  const atencao = atencaoTexto(roleta);
  const nome = roletaLabel(roleta);
  return (
    <Link
      to={ENDERECO_DA_ROLETA(roleta.id)}
      aria-label={`Abrir a roleta ${nome}`}
      className="block rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/50 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base font-semibold leading-snug">{nome}</h2>
        <BaseStatusBadge status={roleta.is_active ? 'active' : 'inactive'} text={roleta.is_active ? 'Ligada' : 'Desligada'} />
      </div>
      <p className="mt-3 text-sm text-foreground">{origensEFila(roleta)}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {prazoFrase(roleta.timeout_minutes)} · {horarioTexto(roleta.business_hours_config)}
      </p>
      {atencao && (
        <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {atencao}
        </p>
      )}
    </Link>
  );
}

function ListaDeRoletas({ aoCriar, podeCriar }: { aoCriar: () => void; podeCriar: boolean }) {
  const [roletas, setRoletas] = useState<RoletaConfig[] | null>(null);
  const [erro, setErro] = useState(false);

  const carregar = useCallback(async () => {
    setErro(false);
    setRoletas(null);
    try {
      setRoletas(await roletaConfigService.getAll());
    } catch {
      setErro(true);
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  if (erro) return <EmptyState tipo="erro" aoTentarDeNovo={carregar} />;
  if (!roletas) {
    return (
      <div className="flex justify-center py-16 text-muted-foreground" role="status" aria-label="Carregando as roletas">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
      </div>
    );
  }
  if (roletas.length === 0) {
    return (
      <EmptyState
        icon={Shuffle}
        title="Nenhuma roleta ainda"
        description="A roleta decide qual corretor atende cada lead que chega dos seus formulários, landings, portais e site."
        exemplo="os leads do formulário da Zona Sul vão pros 5 corretores da fila, um de cada vez"
        action={podeCriar ? { label: 'Nova roleta', onClick: aoCriar } : undefined}
      />
    );
  }
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {roletas.map(r => <CartaoDaRoleta key={r.id} roleta={r} />)}
    </div>
  );
}

export default function RoletaLista() {
  const navigate = useNavigate();
  const can = useCan();
  const podeCriar = can('roleta_configs', 'create');
  const [params, setParams] = useSearchParams();
  const pedida = params.get('aba') as Aba | null;
  const aba: Aba = pedida && ABAS.includes(pedida) ? pedida : 'roletas';

  // Textos dos Avisos por salvar não somem calados ao trocar de aba ou criar.
  const { podeSair, dialogoDeSaida } = usePodeSair();
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState('');
  const [salvando, setSalvando] = useState(false);

  const trocarAba = async (chave: string) => {
    if (chave === aba || !(await podeSair())) return;
    setParams(antes => {
      const novos = new URLSearchParams(antes);
      if (chave === 'roletas') novos.delete('aba'); else novos.set('aba', chave);
      return novos;
    }, { replace: true });
  };

  const abrirCriacao = async () => {
    if (!(await podeSair())) return;
    setNome('');
    setCriando(true);
  };

  const criar = async () => {
    const limpo = nome.trim();
    if (!limpo || salvando) return;
    setSalvando(true);
    try {
      const nova = await roletaConfigService.createDraft(limpo);
      setCriando(false);
      navigate(ENDERECO_DA_ROLETA(nova.id));
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Não deu pra criar a roleta. Tente de novo.'));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto w-full max-w-[1400px] space-y-6">
          <BaseHeader
            title="Roleta de leads"
            subtitle="Decide qual corretor atende cada lead que chega, um de cada vez, na ordem da fila."
            primaryAction={podeCriar ? { label: 'Nova roleta', icon: <Plus className="h-4 w-4" />, onClick: () => void abrirCriacao() } : undefined}
          />
          <Abas
            rotulo="Roleta de leads"
            ativa={aba}
            aoTrocar={c => void trocarAba(c)}
            abas={[
              { chave: 'roletas', rotulo: 'Roletas' },
              { chave: 'historico', rotulo: 'Histórico' },
              { chave: 'avisos', rotulo: 'Avisos' },
            ]}
          />
          <div className="pt-2">
            {aba === 'roletas' && <ListaDeRoletas aoCriar={() => void abrirCriacao()} podeCriar={podeCriar} />}
            {aba === 'historico' && <HistoricoLista />}
            {aba === 'avisos' && <AvisosAba />}
          </div>
        </div>
      </div>

      <Dialog open={criando} onOpenChange={aberto => { if (!salvando) setCriando(aberto); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova roleta</DialogTitle>
            <DialogDescription>Ela nasce desligada. Na página dela você escolhe de onde vêm os leads e quem entra na fila.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={e => { e.preventDefault(); void criar(); }}
            className="space-y-6 py-2"
          >
            <CampoTexto
              id="roleta-nova-nome"
              rotulo="Nome da roleta"
              placeholder="Ex.: roleta da Zona Sul"
              valor={nome}
              aoMudar={setNome}
              autoFocus
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCriando(false)} disabled={salvando}>Cancelar</Button>
              <Button type="submit" disabled={!nome.trim() || salvando}>{salvando ? 'Criando…' : 'Criar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {dialogoDeSaida}
    </div>
  );
}
