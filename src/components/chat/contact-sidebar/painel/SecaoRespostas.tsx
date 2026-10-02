import { TEXTOS_DO_PAINEL as T, respostasDoFormulario } from '@/features/conversas/painelDoLead';
import Secao from './Secao';

import type { Contact } from '@/types/chat/api';

/**
 * Respostas do formulário: os campos personalizados e as informações extras do
 * contato. A única seção que abre e fecha (começa fechada); sem dado, não existe.
 */
export default function SecaoRespostas({ contact }: { contact: Contact }) {
  const respostas = respostasDoFormulario(contact.custom_attributes, contact.additional_attributes);
  if (respostas.length === 0) return null;

  return (
    <Secao titulo={T.respostasDoFormulario} recolhivel>
      <dl className="space-y-1.5">
        {respostas.map(r => (
          <div key={r.id} className="flex justify-between gap-3 text-xs">
            <dt className="text-muted-foreground flex-shrink-0">{r.rotulo}</dt>
            <dd className="lm-redact font-medium text-right break-words min-w-0">{r.valor}</dd>
          </div>
        ))}
      </dl>
    </Secao>
  );
}
