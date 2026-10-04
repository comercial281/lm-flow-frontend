import type { ReactNode } from 'react';

/**
 * Respiro das telas que eram ABA DENTRO de outra tela (Leads ao vivo, Números,
 * Logs, Usuários, Menus arquivados, Avisos na tela, Aviso de
 * visita). Antes o padding vinha da tela-mãe; agora cada uma é uma rota.
 */
export default function AdminConteudo({ children }: { children: ReactNode }) {
  return <div className="h-full px-6 py-4">{children}</div>;
}
