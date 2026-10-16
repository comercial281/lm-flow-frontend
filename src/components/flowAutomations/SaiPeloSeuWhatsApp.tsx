// "Sai pelo seu WhatsApp (número)": no lugar do "Enviar pelo número" quando o
// corretor monta a automação pessoal. O servidor força o número dele; aqui só
// mostramos qual é. O telefone vem de usePersonalCapabilities (sem nova chamada).
// Sem número, nem aparece: o bloco já vem "Indisponível" na paleta.

import Carregando from '@/components/base/Carregando';
import { formatPhone } from '@/features/numbers/numberTexts';
import { SAI_PELO_SEU } from '@/features/flowAutomations/personal';

interface Props {
  phone: string | null | undefined;
  loading?: boolean;
}

export function SaiPeloSeuWhatsApp({ phone, loading = false }: Props) {
  if (loading) return <Carregando variante="texto" linhas={1} />;
  if (!phone) return null;
  return (
    <div className="space-y-1" data-testid="sai-pelo-seu-whatsapp">
      <p className="text-sm font-medium">{SAI_PELO_SEU} ({formatPhone(phone)})</p>
    </div>
  );
}
