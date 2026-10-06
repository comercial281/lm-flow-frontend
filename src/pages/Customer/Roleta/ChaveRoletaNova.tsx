import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { useClientToggle, useTenantFeatures } from '@/contexts/TenantFeaturesContext';

// Portão da ROLETA NOVA (chave por cliente `roleta_nova`, D12): ligada, a
// página nova (lista de roletas → página por roleta); desligada, a tela antiga,
// intacta. A Leal Mídia liga cliente a cliente, cada um com o ok do Tony.
//
// ⚠️ `useClientToggle('roleta_nova')` LITERAL: os scanners do catálogo de
// Funções (scripts/sync-feature-catalog.mjs e audit-feature-catalog.mjs) leem
// a chave por regex. Variável no lugar do texto tira a chave do catálogo.
//
// Enquanto as chaves do cliente carregam (primeira visita, sem cópia guardada),
// espera: decidir com a lista vazia mostraria a tela antiga e trocaria em
// seguida, na cara de quem usa.
export default function ChaveRoletaNova({ ligada, desligada }: { ligada: ReactNode; desligada: ReactNode }) {
  const roletaNova = useClientToggle('roleta_nova');
  const { loading } = useTenantFeatures();
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-10 text-muted-foreground" role="status" aria-label="Carregando">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
      </div>
    );
  }
  return <>{roletaNova ? ligada : desligada}</>;
}
