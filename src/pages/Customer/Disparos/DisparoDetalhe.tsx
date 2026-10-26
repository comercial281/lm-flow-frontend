// ── MONITORIA DE UM DISPARO (/disparos/:id) ──────────────────────────────────
//
// O gerente acompanha o disparo lead por lead: cabeçalho (estado, número de
// saída, o que sai, pacote, quem criou, previsão), os números do disparo inteiro
// e a fila paginada (50 por vez, "Carregar mais"), com filtro por estado.
//
// Os números vêm de `meta.counts` da fila, que o servidor conta sempre sobre o
// disparo inteiro (não sobre o filtro). O filtro manda UM estado: "Na fila" é só
// `pending` (quem está "Enviando" aparece em Todos e entra no número da fila);
// "Enviadas" é `sent`, que no servidor já inclui quem entrou no funil.
//
// Enquanto o disparo roda, a tela se atualiza a cada 20 s: relê o disparo e as
// páginas da fila que já estão na tela (assim a rolagem e o "Carregar mais" não
// se perdem). Uma atualização por vez; filtro novo ou "Carregar mais" no meio
// descarta a resposta velha.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Pagina, BaseHeader, EmptyState, Carregando, Aviso } from '@/components/base';
import BotoesDeEscolha from '@/components/base/BotoesDeEscolha';
import { Card, Button, Badge } from '@/components/ui/ds';
import NoAccessState from '@/components/permissions/NoAccessState';
import {
  broadcastsService,
  type BroadcastCampaign,
  type BroadcastItemRow,
  type BroadcastItemStatus,
} from '@/services/broadcasts/broadcastsService';
import { isForbiddenError } from '@/services/core/forbidden';
import { serverMessage } from '@/features/flowAutomations/guide';
import { useCan } from '@/hooks/useCan';
import { useConfirmacao } from '@/hooks/useConfirmacao';
import { capitalizar, dataHora, diaEHoraEmSaoPaulo, telefone, terminaPorVoltaDe } from '@/lib/formato';
import { STATUS_META, PACOTE, rotuloDoModo } from './rotulos';

const ATUALIZA_A_CADA_MS = 20_000;

type Filtro = 'todos' | 'pending' | 'sent' | 'failed' | 'skipped';
type Contagem = Partial<Record<string, number>>;
type Carga = 'carregando' | 'ok' | 'naoEncontrado' | 'recusado' | 'erro';

const voltar = (
  <Link to="/disparos" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
    Voltar aos Disparos
  </Link>
);

function naoEncontrado(e: unknown): boolean {
  return (e as { response?: { status?: number } } | null)?.response?.status === 404;
}

function paramsDaFila(filtro: Filtro, page: number): { status?: BroadcastItemStatus; page: number } {
  return filtro === 'todos' ? { page } : { status: filtro, page };
}

/** O estado do lead na fila, em rótulo de tela. */
function rotuloDoItem(
  item: Pick<BroadcastItemRow, 'status' | 'reason' | 'sent_at' | 'flow_paused'>,
  automacao = false,
): string {
  switch (item.status) {
    case 'pending': return 'Na fila';
    case 'sending': return 'Enviando';
    case 'sent': return item.sent_at ? `Enviada ${diaEHoraEmSaoPaulo(item.sent_at)}` : 'Enviada';
    case 'in_funnel':
      if (automacao) {
        if (item.flow_paused === 'other_number') return 'Entrou na automação, pausado: já conversa em outro número';
        return item.sent_at ? `Entrou na automação ${diaEHoraEmSaoPaulo(item.sent_at)}` : 'Entrou na automação';
      }
      return item.sent_at ? `Entrou no funil ${diaEHoraEmSaoPaulo(item.sent_at)}` : 'Entrou no funil';
    case 'failed': return item.reason ? `Falhou: ${item.reason}` : 'Falhou';
    case 'skipped': return item.reason ? `Ficou de fora: ${item.reason}` : 'Ficou de fora';
    case 'cancelled': return 'Cancelada';
    default: return '';
  }
}

const COR_DO_ITEM: Partial<Record<BroadcastItemStatus, string>> = {
  sent: 'text-blue-500',
  in_funnel: 'text-blue-500',
  failed: 'text-red-500',
  skipped: 'text-amber-600 dark:text-amber-400',
};

export default function DisparoDetalhe() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const pode = useCan();
  const { confirmar, dialogoDeConfirmacao } = useConfirmacao();

  const [carga, setCarga] = useState<Carga>('carregando');
  const [campanha, setCampanha] = useState<BroadcastCampaign | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [itens, setItens] = useState<BroadcastItemRow[]>([]);
  const [paginas, setPaginas] = useState(0);
  const [totalDoFiltro, setTotalDoFiltro] = useState(0);
  const [contagem, setContagem] = useState<Contagem>({});
  const [carregandoFila, setCarregandoFila] = useState(true);
  const [erroNaFila, setErroNaFila] = useState(false);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [acao, setAcao] = useState<'pause' | 'resume' | 'cancel' | null>(null);

  // Toda mudança na fila (filtro, carga, "Carregar mais") ganha uma vez nova;
  // resposta de uma vez antiga é descartada.
  const vezDaFila = useRef(0);
  // A resposta de Pausar/Retomar/Cancelar vale mais que uma leitura que saiu antes dela.
  const vezDoDisparo = useRef(0);
  const ocupado = useRef(false);
  const maisEmAndamento = useRef(false);
  const paginasRef = useRef(0);
  paginasRef.current = paginas;

  const carregarDisparo = useCallback(() => {
    setCarga('carregando');
    broadcastsService
      .get(id)
      .then(c => { setCampanha(c); setCarga('ok'); })
      .catch(e => {
        setCampanha(null);
        setCarga(isForbiddenError(e) ? 'recusado' : naoEncontrado(e) ? 'naoEncontrado' : 'erro');
      });
  }, [id]);

  // Primeira página do filtro (troca de filtro e carga da tela).
  const carregarFila = useCallback(() => {
    const vez = ++vezDaFila.current;
    setCarregandoFila(true);
    setErroNaFila(false);
    setItens([]);
    setPaginas(0);
    broadcastsService
      .items(id, paramsDaFila(filtro, 1))
      .then(r => {
        if (vez !== vezDaFila.current) return;
        setItens(r.data);
        setPaginas(1);
        setTotalDoFiltro(r.meta.total);
        setContagem(r.meta.counts ?? {});
      })
      .catch(() => { if (vez === vezDaFila.current) setErroNaFila(true); })
      .finally(() => { if (vez === vezDaFila.current) setCarregandoFila(false); });
  }, [id, filtro]);

  useEffect(() => { carregarDisparo(); }, [carregarDisparo]);
  useEffect(() => { carregarFila(); }, [carregarFila]);

  const carregarMais = () => {
    const vez = ++vezDaFila.current;
    const proxima = paginas + 1;
    maisEmAndamento.current = true;
    setCarregandoMais(true);
    broadcastsService
      .items(id, paramsDaFila(filtro, proxima))
      .then(r => {
        if (vez !== vezDaFila.current) return;
        setItens(atual => [...atual, ...r.data.filter(n => !atual.some(a => a.id === n.id))]);
        setPaginas(proxima);
        setTotalDoFiltro(r.meta.total);
        setContagem(r.meta.counts ?? {});
      })
      .catch(() => { if (vez === vezDaFila.current) toast.error('Não deu pra carregar mais. Tente de novo.'); })
      .finally(() => { maisEmAndamento.current = false; setCarregandoMais(false); });
  };

  // Relê as páginas da fila que já estão na tela, de uma vez só. Silenciosa:
  // falha de uma rodada não apaga a tela (a próxima tenta de novo).
  const releFila = useCallback(async (vez: number) => {
    const n = Math.max(1, paginasRef.current);
    const respostas = await Promise.all(
      Array.from({ length: n }, (_, i) => broadcastsService.items(id, paramsDaFila(filtro, i + 1))),
    );
    if (vez !== vezDaFila.current) return;
    const vistos = new Set<string>();
    setItens(respostas.flatMap(r => r.data).filter(item => !vistos.has(item.id) && Boolean(vistos.add(item.id))));
    setPaginas(n);
    setTotalDoFiltro(respostas[0].meta.total);
    setContagem(respostas[0].meta.counts ?? {});
    setErroNaFila(false);
    setCarregandoFila(false);
  }, [id, filtro]);

  // A rodada dos 20 s: o disparo e a fila. Pula se a anterior (ou um "Carregar
  // mais") ainda não voltou.
  const atualizar = useCallback(async () => {
    if (ocupado.current || maisEmAndamento.current) return;
    ocupado.current = true;
    const vezD = vezDoDisparo.current;
    try {
      const [c] = await Promise.all([broadcastsService.get(id), releFila(vezDaFila.current)]);
      if (c && vezD === vezDoDisparo.current) setCampanha(c);
    } catch {
      // Fica o que estava na tela.
    } finally {
      ocupado.current = false;
    }
  }, [id, releFila]);

  const rodando = campanha?.status === 'running';
  useEffect(() => {
    if (!rodando) return undefined;
    const t = setInterval(() => { void atualizar(); }, ATUALIZA_A_CADA_MS);
    return () => clearInterval(t);
  }, [rodando, atualizar]);

  const executar = async (qual: 'pause' | 'resume' | 'cancel') => {
    if (qual === 'cancel' && !(await confirmar({
      titulo: 'Cancelar este disparo?',
      descricao: 'Quem ainda está na fila não recebe.',
      rotuloDaAcao: 'Cancelar disparo',
      rotuloDeCancelar: 'Voltar',
      destrutivo: true,
    }))) return;
    setAcao(qual);
    try {
      const c = await broadcastsService[qual](id);
      vezDoDisparo.current += 1;
      if (c) setCampanha(c);
      // Cancelar tira quem esperava da fila: relê agora, passando por cima de uma rodada no ar.
      void releFila(++vezDaFila.current).catch(() => undefined);
    } catch (e) {
      const reserva = {
        pause: 'Não deu pra pausar o disparo. Tente de novo.',
        resume: 'Não deu pra retomar o disparo. Tente de novo.',
        cancel: 'Não deu pra cancelar o disparo. Tente de novo.',
      }[qual];
      toast.error(serverMessage(e, reserva));
    } finally {
      setAcao(null);
    }
  };

  if (carga === 'recusado') return <NoAccessState />;

  if (carga === 'carregando' && !campanha) {
    return (
      <Pagina acima={voltar} cabecalho={<BaseHeader title="Disparo" />}>
        <Carregando variante="texto" linhas={4} rotulo="Carregando o disparo..." />
      </Pagina>
    );
  }

  if (carga === 'naoEncontrado') {
    return (
      <Pagina acima={voltar} cabecalho={<BaseHeader title="Disparo" />}>
        <EmptyState
          title="Disparo não encontrado."
          description="Ele pode ter sido excluído, ou o endereço está errado."
          action={{ label: 'Voltar aos Disparos', onClick: () => navigate('/disparos') }}
        />
      </Pagina>
    );
  }

  if (!campanha) {
    return (
      <Pagina acima={voltar} cabecalho={<BaseHeader title="Disparo" />}>
        <EmptyState tipo="erro" aoTentarDeNovo={() => { carregarDisparo(); carregarFila(); }} />
      </Pagina>
    );
  }

  const automacao = campanha.mode === 'automation';
  const funil = campanha.mode === 'flow' || automacao;
  const oficial = campanha.mode === 'template' || campanha.channel_kind === 'whatsapp_cloud';
  const rotuloEnviadas = automacao ? 'Entraram na automação' : funil ? 'Entraram no funil' : 'Enviadas';
  const estado = STATUS_META[campanha.status] ?? STATUS_META.completed;
  const conta = (k: string) => contagem[k] ?? 0;

  const numeros = [
    { rotulo: 'Na fila', valor: conta('pending') + conta('sending'), cor: 'text-violet-400' },
    { rotulo: rotuloEnviadas, valor: conta('sent'), cor: 'text-blue-400' },
    { rotulo: 'Falhas', valor: conta('failed'), cor: 'text-red-400' },
    { rotulo: 'Ficaram de fora', valor: conta('skipped'), cor: 'text-amber-500' },
    ...(oficial
      ? [
          { rotulo: 'Entregues', valor: campanha.delivered_count ?? 0, cor: 'text-foreground' },
          { rotulo: 'Lidas', valor: campanha.read_count ?? 0, cor: 'text-foreground' },
          { rotulo: 'Respostas', valor: campanha.replied_count ?? 0, cor: 'text-foreground' },
        ]
      : []),
  ];

  const filtros: { valor: Filtro; rotulo: string }[] = [
    { valor: 'todos', rotulo: 'Todos' },
    { valor: 'pending', rotulo: 'Na fila' },
    { valor: 'sent', rotulo: rotuloEnviadas },
    { valor: 'failed', rotulo: 'Falhas' },
    { valor: 'skipped', rotulo: 'Ficaram de fora' },
  ];

  const podeParar = campanha.status === 'running' || campanha.status === 'paused';
  const botoes = (
    <div className="flex flex-wrap gap-2">
      {campanha.status === 'running' && pode('broadcasts', 'pause') && (
        <Button variant="outline" onClick={() => void executar('pause')} disabled={acao !== null}>Pausar</Button>
      )}
      {campanha.status === 'paused' && pode('broadcasts', 'resume') && (
        <Button onClick={() => void executar('resume')} disabled={acao !== null}>Retomar</Button>
      )}
      {podeParar && pode('broadcasts', 'cancel') && (
        <Button variant="outline" onClick={() => void executar('cancel')} disabled={acao !== null}>Cancelar</Button>
      )}
    </div>
  );

  const remetente = [campanha.sender_name, campanha.sender_phone ? telefone(campanha.sender_phone) : '']
    .filter(Boolean)
    .join(' ');
  const criado = campanha.created_by_name
    ? `Criado por ${campanha.created_by_name} em ${dataHora(campanha.created_at)}`
    : `Criado em ${dataHora(campanha.created_at)}`;
  const temMais = itens.length < totalDoFiltro;

  return (
    <Pagina
      acima={voltar}
      cabecalho={
        <BaseHeader
          title={campanha.name}
          aoLadoDoTitulo={<Badge className={`text-xs border ${estado.cls}`}>{estado.label}</Badge>}
          aDireita={botoes}
        />
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {remetente && <span>Sai por {remetente}</span>}
          <span>{rotuloDoModo(campanha)}</span>
          {campanha.pace && PACOTE[campanha.pace] && <span>Pacote {PACOTE[campanha.pace]}</span>}
          <span>{criado}</span>
          {rodando && campanha.estimated_finish_at && (
            <span>{capitalizar(terminaPorVoltaDe(campanha.estimated_finish_at))}</span>
          )}
        </div>

        {campanha.pause_message && <Aviso tom="atencao">{campanha.pause_message}</Aviso>}

        <ul aria-label="Números do disparo" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {numeros.map(n => (
            <li key={n.rotulo}>
              <Card className="gap-0 p-4">
                <p className="text-xs font-medium text-muted-foreground">{n.rotulo}</p>
                <p className={`text-2xl font-bold tracking-tight mt-1 ${n.cor}`}>{n.valor}</p>
              </Card>
            </li>
          ))}
        </ul>

        <BotoesDeEscolha<Filtro> rotulo="Mostrar na fila" valor={filtro} opcoes={filtros} aoEscolher={setFiltro} />

        {carregandoFila && itens.length === 0 ? (
          <Carregando variante="texto" linhas={4} rotulo="Carregando a fila..." />
        ) : erroNaFila && itens.length === 0 ? (
          <EmptyState tipo="erro" tamanho="compacto" aoTentarDeNovo={carregarFila} />
        ) : itens.length === 0 ? (
          <EmptyState
            tamanho="compacto"
            title={filtro === 'todos' ? 'Nenhum lead neste disparo.' : 'Nenhum lead nesse estado.'}
          />
        ) : (
          <>
            <Card className="gap-0 overflow-hidden py-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/30 text-left text-xs text-muted-foreground">
                      <th className="font-medium px-4 py-3">Lead</th>
                      <th className="font-medium px-4 py-3">Telefone</th>
                      <th className="font-medium px-4 py-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itens.map(item => {
                      const conversa = item.conversation_id ? `/conversations/${item.conversation_id}` : null;
                      const nome = item.lead_name || 'Sem nome';
                      return (
                        <tr
                          key={item.id}
                          onClick={conversa ? () => navigate(conversa) : undefined}
                          className={`border-t border-border/60 ${conversa ? 'hover:bg-muted/20 transition-colors cursor-pointer' : ''}`}
                        >
                          <td className="px-4 py-3 font-medium max-w-[240px]">
                            {conversa ? (
                              // O link é o ponto de teclado (e do ctrl+clique); o resto da linha também abre.
                              <Link
                                to={conversa}
                                onClick={e => e.stopPropagation()}
                                className="block max-w-full truncate hover:underline focus-visible:underline outline-none"
                                title={nome}
                              >
                                {nome}
                              </Link>
                            ) : (
                              <span className="block max-w-full truncate" title={nome}>{nome}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">{item.phone ? telefone(item.phone) : ''}</td>
                          <td className={`px-4 py-3 ${COR_DO_ITEM[item.status] ?? ''}`}>{rotuloDoItem(item, automacao)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            {temMais && (
              <div className="flex justify-center">
                <Button variant="outline" onClick={carregarMais} disabled={carregandoMais}>
                  {carregandoMais ? 'Carregando...' : 'Carregar mais'}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
      {dialogoDeConfirmacao}
    </Pagina>
  );
}
