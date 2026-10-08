// Aba Detalhes do card do lead (spec 2026-10-02):
//   1. "O que sabemos do lead": o que a IA entendeu + respostas do formulário;
//   2. Imóveis de interesse;
//   3. Histórico | Observações, lado a lado, cada um com a sua rolagem.
// Histórico e Observações NÃO se juntam (decisão do dono, 02/10).
// Desde a E4 os pedaços são blocos de features/cardDoLead/blocos (a página
// "card completo" usa os mesmos).
import type { PipelineItem } from '@/types/analytics';
import type { ContactEvent } from '@/types/notifications/contact-events';
import { contatoDoCard } from '@/features/cardDoLead/cardDoLead';
import BlocoOQueAIAEntendeu from '@/features/cardDoLead/blocos/BlocoOQueAIAEntendeu';
import BlocoRespostasDoFormulario from '@/features/cardDoLead/blocos/BlocoRespostasDoFormulario';
import BlocoImoveisDeInteresse from '@/features/cardDoLead/blocos/BlocoImoveisDeInteresse';
import BlocoHistorico from '@/features/cardDoLead/blocos/BlocoHistorico';
import BlocoObservacoes from '@/features/cardDoLead/blocos/BlocoObservacoes';
import OutrasInformacoes from './OutrasInformacoes';

interface LeadDetailsTabProps {
  item: PipelineItem;
  mostrarImoveis: boolean;
  mostrarObservacoes: boolean;
  historico: ContactEvent[];
  carregandoHistorico: boolean;
  onRecarregarHistorico: () => void;
}

export default function LeadDetailsTab({
  item,
  mostrarImoveis,
  mostrarObservacoes,
  historico,
  carregandoHistorico,
  onRecarregarHistorico,
}: LeadDetailsTabProps) {
  const contato = contatoDoCard(item);

  return (
    <div className="grid h-full min-h-0 gap-4 lg:grid-cols-2">
      {/* Esquerda: o que sabemos do lead + imóveis, em caixas */}
      <div className="flex flex-col gap-4 min-w-0">
        <BlocoOQueAIAEntendeu item={item} />
        <BlocoRespostasDoFormulario item={item} />
        {mostrarImoveis && <BlocoImoveisDeInteresse item={item} />}
        {contato?.id != null && (
          <OutrasInformacoes
            contactId={String(contato.id)}
            atributos={contato.custom_attributes as Record<string, unknown> | null | undefined}
          />
        )}
      </div>

      {/* Direita: Histórico em cima, Observações embaixo — separados de propósito. */}
      <div className="flex flex-col gap-4 min-h-[480px] lg:min-h-0">
        <BlocoHistorico eventos={historico} carregando={carregandoHistorico} aoRecarregar={onRecarregarHistorico} />
        {mostrarObservacoes && <BlocoObservacoes contactId={contato?.id != null ? String(contato.id) : null} />}
      </div>
    </div>
  );
}
