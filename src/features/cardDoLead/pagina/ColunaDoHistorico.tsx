// Coluna da direita da Ficha da página do card.
//
// ENCAIXE PARTE 5: o Histórico novo (features/cardDoLead/historico/
// HistoricoDoLead, com os filtros e a caixa de escrever observação no topo)
// entra AQUI, no lugar dos dois blocos. Até lá, Histórico e Observações
// separados, como na janela (decisão de 02/10).
import BlocoHistorico from '../blocos/BlocoHistorico';
import BlocoObservacoes from '../blocos/BlocoObservacoes';
import type { CardDoLead } from '../useCardDoLead';

interface ColunaDoHistoricoProps {
  card: CardDoLead;
  /** Nome do funil do card: o Histórico novo (Parte 5) diz de qual funil veio cada evento. */
  funilAtual?: string | null;
}

export default function ColunaDoHistorico({ card }: ColunaDoHistoricoProps) {
  const contactId = card.contato?.id != null ? String(card.contato.id) : null;
  return (
    <div className="flex min-h-[480px] min-w-0 flex-col gap-4">
      <BlocoHistorico
        eventos={card.historico.eventos}
        carregando={card.historico.carregando}
        aoRecarregar={card.historico.recarregar}
      />
      {card.recursos.notas && <BlocoObservacoes contactId={contactId} />}
    </div>
  );
}
