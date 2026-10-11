import { useNavigate } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { Button } from '@/components/ui/ds';
import Faixa from '@/components/base/Faixa';
import { usePendingOffers } from '@/contexts/PendingOffersContext';
import { deadlineLabel } from './offerDeadline';

// Faixa das ofertas da roleta esperando ESTE corretor.
//
// Até aqui o único caminho até uma oferta era o link que a roleta manda no
// WhatsApp pessoal. Quem não tem número cadastrado nunca recebia o link, e quem
// recebia o perdia ao trocar de aparelho ou apagar a conversa — sem nenhuma tela
// onde reencontrar o lead, com o prazo correndo até ele passar para o próximo.
//
// A lista vem do PendingOffersContext (o poll saiu daqui): é a mesma que
// desenha o selo "Aguardando seu aceite" no card e na conversa.
export default function PendingOffersBanner() {
  const navigate = useNavigate();
  const { offers } = usePendingOffers();

  if (offers.length === 0) return null;

  const primeira = offers[0];
  const restantes = offers.length - 1;
  // "12 min pra aceitar", "prazo esgotado" ou "sem prazo" — a roleta sem prazo de
  // aceite não tem cronômetro, e nulo ali NÃO é esgotado.
  const prazo = deadlineLabel(primeira);
  const prazoTexto = /^\d+ min$/.test(prazo) ? `${prazo} pra aceitar` : prazo;

  return (
    <Faixa
      tom="atencao"
      icone={Clock}
      acao={
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => navigate(`/roleta/aceite/${primeira.id}`)}
        >
          Ver lead
        </Button>
      }
    >
      {/* Mesma frase do pop-up de aceite: "Lead novo pra você". */}
      Lead novo pra você: <strong>{primeira.lead_name}</strong>
      {` · ${prazoTexto}`}
      {restantes > 0 && ` · +${restantes} esperando`}
    </Faixa>
  );
}
