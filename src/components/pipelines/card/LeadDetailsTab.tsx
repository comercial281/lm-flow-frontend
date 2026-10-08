// Aba Detalhes do card do lead (spec 2026-10-02):
//   1. "O que sabemos do lead": o que a IA entendeu + respostas do formulário;
//   2. Imóveis de interesse;
//   3. Histórico | Observações, lado a lado, cada um com a sua rolagem.
// Histórico e Observações NÃO se juntam na janela: um o sistema escreve sozinho,
// o outro é o comentário que o corretor escolheu deixar (decisão do dono, 02/10).
// O Histórico é o novo (E5 do funil, 07/10), em modo compacto: sem o filtro
// Observações e sem linha de nota. Na página do card completo ele vem inteiro
// (features/cardDoLead/pagina/ColunaDoHistorico). Os pedaços são os blocos de
// features/cardDoLead/blocos (E4).
import type { PipelineItem } from '@/types/analytics';
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
}

export default function LeadDetailsTab({
  item,
  mostrarImoveis,
  mostrarObservacoes,
  versaoHistorico,
  funilAtual = null,
}: LeadDetailsTabProps) {
  const contato = contatoDoCard(item);
  const contactId = contato?.id != null ? String(contato.id) : null;

  return (
    <div className="grid h-full min-h-0 gap-4 lg:grid-cols-2">
      {/* Esquerda: o que sabemos do lead + imóveis, em caixas */}
      <div className="flex flex-col gap-4 min-w-0">
        <BlocoOQueAIAEntendeu item={item} />
        <BlocoRespostasDoFormulario item={item} />
        {mostrarImoveis && <BlocoImoveisDeInteresse item={item} />}
        {contactId != null && (
          <OutrasInformacoes
            contactId={contactId}
            atributos={contato?.custom_attributes as Record<string, unknown> | null | undefined}
          />
        )}
      </div>

      {/* Direita: Histórico em cima, Observações embaixo — separados de propósito. */}
      <div className="flex flex-col gap-4 min-h-[480px] lg:min-h-0">
        <div className="flex flex-col min-h-0 flex-1 rounded-xl border border-border p-4">
          <HistoricoDoLead modo="compacto" contactId={contactId} funilAtual={funilAtual} versao={versaoHistorico} />
        </div>
        {mostrarObservacoes && <BlocoObservacoes contactId={contactId} />}
      </div>
    </div>
  );
}
