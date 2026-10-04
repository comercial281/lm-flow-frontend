import { Outlet, useLocation } from 'react-router-dom';
import Abas from '@/components/base/Abas';
import { ADMIN_MENU_ITEMS, donoDoEnderecoAdmin } from './config/adminMenuItems';

// ── PÁGINA COM ABAS DA ÁREA DO ADMIN (fase 4, 01/10/2026) ───────────────────
//
// Mesmo molde da `PaginaComAbas` do CRM, lendo o menu do admin. Rota-moldura
// SEM endereço próprio: cada aba é uma rota, e as telas de dentro mantêm o
// endereço. O nome do item é o ÚNICO h1 da página; o título de cada tela de
// dentro é h2. Item sem abas (Equipe) não ganha moldura.
export default function AdminPaginaComAbas() {
  const { pathname } = useLocation();
  const dono = donoDoEnderecoAdmin(ADMIN_MENU_ITEMS, pathname);
  const abas = dono?.item.abas ?? [];

  if (!dono || abas.length < 2) return <Outlet />;

  const Icone = dono.item.icon;
  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border px-6 pt-4">
        <div className="flex items-center gap-2 mb-3">
          <Icone className="h-5 w-5 text-primary" aria-hidden="true" />
          <h1 className="text-lg font-semibold">{dono.item.name}</h1>
        </div>
        <Abas
          rotulo={`Abas de ${dono.item.name}`}
          abas={abas.map(aba => ({ chave: aba.href, rotulo: aba.name, icone: aba.icon, para: aba.href, exata: aba.exata, tambem: aba.tambem }))}
        />
      </div>
      <div className="flex-1 min-w-0 min-h-0 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}
