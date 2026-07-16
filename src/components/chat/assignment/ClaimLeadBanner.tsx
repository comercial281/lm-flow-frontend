import { useState } from 'react';
import { toast } from 'sonner';
import { Gavel } from 'lucide-react';
import { claimConversation } from '@/services/roletaConfig/roletaConfigService';

interface ClaimLeadBannerProps {
  conversationId: string;
  onClaimed: () => void;
}

/**
 * Faixa "Assumir lead" do modo Leilão.
 *
 * Aparece quando a conversa está SEM DONO — no Leilão o lead nasce assim de
 * propósito, ofertado a todos os corretores ao mesmo tempo. O primeiro que
 * assumir leva.
 *
 * A trava anti-empate vive no banco (UPDATE condicional em status='pending'):
 * se dois clicarem no mesmo instante, o segundo recebe 409 e vê "outro assumiu
 * primeiro" — em vez dos dois acharem que ganharam o lead.
 */
export default function ClaimLeadBanner({ conversationId, onClaimed }: ClaimLeadBannerProps) {
  const [claiming, setClaiming] = useState(false);

  async function handleClaim() {
    setClaiming(true);
    try {
      await claimConversation(conversationId);
      toast.success('Lead assumido. Ele é seu.');
      onClaimed();
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 409) {
        toast.error('Outro corretor assumiu esse lead primeiro.');
        onClaimed();
      } else if (status === 404) {
        toast.error('Este lead não está aberto para você assumir.');
      } else {
        toast.error('Não deu para assumir agora. Tente de novo.');
      }
    } finally {
      setClaiming(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2 bg-violet-50 dark:bg-violet-950/30 border-b border-violet-200 dark:border-violet-800">
      <div className="flex items-center gap-2 text-xs text-violet-700 dark:text-violet-300">
        <Gavel className="h-3.5 w-3.5 flex-shrink-0" />
        <span>Lead sem dono. Quem assumir primeiro, fica com ele.</span>
      </div>
      <button
        type="button"
        onClick={handleClaim}
        disabled={claiming}
        className="flex-shrink-0 rounded-md bg-[#7c3aed] px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-[#6d28d9] disabled:opacity-60"
      >
        {claiming ? 'Assumindo...' : 'Assumir lead'}
      </button>
    </div>
  );
}
