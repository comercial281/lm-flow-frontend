// Card do lead em tela única (spec 2026-10-02-fase-4-card-do-lead) — a JANELA.
//
// Desde a E4 (07/10/2026) é casca: o estado e as ações moram em
// `features/cardDoLead/useCardDoLead`, e cada pedaço da tela é um bloco de
// `features/cardDoLead/blocos/` que a página "card completo" também usa. A
// janela não muda de cara (decisão 13 da spec do funil; a rede é o
// EditItemModal.caracterizacao.spec.tsx).
//
// Duas colunas: ESQUERDA fixa e sem rolagem (quem é, situação, atalhos,
// etiquetas, follow-up, Meta, Ganho | Perdido); DIREITA com as abas Detalhes ·
// Conversa · Tarefas · Visitas e propostas · Origem. Tudo grava na hora.
import { Suspense, useCallback, useEffect, useState, type ReactNode } from 'react';
import { CalendarCheck, ClipboardList, ListTodo, Megaphone, MessageSquare } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/ds';
import Abas from '@/components/base/Abas';
import type { Pipeline, PipelineItem, PipelineStage } from '@/types/analytics';
import { lazyWithRetry } from '@/utils/chunkReload';
import { rotuloDaAbaTarefas } from '@/features/tarefas/abaDoCard';
import { situacaoDe } from '@/features/pipelines/situacao/situacao';
import CapiConversionPanel from '@/components/capi/CapiConversionPanel';
import { useCardDoLead } from '@/features/cardDoLead/useCardDoLead';
import BlocoIdentidade from '@/features/cardDoLead/blocos/BlocoIdentidade';
import BlocoSituacao from '@/features/cardDoLead/blocos/BlocoSituacao';
import BlocoEtiquetas from '@/features/cardDoLead/blocos/BlocoEtiquetas';
import BlocoFollowup from '@/features/cardDoLead/blocos/BlocoFollowup';
import DialogosDoCard from '@/features/cardDoLead/blocos/DialogosDoCard';
import LeadQuickActions from './card/LeadQuickActions';
import LeadDetailsTab from './card/LeadDetailsTab';
import CardResultFooter from './card/CardResultFooter';
import CardMoreMenu from './card/CardMoreMenu';
import CardOriginTab from './card/CardOriginTab';

const CardConversationTab = lazyWithRetry(() => import('./CardConversationTab'));
const TarefasDoLead = lazyWithRetry(() => import('@/features/tarefas/TarefasDoLead'));
const VisitsProposalsTab = lazyWithRetry(() => import('./card/VisitsProposalsTab'));

interface EditItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: PipelineItem | null;
  stages: PipelineStage[];
  pipeline?: Pipeline | null;
  /**
   * Não é mais chamado: o card grava cada mudança na hora e não tem botão
   * Salvar. Fica opcional para quem ainda passa (quadro, conversa, contato).
   */
  onSubmit?: (data: never) => void;
  // Move otimista no board (sem reload) quando a etapa muda pelo card.
  onItemStageMoved?: (itemId: string, toStageId: string) => void;
  // Tag aplicada/removida grava na hora: avisa o quadro para o selo do card refletir.
  onLabelsChanged?: () => void;
  loading?: boolean;
  /** Faixa centralizada acima do card. De Contatos: as abinhas dos atendimentos. */
  cabecalho?: ReactNode;
  /** Card sem funil (aberto de Contatos): o contato entrou num funil pelo card. */
  onColocadoNoFunil?: () => void;
  /** Juntou com outro contato: o aberto pode ter sumido. */
  onContatoJuntado?: () => void;
  /** Ganho, Perdido ou Reabrir gravados: o quadro atualiza (ou tira) o card (Parte 3). */
  onItemStatusChanged?: (item: PipelineItem) => void;
}

export default function EditItemModal({
  open,
  onOpenChange,
  item,
  stages,
  onItemStageMoved,
  onLabelsChanged,
  cabecalho,
  onColocadoNoFunil,
  onContatoJuntado,
  onItemStatusChanged,
}: EditItemModalProps) {
  // `onItemStatusChanged` vai junto: escolher Concluído na Etapa marca Ganho (08/10).
  const card = useCardDoLead(item, { aberto: open, stages, onItemStageMoved, onLabelsChanged, onItemStatusChanged });

  // Situação (Parte 3): o rodapé gravou → o card da janela acompanha (selo,
  // Etapa travada, Histórico — tudo no hook) e o quadro atualiza ou tira o card da aba.
  const { aoMudar: aoMudarCard } = card.situacao;
  const aoMudarSituacao = useCallback((novo: PipelineItem) => {
    aoMudarCard(novo);
    onItemStatusChanged?.(novo);
  }, [aoMudarCard, onItemStatusChanged]);

  // A aba é da moldura (a página tem as dela): a janela abre sempre em Detalhes.
  const [activeTab, setActiveTab] = useState('overview');
  // O número da aba Tarefas (sessão de Tarefas, 08/10) também é da moldura.
  const [resumoTarefas, setResumoTarefas] = useState<{ abertas: number; atrasadas: number } | null>(null);
  useEffect(() => {
    if (open) { setActiveTab('overview'); setResumoTarefas(null); }
  }, [open, item?.id]);

  if (!item) return null;
  const contato = card.contato;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1280px] w-[96vw] h-[92vh] max-h-[92vh] p-0 gap-0 overflow-hidden flex flex-col">
        <DialogTitle className="sr-only">{card.nomeExibido}</DialogTitle>
        <DialogDescription className="sr-only">Card do lead</DialogDescription>

        {cabecalho && (
          <div className="flex shrink-0 justify-center border-b border-border px-12 py-2.5">{cabecalho}</div>
        )}

        <div className="flex-1 min-h-0 flex flex-col md:grid md:grid-cols-[380px_minmax(0,1fr)] overflow-y-auto md:overflow-hidden">
          {/* ESQUERDA — fixa, nunca rola (tem de caber em 1366×768) */}
          <aside className="flex flex-col gap-4 border-b md:border-b-0 md:border-r border-border p-5 md:min-h-0">
            <BlocoIdentidade
              card={card}
              acoes={
                <CardMoreMenu
                  item={item}
                  roletas={card.roleta.ligadas}
                  trocandoRoleta={card.roleta.mandando}
                  onTrocarRoleta={card.roleta.mandar}
                  onTirarDaRoleta={card.roleta.ofertasAbertas.length > 0 ? () => card.roleta.setTirando(true) : undefined}
                  onRemovido={() => onOpenChange(false)}
                  onJuntar={card.juntar.pode && contato?.id != null ? () => card.juntar.setJuntando(true) : undefined}
                />
              }
            />

            <BlocoSituacao card={card} onColocadoNoFunil={onColocadoNoFunil} />

            <LeadQuickActions
              item={item}
              nomeExibido={card.nomeExibido}
              abrindoConversa={card.conversa.abrindo}
              onAbrirConversa={() => card.conversa.abrir(item)}
              onVisitaCriada={card.historico.recarregar}
            />

            <BlocoEtiquetas card={card} />

            <BlocoFollowup card={card} />

            {!card.foraDoFunil && (
              <>
                <CapiConversionPanel key={situacaoDe(card.situacao.item)} contactId={contato?.id ?? null} pipelineItemId={item.id} variante="compacto" />

                {/* Rodapé fixo da coluna */}
                <div className="mt-auto pt-2 border-t border-border">
                  <CardResultFooter item={card.situacao.item ?? item} onMudou={aoMudarSituacao} bloqueado={card.etapa.movendo} onSalvando={card.situacao.setRodapeSalvando} />
                </div>
              </>
            )}
          </aside>

          {/* DIREITA — abas da casa (sublinhado com ícone), a faixa inteira no topo */}
          <section className="flex flex-col min-h-0 px-5 pt-3 pb-4">
            <Abas
              rotulo="Seções do card do lead"
              abas={[
                { chave: 'overview', rotulo: 'Detalhes', icone: ClipboardList },
                { chave: 'conversation', rotulo: 'Conversa', icone: MessageSquare },
                { chave: 'tasks', icone: ListTodo, ...rotuloDaAbaTarefas(resumoTarefas, item.tasks_info) },
                { chave: 'visits', rotulo: 'Visitas e propostas', icone: CalendarCheck },
                { chave: 'origin', rotulo: 'Origem', icone: Megaphone },
              ]}
              ativa={activeTab}
              aoTrocar={setActiveTab}
              className="shrink-0 pr-8"
            />

            <div className="flex-1 min-h-0 overflow-y-auto pt-4">
              {activeTab === 'overview' && (
                <LeadDetailsTab
                  item={item}
                  mostrarImoveis={card.recursos.imoveis}
                  mostrarObservacoes={card.recursos.notas}
                  historico={card.historico.eventos}
                  carregandoHistorico={card.historico.carregando}
                  onRecarregarHistorico={card.historico.recarregar}
                />
              )}

              {activeTab === 'conversation' && (
                <Suspense fallback={null}>
                  <CardConversationTab
                    item={item}
                    onAgendarEnvio={card.recursos.agendarEnvio && contato?.id != null ? texto => card.envio.setAgendando(texto) : undefined}
                  />
                </Suspense>
              )}

              {activeTab === 'tasks' && (
                card.foraDoFunil ? (
                  <p className="text-sm text-muted-foreground">Pra criar tarefa, coloque o lead no funil.</p>
                ) : (
                  <Suspense fallback={null}>
                    <TarefasDoLead pipelineItemIds={[String(item.id)]} criarNoCard={String(item.id)} aoContar={setResumoTarefas} />
                  </Suspense>
                )
              )}

              {activeTab === 'visits' && (
                <Suspense fallback={null}>
                  <VisitsProposalsTab item={item} nomeExibido={card.nomeExibido} />
                </Suspense>
              )}

              {activeTab === 'origin' && (
                <CardOriginTab
                  item={item}
                  manualOrigin={card.origemManual.texto}
                  onManualOriginChange={card.origemManual.setTexto}
                  savedManualOrigin={card.origemManual.salvo}
                  savingManualOrigin={card.origemManual.salvando}
                  onSaveManualOrigin={card.origemManual.salvar}
                />
              )}
            </div>
          </section>
        </div>
      </DialogContent>

      <DialogosDoCard
        card={card}
        onJuntado={() => {
          onOpenChange(false);
          onContatoJuntado?.();
        }}
      />
    </Dialog>
  );
}
