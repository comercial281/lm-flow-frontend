// Aba Detalhes do card do lead (Hierarquia das janelas, 2b.5):
//   linha de cima — três caixas da mesma altura, cada uma rola por dentro:
//     Sobre o lead (o que a IA entendeu + respostas do formulário + outras informações),
//     Histórico e Observações;
//   embaixo — Imóveis de interesse, na largura toda.
// Histórico e Observações NÃO se juntam na janela: um o sistema escreve sozinho,
// o outro é o comentário que o corretor escolheu deixar (decisão do dono, 02/10).
// O Histórico é o novo (E5 do funil, 07/10), em modo compacto, e o título
// "Histórico" é o da caixa (semTitulo). Os pedaços são os blocos de
// features/cardDoLead/blocos (E4); a página do card usa os mesmos, sem caixa da janela.
import type { PipelineItem } from '@/types/analytics';
import { cn } from '@/lib/utils';
import { CaixaDaJanela } from '@/components/base/janela';
import { contatoDoCard } from '@/features/cardDoLead/cardDoLead';
import BlocoOQueAIAEntendeu from '@/features/cardDoLead/blocos/BlocoOQueAIAEntendeu';
import BlocoRespostasDoFormulario from '@/features/cardDoLead/blocos/BlocoRespostasDoFormulario';
import BlocoImoveisDeInteresse from '@/features/cardDoLead/blocos/BlocoImoveisDeInteresse';
import BlocoObservacoes from '@/features/cardDoLead/blocos/BlocoObservacoes';
import HistoricoDoLead from '@/features/cardDoLead/historico/HistoricoDoLead';
import OutrasInformacoes from './OutrasInformacoes';

interface LeadDetailsTabProps {
  item: PipelineItem;
  mostrarImoveis: boolean;
  mostrarObservacoes: boolean;
  /** `card.historico.versao` (useCardDoLead): muda quando o card muda e o Histórico recarrega. */
  versaoHistorico: string;
  /** Nome do funil do card: evento de outro funil do lead diz de qual veio. */
  funilAtual?: string | null;
  /** Nome pro agendamento de visita a partir do imóvel. */
  nomeExibido?: string;
  /** Visita criada pelo imóvel: recarrega o Histórico. */
  onVisitaCriada?: () => void;
}

export default function LeadDetailsTab({
  item,
  mostrarImoveis,
  mostrarObservacoes,
  versaoHistorico,
  funilAtual = null,
  nomeExibido,
  onVisitaCriada,
}: LeadDetailsTabProps) {
  const contato = contatoDoCard(item);
  const contactId = contato?.id != null ? String(contato.id) : null;

  return (
    <div className="flex min-h-0 flex-col gap-3 lg:h-full">
      <div
        data-testid="linha-de-cima"
        className={cn(
          'grid min-h-0 gap-3 lg:grid-cols-[1fr_1.2fr_1.2fr]',
          // Celular: cada caixa com altura própria, a aba rola inteira. Computador: altura dada pela linha.
          '[&>section]:max-lg:h-80',
          mostrarImoveis ? 'shrink-0 lg:h-[274px]' : 'flex-1',
        )}
      >
        <CaixaDaJanela titulo="Sobre o lead" corpoClassName="grid content-start gap-4">
          <BlocoOQueAIAEntendeu item={item} semCaixa />
          <BlocoRespostasDoFormulario item={item} semCaixa />
          {contactId != null && (
            <OutrasInformacoes
              contactId={contactId}
              atributos={contato?.custom_attributes as Record<string, unknown> | null | undefined}
              semCaixa
            />
          )}
        </CaixaDaJanela>

        {/* O Histórico rola por dentro: o corpo da caixa só segura. */}
        <CaixaDaJanela titulo="Histórico" corpoClassName="flex flex-col overflow-hidden">
          <HistoricoDoLead modo="compacto" contactId={contactId} funilAtual={funilAtual} versao={versaoHistorico} semTitulo />
        </CaixaDaJanela>

        {mostrarObservacoes && <BlocoObservacoes contactId={contactId} comoCaixa />}
      </div>

      {mostrarImoveis && (
        <BlocoImoveisDeInteresse item={item} nomeExibido={nomeExibido} onVisitaCriada={onVisitaCriada} className="min-h-[200px] lg:flex-1" />
      )}
    </div>
  );
}
