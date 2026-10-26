import { Tags } from 'lucide-react';

import ContactTagsManager from '../ContactTagsManager';
import { TEXTOS_DO_PAINEL as T } from '@/features/conversas/painelDoLead';
import Secao from './Secao';

interface SecaoEtiquetasProps {
  contactId: string;
  conversationId?: string;
  onUpdated?: () => void;
}

/** Etiquetas do lead: só as dele à vista; o catálogo da conta abre no "+ Etiqueta". */
export default function SecaoEtiquetas({ contactId, conversationId, onUpdated }: SecaoEtiquetasProps) {
  return (
    <Secao titulo={T.etiquetas} icone={{ Icone: Tags, tom: 'rosa' }}>
      <ContactTagsManager
        contactId={contactId}
        conversationId={conversationId}
        onUpdated={onUpdated}
      />
    </Secao>
  );
}
