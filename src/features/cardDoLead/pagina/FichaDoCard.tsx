// Aba Ficha da página do card (spec do funil §5.3): os MESMOS blocos da
// janela, em diagramação maior. Esquerda, nesta ordem: Ações rápidas (com a
// linha da Meta), Próximas tarefas, Sobre o negócio, Etiquetas, Follow-up, o
// que a IA entendeu, Imóveis de interesse, Respostas do formulário, Outras
// informações. Direita: Histórico.
//
// 11/10/2026 (escolha do dono): os dados da pessoa subiram pro cartão do topo
// (CardDoLeadHeader) e a Meta saiu da caixa do Follow-up pra Ações rápidas,
// onde o corretor já age: Venda e Desqualificado vão sozinhos com Ganho e
// Perdido, mas o Qualificado só vai se alguém apertar.
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
import { AvisosDaRoleta } from '../blocos/BlocoSituacao';
import BlocoSobreONegocio, { type CamposDoNegocio } from '../blocos/BlocoSobreONegocio';
import BlocoPausaDeNumero from '../blocos/BlocoPausaDeNumero';
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
          {/* Ganho/Perdido mandam Compra/Desqualificado à Meta no servidor: a chave
              pela situação remonta o painel, que relê e mostra "enviado" (como a janela).
              No celular o painel não aparece (Raio-X do celular, 10/10/2026). */}
          <CapiConversionPanel
            key={situacaoDe(card.situacao.item ?? item)}
            variante="compacto"
            contactId={contato?.id ?? null}
            pipelineItemId={item.id}
            className="border-t border-dashed border-border pt-3"
          />
        </CaixaDoCard>

        {Tarefas && (
          <CaixaDoCard titulo="Próximas tarefas">
            <Tarefas item={item} />
          </CaixaDoCard>
        )}

        {/* "veio pela Roleta X" já está no topo: aqui só a oferta e o sorteio. */}
        <AvisosDaRoleta card={card} semDeOnde />

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

        <BlocoPausaDeNumero
          contactId={contato?.id != null ? String(contato.id) : null}
          conversationId={conversaDoCard(item)}
          aoResolver={card.historico.recarregar}
        />

        <CaixaDoCard titulo="Follow-up">
          <FollowupTimeline
            contactId={contato?.id != null ? String(contato.id) : null}
            conversationId={conversaDoCard(item)}
            pipelineItemId={item.id ? String(item.id) : null}
            aoColocar={card.etapa.aoColocarEmFollowup}
          />
        </CaixaDoCard>

        <BlocoOQueAIAEntendeu item={item} />
        {card.recursos.imoveis && <BlocoImoveisDeInteresse item={item} nomeExibido={card.nomeExibido} onVisitaCriada={card.historico.recarregar} />}
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
