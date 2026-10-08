// src/pages/Customer/Pipelines/CardCompleto/CardCompletoPage.tsx
// Card completo (E4, spec do funil 2026-10-07 §5): a página do lead, em outra
// guia, com endereço próprio para copiar e mandar. Os MESMOS blocos da janela
// do quadro (features/cardDoLead), em diagramação maior. Abre com o menu
// lateral (GRUPO A das rotas, decisão 15).
//
// Moldura da casa (Pagina, padrão de telas 07/10) no esqueleto de tela de
// detalhe da Roleta: "← Funil <nome>" em cima e o nome do lead como título
// (BaseHeader, com a barrinha), o selo da situação ao lado e, à direita,
// Responsável, Ganho | Perdido (ou Reabrir) e o ⋯.
//
// Card fechado ou arquivado continua mexível: "Sobre o negócio" e criar tarefa
// seguem disponíveis (checklist f3-06: agir no arquivado sem desarquivar).
import { Suspense, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArchiveRestore, ArrowLeft, CalendarCheck, ClipboardList, Megaphone, MessageSquare, ShieldX } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Skeleton } from '@/components/ui/ds';
import Abas from '@/components/base/Abas';
import BaseHeader from '@/components/base/BaseHeader';
import EmptyState from '@/components/base/EmptyState';
import Pagina from '@/components/base/Pagina';
import { lazyWithRetry } from '@/utils/chunkReload';
import CardResultFooter from '@/components/pipelines/card/CardResultFooter';
import CardMoreMenu from '@/components/pipelines/card/CardMoreMenu';
import CardOriginTab from '@/components/pipelines/card/CardOriginTab';
import SeloSituacao from '@/features/pipelines/situacao/SeloSituacao';
import { comSituacaoNova, detalheDaSituacao, mensagemDaRecusa, situacaoDe } from '@/features/pipelines/situacao/situacao';
import { linkDoCardCompleto } from '@/features/pipelines/linkDoCard';
import { useCardDoLead } from '@/features/cardDoLead/useCardDoLead';
import { useCardCompleto } from '@/features/cardDoLead/pagina/useCardCompleto';
import { SEM_ACESSO_AO_CARD } from '@/features/cardDoLead/buscarCard';
import FaixaDeEtapas from '@/features/cardDoLead/pagina/FaixaDeEtapas';
import FichaDoCard from '@/features/cardDoLead/pagina/FichaDoCard';
import { ResponsavelComFoto } from '@/features/cardDoLead/blocos/BlocoSituacao';
import DialogosDoCard from '@/features/cardDoLead/blocos/DialogosDoCard';
import { pipelinesService } from '@/services/pipelines/pipelinesService';
import type { PipelineItem, PipelineItemDetail } from '@/types/analytics';

const CardConversationTab = lazyWithRetry(() => import('@/components/pipelines/CardConversationTab'));
const VisitsProposalsTab = lazyWithRetry(() => import('@/components/pipelines/card/VisitsProposalsTab'));

// Um nível de abas (regra da casa): os separadores do Histórico são filtros, não
// abas. Sem aba Tarefas: as tarefas são um bloco da Ficha.
const ABAS = [
  { chave: 'ficha', rotulo: 'Ficha', icone: ClipboardList },
  { chave: 'conversa', rotulo: 'Conversa', icone: MessageSquare },
  { chave: 'visitas', rotulo: 'Visitas e propostas', icone: CalendarCheck },
  { chave: 'origem', rotulo: 'Origem', icone: Megaphone },
];
const CHAVES_DAS_ABAS = new Set(ABAS.map(a => a.chave));

// O quadro do funil (o "← Funil <nome>" e o "Voltar ao funil").
const enderecoDoFunil = (pipelineId: string): string => `/pipelines/${encodeURIComponent(pipelineId)}`;

function Carregando() {
  return (
    <div role="status" aria-label="Carregando o card" className="space-y-6">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-16 w-full" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
        <Skeleton className="h-96 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    </div>
  );
}

function SemAcesso({ pipelineId }: { pipelineId?: string }) {
  return (
    <div role="status" className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-center">
      <ShieldX className="h-8 w-8 text-muted-foreground" aria-hidden />
      <p className="text-base font-semibold">{SEM_ACESSO_AO_CARD}</p>
      <p className="max-w-md text-sm text-muted-foreground">
        Ele pode ter saído do funil ou ser atendido por outra pessoa.
      </p>
      {pipelineId && (
        <Button asChild variant="outline">
          <Link to={enderecoDoFunil(pipelineId)}>Voltar ao funil</Link>
        </Button>
      )}
    </div>
  );
}

export default function CardCompletoPage() {
  const { pipelineId, itemId } = useParams<{ pipelineId: string; itemId: string }>();
  const { estado, tentarDeNovo, recarregar, atualizarItem } = useCardCompleto(pipelineId, itemId);

  if (estado.estado === 'pronto') {
    return (
      <ConteudoDoCard
        key={estado.dados.item.id}
        dados={estado.dados}
        recarregar={recarregar}
        atualizarItem={atualizarItem}
      />
    );
  }

  // Erro: além do "Tentar de novo", a volta ao funil (o sem-acesso tem a dele no meio).
  const voltaNoErro = estado.estado === 'erro' && pipelineId ? (
    <Link
      to={enderecoDoFunil(pipelineId)}
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Voltar ao funil
    </Link>
  ) : undefined;

  return (
    <Pagina acima={voltaNoErro}>
      {estado.estado === 'carregando' && <Carregando />}
      {estado.estado === 'sem-acesso' && <SemAcesso pipelineId={pipelineId} />}
      {estado.estado === 'erro' && <EmptyState tipo="erro" aoTentarDeNovo={() => void tentarDeNovo()} />}
    </Pagina>
  );
}

function ConteudoDoCard({ dados, recarregar, atualizarItem }: {
  dados: PipelineItemDetail;
  recarregar: () => Promise<void>;
  atualizarItem: (campos: Partial<PipelineItem>) => void;
}) {
  const { item, pipeline, stage_durations: duracoes } = dados;
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const pedida = params.get('aba') ?? '';
  const aba = CHAVES_DAS_ABAS.has(pedida) ? pedida : 'ficha';
  const trocarAba = (chave: string) => {
    const p = new URLSearchParams(params);
    if (chave === 'ficha') p.delete('aba');
    else p.set('aba', chave);
    setParams(p, { replace: true });
  };

  // A faixa recebe as etapas JÁ em ordem de posição (o servidor não garante a ordem).
  const etapas = useMemo(
    () => [...pipeline.stages].sort((a, b) => a.position - b.position),
    [pipeline.stages],
  );
  const card = useCardDoLead(item, {
    aberto: true,
    stages: etapas,
    // Mudou de etapa: os dias por etapa vêm de novo do servidor.
    onItemStageMoved: () => { void recarregar(); },
    // A Etapa escolhida foi Concluído e marcou Ganho (08/10): a página vem de novo.
    onItemStatusChanged: () => { void recarregar(); },
  });

  // Ganho/Perdido/Reabrir gravado (rodapé ou faixa): o card acompanha pelo hook
  // (selo, Etapa, Histórico — o hook já recarrega o Histórico) e a página vem de
  // novo do servidor (dias por etapa). Mesmo papel do onItemStatusChanged da janela.
  const aoMudarSituacao = (novo: PipelineItem) => {
    card.situacao.aoMudar(novo);
    void recarregar();
  };

  // Trinco contra clique duplo: a faixa só desliga quando o `movendo` liga,
  // e entre um clique e o outro ainda não houve render.
  const mexendoNaEtapa = useRef(false);
  const [ganhando, setGanhando] = useState(false);
  const moverPelaFaixa = async (stageId: string) => {
    if (mexendoNaEtapa.current) return;
    mexendoNaEtapa.current = true;
    try {
      await card.etapa.mover(stageId);
    } finally {
      mexendoNaEtapa.current = false;
    }
  };
  // Concluído na faixa é Ganho (ajuste de 08/10): a mesma rota do botão; o
  // servidor leva o card para lá.
  const ganharPelaFaixa = async () => {
    if (mexendoNaEtapa.current) return;
    mexendoNaEtapa.current = true;
    setGanhando(true);
    try {
      const ganho = await pipelinesService.setItemStatus(item.pipeline_id, item.id, { status: 'won' });
      toast.success('Lead marcado como ganho.');
      aoMudarSituacao(comSituacaoNova(card.situacao.item ?? item, ganho));
    } catch (erro) {
      toast.error(mensagemDaRecusa(erro, 'Não consegui marcar o lead como ganho.'));
    } finally {
      mexendoNaEtapa.current = false;
      setGanhando(false);
    }
  };

  const arquivado = !!item.archived_at;
  const mexendoNoArquivoRef = useRef(false);
  const [mexendoNoArquivo, setMexendoNoArquivo] = useState(false);
  const alternarArquivo = async () => {
    if (mexendoNoArquivoRef.current) return;
    mexendoNoArquivoRef.current = true;
    setMexendoNoArquivo(true);
    try {
      if (arquivado) {
        await pipelinesService.unarchiveItem(item.pipeline_id, item.id);
        toast.success('Lead desarquivado');
      } else {
        await pipelinesService.archiveItem(item.pipeline_id, item.id);
        toast.success('Lead arquivado');
      }
      await recarregar();
      // O card volta com o mesmo id e a mesma situação: a chave do Histórico não
      // mudaria sozinha, e a linha "Arquivado/Desarquivado" só viria com F5.
      card.historico.recarregar();
    } catch {
      toast.error(arquivado ? 'Não consegui desarquivar o lead.' : 'Não consegui arquivar o lead.');
    } finally {
      mexendoNoArquivoRef.current = false;
      setMexendoNoArquivo(false);
    }
  };

  const voltarAoFunil = () => navigate(enderecoDoFunil(pipeline.id));
  const contato = card.contato;
  // A situação mais nova (a resposta do servidor por cima do que veio).
  const itemDaSituacao = card.situacao.item ?? item;

  return (
    <Pagina
      acima={
        <Link
          to={enderecoDoFunil(pipeline.id)}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Funil {pipeline.name}
        </Link>
      }
      cabecalho={
        <BaseHeader
          title={card.nomeExibido}
          // Selo da situação (Parte 3): nada em "open"; data e motivo ao passar o mouse.
          aoLadoDoTitulo={<SeloSituacao status={situacaoDe(itemDaSituacao)} detalhe={detalheDaSituacao(itemDaSituacao)} />}
          aDireita={
            <div className="flex flex-wrap items-end gap-3">
              {(item.conversation?.id || contato?.id) && (
                <div className="w-56">
                  <ResponsavelComFoto card={card} />
                </div>
              )}
              <div className="w-56">
                {/* Ganho | Perdido ou Reabrir (Parte 3), com a trava cruzada da Etapa (P3-T5). */}
                <CardResultFooter
                  item={itemDaSituacao}
                  onMudou={aoMudarSituacao}
                  bloqueado={card.etapa.movendo || ganhando}
                  onSalvando={card.situacao.setRodapeSalvando}
                />
              </div>
              <CardMoreMenu
                item={item}
                roletas={card.roleta.ligadas}
                trocandoRoleta={card.roleta.mandando}
                onTrocarRoleta={card.roleta.mandar}
                onTirarDaRoleta={card.roleta.ofertasAbertas.length > 0 ? () => card.roleta.setTirando(true) : undefined}
                onRemovido={voltarAoFunil}
                onJuntar={card.juntar.pode && contato?.id != null ? () => card.juntar.setJuntando(true) : undefined}
                linkDoCard={linkDoCardCompleto(pipeline.id, item.id)}
                onArquivar={arquivado ? undefined : () => void alternarArquivo()}
                onDesarquivar={arquivado ? () => void alternarArquivo() : undefined}
              />
            </div>
          }
        />
      }
    >
      {arquivado && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
          <span>Este lead está arquivado: ele não aparece no quadro do funil.</span>
          <Button variant="outline" size="sm" onClick={() => void alternarArquivo()} disabled={mexendoNoArquivo}>
            <ArchiveRestore className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Desarquivar
          </Button>
        </div>
      )}

      <FaixaDeEtapas
        etapas={etapas}
        etapaAtualId={card.etapa.id ?? item.stage_id}
        duracoes={duracoes}
        fechado={card.situacao.fechado}
        nomeDoLead={card.nomeExibido}
        movendo={card.etapa.movendo || ganhando || card.situacao.rodapeSalvando}
        aoMover={moverPelaFaixa}
        aoGanhar={ganharPelaFaixa}
      />

      <Abas rotulo="Seções do card completo" abas={ABAS} ativa={aba} aoTrocar={trocarAba} />

      {aba === 'ficha' && (
        <FichaDoCard card={card} item={item} aoMudarNegocio={atualizarItem} funilAtual={pipeline.name} />
      )}

      {aba === 'conversa' && (
        <Suspense fallback={null}>
          <CardConversationTab
            item={item}
            onAgendarEnvio={card.recursos.agendarEnvio && contato?.id != null ? texto => card.envio.setAgendando(texto) : undefined}
          />
        </Suspense>
      )}

      {aba === 'visitas' && (
        <Suspense fallback={null}>
          <VisitsProposalsTab item={item} nomeExibido={card.nomeExibido} />
        </Suspense>
      )}

      {aba === 'origem' && (
        <CardOriginTab
          item={item}
          manualOrigin={card.origemManual.texto}
          onManualOriginChange={card.origemManual.setTexto}
          savedManualOrigin={card.origemManual.salvo}
          savingManualOrigin={card.origemManual.salvando}
          onSaveManualOrigin={card.origemManual.salvar}
        />
      )}

      <DialogosDoCard card={card} onJuntado={voltarAoFunil} />
    </Pagina>
  );
}
