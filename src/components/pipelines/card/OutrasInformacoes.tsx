import { useState } from 'react';
import CustomAttributesForm from '@/components/customAttributes/CustomAttributesForm';
import { contactsService } from '@/services/contacts/contactsService';

interface Props {
  contactId: string;
  atributos: Record<string, unknown> | null | undefined;
}

// Campos extras que o gestor criou pro contato, editados na hora (mesmo modo do
// painel de Conversas). Veio da aba "Atributos" da antiga Detalhes do Contato.
// Sem campo criado, o bloco nem aparece.
export default function OutrasInformacoes({ contactId, atributos }: Props) {
  const [temCampos, setTemCampos] = useState(false);

  return (
    <div className={temCampos ? 'rounded-xl border border-border p-4 space-y-3' : 'hidden'}>
      <h4 className="text-sm font-semibold">Outras informações</h4>
      <CustomAttributesForm
        attributeModel="contact_attribute"
        attributes={atributos}
        mode="editable"
        aoCarregarDefinicoes={quantidade => setTemCampos(quantidade > 0)}
        onUpdateAttributes={async novos => {
          await contactsService.updateContact(contactId, { custom_attributes: novos });
        }}
        translationNamespace="chat"
        translationKeys={{
          loadError: 'contactSidebar.customAttributes.loadError',
          updateSuccess: 'contactSidebar.customAttributes.updateSuccess',
          updateError: 'contactSidebar.customAttributes.updateError',
          noAttributes: 'contactSidebar.customAttributes.noAttributes',
          yes: 'contactSidebar.customAttributes.yes',
          no: 'contactSidebar.customAttributes.no',
        }}
      />
    </div>
  );
}
