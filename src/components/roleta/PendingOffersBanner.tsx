import { useNavigate } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { usePendingOffers } from '@/contexts/PendingOffersContext';
import { minutesLeft } from './pendingOffersMatch';

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
  const left = minutesLeft(primeira);

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800">
      <div className="flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
        <Clock className="h-3.5 w-3.5 flex-shrink-0" />
        <span>
          <strong>{primeira.lead_name}</strong> está esperando seu aceite
          {left > 0 ? ` — ${left} min restantes` : ' — prazo esgotado'}
          {restantes > 0 && ` (+${restantes} lead${restantes > 1 ? 's' : ''})`}
        </span>
      </div>
      <button
        type="button"
        onClick={() => navigate(`/roleta/aceite/${primeira.id}`)}
        className="flex-shrink-0 rounded-md bg-amber-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-amber-700"
      >
        Ver lead
      </button>
    </div>
  );
}
