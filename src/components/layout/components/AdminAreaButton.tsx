import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { useAdminAccess } from '@/hooks/useAdminAccess';
import { isRootTenantHost } from '../config/menuItems';

/**
 * Botão de entrada da Área do Admin.
 *
 * Espelha exatamente o gate do SuperAdminRoute (host raiz + acesso de admin:
 * dono OU equipe cadastrada). Se o gate mudar, muda nos dois lugares — senão o
 * botão aparece e a rota chuta pra home, que é pior do que não ter botão.
 */
export default function AdminAreaButton() {
  const { isAdmin } = useAdminAccess();
  if (!isRootTenantHost() || !isAdmin) return null;

  return (
    <Link
      to="/admin"
      title="Área do Admin — painel da Leal Mídia"
      className="flex items-center gap-1.5 rounded-md bg-gradient-to-r from-[#7C3AED] to-[#9333EA] px-2.5 py-1.5 text-xs font-semibold tracking-wide text-white transition-opacity hover:opacity-90"
    >
      <ShieldCheck className="h-3.5 w-3.5" />
      <span className="hidden lg:inline">ÁREA DO ADMIN</span>
    </Link>
  );
}
