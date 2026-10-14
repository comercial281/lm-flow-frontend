// Aba Detalhes do card do lead (Hierarquia das janelas, 2b.5):
//   linha de cima — três caixas da mesma altura, cada uma rola por dentro:
//     Sobre o lead (o que a IA entendeu + respostas do formulário + outras informações),
//     Histórico e Observações (só com a função de Observações do cliente: sem ela,
//     duas colunas, sem faixa vazia);
//   embaixo — Imóveis de interesse, na largura toda, com o cartão compacto.
// A linha de cima fica com a sobra da janela (flex-1, mín. 240 px) e a caixa de imóveis
// com a altura do próprio conteúdo (cartões em fileira não pedem mais).
// O ↻ do Histórico sobe pro cabeçalho da caixa (acao); o Histórico recarrega pela versão.
// Histórico e Observações NÃO se juntam na janela: um o sistema escreve sozinho,
// o outro é o comentário que o corretor escolheu deixar (decisão do dono, 02/10).
// O Histórico é o novo (E5 do funil, 07/10), em modo compacto, e o título
// "Histórico" é o da caixa (semTitulo). Os pedaços são os blocos de
// features/cardDoLead/blocos (E4); a página do card usa os mesmos, sem caixa da janela.
import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { PipelineItem } from '@/types/analytics';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/ds';
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
  // O ↻ mora no cabeçalho da caixa: ele soma na versão e o Histórico recarrega sozinho.
  const [recargas, setRecargas] = useState(0);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);

  return (
    <div className="flex min-h-0 flex-col gap-3 lg:h-full">
      <div
        data-testid="linha-de-cima"
        className={cn(
          'grid min-h-0 gap-3',
          mostrarObservacoes ? 'lg:grid-cols-[1fr_1.2fr_1.2fr]' : 'lg:grid-cols-[1fr_1.4fr]',
          // Celular: cada caixa com altura própria, a aba rola inteira. Computador: altura dada pela linha.
          '[&>section]:max-lg:h-80',
          // Sobra da janela (mín. 240 px); os imóveis ficam com a altura do conteúdo.
          'flex-1 lg:min-h-[240px]',
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
        <CaixaDaJanela
          titulo="Histórico"
          corpoClassName="flex flex-col overflow-hidden"
          acao={
            contactId != null && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() => setRecargas(n => n + 1)}
                disabled={carregandoHistorico}
                aria-label="Atualizar histórico"
                title="Atualizar histórico"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', carregandoHistorico && 'animate-spin')} />
              </Button>
            )
          }
        >
          <HistoricoDoLead
            modo="compacto"
            contactId={contactId}
            funilAtual={funilAtual}
            versao={`${versaoHistorico}:${recargas}`}
            aoCarregando={setCarregandoHistorico}
            semTitulo
          />
        </CaixaDaJanela>

        {mostrarObservacoes && <BlocoObservacoes contactId={contactId} comoCaixa />}
      </div>

      {mostrarImoveis && (
        <BlocoImoveisDeInteresse item={item} nomeExibido={nomeExibido} onVisitaCriada={onVisitaCriada} className="shrink-0" compacto />
      )}
    </div>
  );
}
