import { useNavigate } from 'react-router-dom';
import MetaPagesPanel from '@/pages/Customer/Automations/Origem/MetaPagesPanel';

// Integrações → Facebook (fase 4): as páginas do Facebook/Instagram de onde
// entram os leads dos formulários de anúncio. Até 01/10/2026 era a aba "Páginas
// do Facebook" da tela Origem; conectar a página é integração, e os formulários
// de cada página ficaram em Minha imobiliária → Formulários.
export default function FacebookPages() {
  const navigate = useNavigate();
  return (
    <div className="h-full overflow-y-auto">
      <MetaPagesPanel onGoToForms={() => navigate('/automations/origem')} />
    </div>
  );
}
