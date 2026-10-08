// Coluna da direita da Ficha da página do card: o Histórico inteiro (E5) —
// caixa de escrever observação no topo e Observações como filtro (modelo
// "Comentários" do Praedium). Na janela, Histórico e Observações continuam
// separados (decisão de 02/10); aqui é a página.
import HistoricoDoLead from '../historico/HistoricoDoLead';
import type { CardDoLead } from '../useCardDoLead';

interface ColunaDoHistoricoProps {
  card: CardDoLead;
  /** Nome do funil do card: evento de outro funil do lead diz de qual veio. */
  funilAtual?: string | null;
}

export default function ColunaDoHistorico({ card, funilAtual = null }: ColunaDoHistoricoProps) {
  const contactId = card.contato?.id != null ? String(card.contato.id) : null;
  return (
    <div className="flex min-h-[560px] min-w-0 flex-col rounded-xl border border-border p-4">
      <HistoricoDoLead
        modo="completo"
        contactId={contactId}
        funilAtual={funilAtual}
        versao={card.historico.versao}
        comObservacoes={card.recursos.notas}
      />
    </div>
  );
}
