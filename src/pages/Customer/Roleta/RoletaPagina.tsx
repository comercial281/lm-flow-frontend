import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Copy, Loader2, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
} from '@/components/ui/ds';
import Abas from '@/components/base/Abas';
import Chave from '@/components/base/Chave';
import EmptyState from '@/components/base/EmptyState';
import IconActionButton from '@/components/base/IconActionButton';
import { Secao, Secoes } from '@/components/base/Secao';
import { useCan } from '@/hooks/useCan';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { useGuardaDeSaida } from '@/hooks/useAlteracoesNaoSalvas';
import { usePodeSair } from './usePodeSair';
import {
  mensagemDoServidor,
  roletaConfigService,
  roletaLabel,
  type RoletaConfig,
  type RoletaOrigin,
} from '@/services/roletaConfig/roletaConfigService';
import { ativosNaFila, faltaParaLigar } from './roletaNovaTextos';
import { ENDERECO_DA_LISTA, ENDERECO_DA_ROLETA } from './enderecos';
import OrigensBloco from './blocos/OrigensBloco';
import FilaBloco from './blocos/FilaBloco';
import HorarioBloco from './blocos/HorarioBloco';
import HistoricoLista from './HistoricoLista';

// ── PÁGINA DA ROLETA (a roleta nova, a única desde 06/10/2026) ──────────────
//
// Cabeçalho: ← Roleta de leads · nome (editável no lugar) · chave Ligada ·
// Duplicar · ⋯ Excluir. Abas Como funciona · Histórico (`?aba=historico`).
// "Como funciona" são três blocos com respiro: de onde vem o lead, a fila e
// quando funciona. Tudo de lista vale na hora; os campos de texto e o horário
// esperam o Salvar (regra da casa: chave = já valeu, campo espera o Salvar).
//
// A chave só liga com ≥ 1 origem e ≥ 1 corretor ativo; travada, diz o que falta.
// O servidor confere de novo e recusa com a mesma frase.

function NomeEditavel({ roleta, aoMudar }: { roleta: RoletaConfig; aoMudar: (r: RoletaConfig) => void }) {
  const nome = roletaLabel(roleta);
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(nome);
  const [salvando, setSalvando] = useState(false);
  // Enter grava e o blur que vem em seguida não pode gravar de novo.
  const fechado = useRef(false);

  const abrir = () => { setValor(nome); fechado.current = false; setEditando(true); };

  const gravar = async () => {
    if (fechado.current) return;
    fechado.current = true;
    const limpo = valor.trim();
    if (!limpo || limpo === nome) { setEditando(false); return; }
    setSalvando(true);
    try {
      aoMudar(await roletaConfigService.update(roleta.id, { name: limpo }));
      toast.success('Nome salvo');
      setEditando(false);
    } catch (e) {
      fechado.current = false;
      toast.error(mensagemDoServidor(e) ?? 'Não deu pra salvar o nome. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  };

  if (!editando) {
    return (
      <div className="flex min-w-0 items-center gap-1">
        <h1 className="truncate text-2xl font-bold tracking-tight">{nome}</h1>
        <IconActionButton label="Mudar o nome" variant="ghost" onClick={abrir} icon={<Pencil className="h-4 w-4" />} />
      </div>
    );
  }
  return (
    <Input
      aria-label="Nome da roleta"
      autoFocus
      value={valor}
      disabled={salvando}
      onChange={e => setValor(e.target.value)}
      onBlur={() => void gravar()}
      onKeyDown={e => {
        if (e.key === 'Enter') { e.preventDefault(); void gravar(); }
        if (e.key === 'Escape') { fechado.current = true; setEditando(false); }
      }}
      className="h-11 max-w-md text-xl font-bold md:text-xl"
    />
  );
}

export default function RoletaPagina() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const can = useCan();
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();
  // Rascunho do horário não some calado: aba, voltar e Duplicar perguntam antes.
  const { aoClicar: guardaDoLink, dialogoDeConfirmacao: dialogoDaGuarda } = useGuardaDeSaida();
  const { podeSair, dialogoDeSaida } = usePodeSair();
  const [params, setParams] = useSearchParams();
  const aba = params.get('aba') === 'historico' ? 'historico' : 'como';

  const [roleta, setRoleta] = useState<RoletaConfig | null>(null);
  const [origens, setOrigens] = useState<RoletaOrigin[]>([]);
  const [erro, setErro] = useState(false);
  const [duplicando, setDuplicando] = useState(false);

  const carregar = useCallback(async () => {
    setErro(false);
    setRoleta(null);
    try {
      const [r, o] = await Promise.all([roletaConfigService.get(id), roletaConfigService.getOrigins(id)]);
      setRoleta(r);
      setOrigens(o);
    } catch {
      setErro(true);
    }
  }, [id]);

  useEffect(() => { void carregar(); }, [carregar]);

  const recarregarOrigens = useCallback(async () => {
    setOrigens(await roletaConfigService.getOrigins(id));
  }, [id]);

  const trocarAba = async (chave: string) => {
    if (chave === aba || !(await podeSair())) return;
    setParams(antes => {
      const novos = new URLSearchParams(antes);
      if (chave === 'historico') novos.set('aba', 'historico'); else novos.delete('aba');
      return novos;
    }, { replace: true });
  };

  if (erro) {
    return (
      <div className="px-4 py-6 sm:px-6">
        <EmptyState tipo="erro" aoTentarDeNovo={carregar} />
      </div>
    );
  }
  if (!roleta) {
    return (
      <div className="flex justify-center py-16 text-muted-foreground" role="status" aria-label="Carregando a roleta">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
      </div>
    );
  }

  const falta = faltaParaLigar(origens.length, ativosNaFila(roleta));
  const travada = !roleta.is_active && !!falta;

  // Erro sobe pra Chave: ela volta sozinha e diz por quê (403 = frase do
  // cargo; 422 = a frase do servidor, ex.: "Falta: uma origem").
  const ligar = async (proximo: boolean) => {
    setRoleta(await roletaConfigService.update(roleta.id, { is_active: proximo }));
  };

  const duplicar = async () => {
    if (duplicando || !(await podeSair())) return;
    setDuplicando(true);
    try {
      const copia = await roletaConfigService.duplicate(roleta.id);
      toast.success(`Cópia criada: ${roletaLabel(copia)}`);
      navigate(ENDERECO_DA_ROLETA(copia.id));
    } catch (e) {
      toast.error(mensagemDoServidor(e) ?? 'Não deu pra duplicar. Tente de novo.');
    } finally {
      setDuplicando(false);
    }
  };

  const excluir = async () => {
    const ok = await confirmar({
      titulo: `Excluir a roleta ${roletaLabel(roleta)}?`,
      descricao: 'As origens dela ficam sem roleta e os leads novos delas entram sem responsável. Quem já aceitou um lead continua com ele.',
      rotuloDaAcao: 'Excluir',
      destrutivo: true,
    });
    if (!ok) return;
    try {
      await roletaConfigService.destroy(roleta.id);
      toast.success('Roleta excluída');
      navigate(ENDERECO_DA_LISTA);
    } catch (e) {
      toast.error(mensagemDoServidor(e) ?? 'Não deu pra excluir. Tente de novo.');
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto w-full max-w-[1400px] space-y-6">
          <Link to={ENDERECO_DA_LISTA} onClickCapture={guardaDoLink} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Roleta de leads
          </Link>

          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0 flex-1">
              <NomeEditavel roleta={roleta} aoMudar={setRoleta} />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-col items-end">
                <Chave
                  rotulo="Ligar a roleta"
                  semRotuloVisivel
                  genero="a"
                  ligada={roleta.is_active}
                  desabilitada={travada}
                  aoMudar={ligar}
                />
                {travada && <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">{falta}</p>}
              </div>
              {can('roleta_configs', 'create') && (
                <Button type="button" variant="outline" onClick={() => void duplicar()} disabled={duplicando}>
                  <Copy className="mr-1 h-4 w-4" aria-hidden="true" /> {duplicando ? 'Duplicando…' : 'Duplicar'}
                </Button>
              )}
              {can('roleta_configs', 'destroy') && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" size="icon" variant="ghost" aria-label="Mais ações da roleta" title="Mais ações da roleta">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => void excluir()} className="text-destructive">
                      <Trash2 className="mr-2 h-4 w-4" /> Excluir roleta
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          <Abas
            rotulo={`Abas da roleta ${roletaLabel(roleta)}`}
            ativa={aba}
            aoTrocar={c => void trocarAba(c)}
            abas={[
              { chave: 'como', rotulo: 'Como funciona' },
              { chave: 'historico', rotulo: 'Histórico' },
            ]}
          />

          {aba === 'historico' ? (
            <HistoricoLista roletaId={roleta.id} />
          ) : (
            <Secoes>
              <Secao
                titulo="De onde vem o lead"
                descricao="Os leads que chegam destas origens entram nesta roleta. Cada origem fica numa roleta só."
              >
                <OrigensBloco roletaId={roleta.id} origens={origens} recarregar={recarregarOrigens} />
              </Secao>
              <Secao
                titulo="Fila"
                descricao="Cada lead é oferecido a um corretor, nesta ordem. Quem não aceita no prazo passa a vez. Pausado fica na lista, mas é pulado."
              >
                <FilaBloco roleta={roleta} aoMudar={setRoleta} />
              </Secao>
              <Secao
                titulo="Quando funciona"
                descricao="Fora do horário, o lead espera e é oferecido quando abrir."
              >
                <HorarioBloco roleta={roleta} aoMudar={setRoleta} />
              </Secao>
            </Secoes>
          )}
        </div>
      </div>
      {dialogoDeConfirmacao}
      {dialogoDaGuarda}
      {dialogoDeSaida}
    </div>
  );
}
