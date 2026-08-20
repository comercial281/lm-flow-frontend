// Aba Aulas — renderiza a Área de Membros (cursos/módulos estilo Kiwify) embutida
// no app. Clicar num curso abre a experiência em tela cheia (/academia/curso/:id).

import { useNavigate } from 'react-router-dom';
import { Maximize2 } from 'lucide-react';
import AcademiaHome from '@/pages/Customer/Academia/AcademiaHome';

interface Props {
  canEdit: boolean;
}

export default function AulasTab({ canEdit }: Props) {
  const navigate = useNavigate();
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-end px-6 py-2 border-b border-border">
        <button
          onClick={() => navigate('/academia')}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border hover:border-primary/40"
          type="button"
        >
          <Maximize2 size={12} /> Abrir em tela cheia
        </button>
      </div>
      <AcademiaHome canEdit={canEdit} embedded />
    </div>
  );
}
