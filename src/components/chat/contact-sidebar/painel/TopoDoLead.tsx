import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Pencil, X } from 'lucide-react';
import { toast } from 'sonner';

import IconActionButton from '@/components/base/IconActionButton';
import ContactAvatar from '@/components/chat/contact/ContactAvatar';
import { telefone } from '@/lib/formato';
import {
  TEXTOS_DO_PAINEL as T, mascararTelefone, nomeNaTela, textoOutraConversa,
} from '@/features/conversas/painelDoLead';
import { useEditarContato } from '../useEditarContato';

import type { Contact } from '@/types/chat/api';

interface TopoDoLeadProps {
  contact: Contact | null;
  /**
   * Oferta da roleta aberta para quem vê: telefone mascarado (e o nome, quando o
   * nome é o telefone), sem e-mail, sem copiar, sem editar.
   */
  emOferta: boolean;
  /** A faixa de selos (etapa, temperatura, origem, espera), logo abaixo do nome. */
  selos?: ReactNode;
  outra: { id: string; numero: string; mais: number } | null;
  onClose: () => void;
}

/**
 * Topo do painel do lead: quem é, a faixa de selos (em que etapa está, a
 * temperatura, de onde veio, há quanto espera) e se já conversou por outro
 * número. Sem o "Online" (era fixo no código e aparecia para todo lead).
 */
export default function TopoDoLead({ contact, emOferta, selos, outra, onClose }: TopoDoLeadProps) {
  const navigate = useNavigate();
  const { abrir: editar, modal } = useEditarContato(contact);

  const fone = emOferta ? mascararTelefone(contact?.phone_number) : telefone(contact?.phone_number);
  const email = emOferta ? '' : (contact?.email ?? '').trim();

  const copiarTelefone = async () => {
    if (!contact?.phone_number) return;
    try {
      await navigator.clipboard.writeText(contact.phone_number);
      toast.success(T.telefoneCopiado);
    } catch {
      toast.error(T.erroAoCopiar);
    }
  };

  return (
    <div className="px-4 py-4 space-y-3">
      <div className="flex items-start gap-3">
        <ContactAvatar contact={contact} size="lg" />

        <div className="flex-1 min-w-0">
          <h2 className="lm-redact text-base font-semibold truncate">{nomeNaTela(contact?.name, emOferta) || T.semNome}</h2>

          {fone && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <span className="lm-redact truncate">{fone}</span>
              {!emOferta && (
                <IconActionButton
                  label={T.copiarTelefone}
                  icon={<Copy className="h-3 w-3" />}
                  onClick={copiarTelefone}
                  variant="ghost"
                  className="h-6 w-6"
                />
              )}
            </div>
          )}

          {email && <p className="lm-redact text-sm text-muted-foreground truncate">{email}</p>}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {/* A janela de edição mostra o telefone inteiro: fica fora durante a oferta. */}
          {!emOferta && contact && (
            <IconActionButton
              label={T.editarContato}
              icon={<Pencil className="h-4 w-4" />}
              onClick={editar}
              variant="ghost"
              className="h-8 w-8"
            />
          )}
          <IconActionButton
            label={T.fechar}
            icon={<X className="h-4 w-4" />}
            onClick={onClose}
            variant="ghost"
            className="h-8 w-8"
          />
        </div>
      </div>

      {selos}

      {outra && (
        <p className="text-xs text-muted-foreground">
          {textoOutraConversa(outra.numero)}
          {' · '}
          <button
            type="button"
            onClick={() => navigate(`/conversations/${outra.id}`, { replace: true })}
            className="text-primary hover:underline"
          >
            {T.abrir}
          </button>
          {outra.mais > 0 && ` (+${outra.mais})`}
        </p>
      )}

      {modal}
    </div>
  );
}
