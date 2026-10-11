// Aba Aulas — renderiza a Área de Membros (cursos/módulos estilo Kiwify) embutida
// no app. Clicar num curso abre a experiência em tela cheia (/academia/curso/:id).

import { useNavigate } from 'react-router-dom';
import { Maximize2 } from 'lucide-react';
import AcademiaHome from '@/pages/Customer/Academia/AcademiaHome';
import { Button } from '@/components/ui/ds';

interface Props {
  canEdit: boolean;
}

export default function AulasTab({ canEdit }: Props) {
  const navigate = useNavigate();
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-end px-6 py-2 border-b border-border">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/academia')}
          type="button"
        >
          <Maximize2 className="h-4 w-4" /> Abrir em tela cheia
        </Button>
      </div>
      <AcademiaHome canEdit={canEdit} embedded />
    </div>
  );
}
