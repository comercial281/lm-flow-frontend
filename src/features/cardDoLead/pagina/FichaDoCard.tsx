// Aba Ficha da página do card (spec do funil §5.3): os MESMOS blocos da
// janela, em diagramação maior. Esquerda, nesta ordem: Ações rápidas,
// Próximas tarefas, Dados da pessoa, Sobre o negócio, Etiquetas,
// Follow-up e Meta, o que a IA entendeu, Imóveis de interesse, Respostas do
// formulário, Outras informações. Direita: Histórico.
//
// Documentos, Seguidor e E-mail do atendimento entram depois como mais blocos
// no fim da esquerda (decisão 14), sem mexer no resto.
import LeadQuickActions from '@/components/pipelines/card/LeadQuickActions';
import FollowupTimeline from '@/components/pipelines/FollowupTimeline';
import CapiConversionPanel from '@/components/capi/CapiConversionPanel';
import OutrasInformacoes from '@/components/pipelines/card/OutrasInformacoes';
import { situacaoDe } from '@/features/pipelines/situacao/situacao';
import type { PipelineItem } from '@/types/analytics';
import { conversaDoCard } from '../cardDoLead';
import type { CardDoLead } from '../useCardDoLead';
import CaixaDoCard from '../blocos/CaixaDoCard';
import BlocoIdentidade from '../blocos/BlocoIdentidade';
import { AvisosDaRoleta } from '../blocos/BlocoSituacao';
import BlocoSobreONegocio, { type CamposDoNegocio } from '../blocos/BlocoSobreONegocio';
import BlocoEtiquetas from '../blocos/BlocoEtiquetas';
import BlocoOQueAIAEntendeu from '../blocos/BlocoOQueAIAEntendeu';
import BlocoImoveisDeInteresse from '../blocos/BlocoImoveisDeInteresse';
import BlocoRespostasDoFormulario from '../blocos/BlocoRespostasDoFormulario';
import ColunaDoHistorico from './ColunaDoHistorico';
import { BlocoDeTarefas, type BlocoDoCard } from './encaixes';

interface FichaDoCardProps {
  card: CardDoLead;
  item: PipelineItem;
  aoMudarNegocio: (campos: CamposDoNegocio) => void;
  /** Nome do funil do card (vai para a coluna do Histórico). */
  funilAtual?: string | null;
  /** Bloco das tarefas. Padrão: o de encaixes.tsx; null = nada no lugar. */
  blocoDeTarefas?: BlocoDoCard | null;
}

export default function FichaDoCard({
  card,
  item,
  aoMudarNegocio,
  funilAtual = null,
  blocoDeTarefas = BlocoDeTarefas,
}: FichaDoCardProps) {
  const Tarefas = blocoDeTarefas;
  const contato = card.contato;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-4">
        <CaixaDoCard titulo="Ações rápidas">
          <LeadQuickActions
            item={item}
            nomeExibido={card.nomeExibido}
            abrindoConversa={card.conversa.abrindo}
            onAbrirConversa={() => card.conversa.abrir(item)}
            onVisitaCriada={card.historico.recarregar}
          />
        </CaixaDoCard>

        {Tarefas && (
          <CaixaDoCard titulo="Próximas tarefas">
            <Tarefas item={item} />
          </CaixaDoCard>
        )}

        <BlocoIdentidade card={card} variante="pagina" />
        <AvisosDaRoleta card={card} />

        <BlocoSobreONegocio
          pipelineId={item.pipeline_id}
          itemId={item.id}
          preco={item.estimated_value}
          data={item.expected_close_on}
          aoSalvar={aoMudarNegocio}
        />

        <CaixaDoCard titulo="Etiquetas">
          <BlocoEtiquetas card={card} />
        </CaixaDoCard>

        <CaixaDoCard titulo="Follow-up e Meta">
          <FollowupTimeline
            contactId={contato?.id != null ? String(contato.id) : null}
            conversationId={conversaDoCard(item)}
            leadName={contato?.name ?? null}
          />
          {/* Ganho/Perdido mandam Compra/Desqualificado à Meta no servidor: a chave
              pela situação remonta o painel, que relê e mostra "enviado" (como a janela). */}
          <CapiConversionPanel
            key={situacaoDe(card.situacao.item ?? item)}
            contactId={contato?.id ?? null}
            pipelineItemId={item.id}
          />
        </CaixaDoCard>

        <BlocoOQueAIAEntendeu item={item} />
        {card.recursos.imoveis && <BlocoImoveisDeInteresse item={item} />}
        <BlocoRespostasDoFormulario item={item} />
        {contato?.id != null && (
          <OutrasInformacoes
            contactId={String(contato.id)}
            atributos={contato.custom_attributes as Record<string, unknown> | null | undefined}
          />
        )}
      </div>

      <ColunaDoHistorico card={card} funilAtual={funilAtual} />
    </div>
  );
}
