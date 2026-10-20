import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { enderecoComUuid } from './codigoDoLink';

// Link que chegou com o código (WhatsApp) troca pro endereço com UUID ANTES de
// qualquer rota montar. Tem que ser no render: a tela de Conversas joga pra
// lista, no efeito dela, todo id que não é UUID, e o efeito do filho roda antes
// do efeito do pai. Também não dá pra traduzir dentro de cada tela: há quem leia
// `window.location` direto (ChatContext, OfferPopup, useCardNoEndereco).
export default function LinkSemPix({ children }: { children: ReactNode }) {
  const { pathname, search, hash } = useLocation();
  const destino = enderecoComUuid(pathname, search);
  if (destino) return <Navigate to={`${destino}${hash}`} replace />;
  return <>{children}</>;
}
