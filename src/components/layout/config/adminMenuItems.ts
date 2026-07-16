import { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Building2,
  Activity,
  TrendingUp,
  Library,
  GraduationCap,
} from 'lucide-react';

/**
 * Menu da Área do Admin (Leal Mídia).
 *
 * Shell separado do CRM: aqui NÃO entra nada que o cliente use. Se um item
 * serve pro cliente, ele mora em menuItems.ts (menu do CRM), não aqui.
 */
export interface AdminMenuItem {
  name: string;
  href: string;
  icon: LucideIcon;
  description: string;
}

export const ADMIN_MENU_ITEMS: AdminMenuItem[] = [
  {
    name: 'Visão Geral',
    href: '/admin',
    icon: LayoutDashboard,
    description: 'Saúde do SaaS num relance',
  },
  {
    name: 'Clientes',
    href: '/admin/clientes',
    icon: Building2,
    description: 'Criar, congelar, arquivar, entrar no CRM do cliente',
  },
  {
    name: 'Auditoria',
    href: '/admin/auditoria',
    icon: Activity,
    description: 'Tudo que aconteceu, por cliente',
  },
  {
    name: 'Uso',
    href: '/admin/uso',
    icon: TrendingUp,
    description: 'Quem usa, quanto tempo, em que tela',
  },
  {
    name: 'Biblioteca',
    href: '/admin/biblioteca',
    icon: Library,
    description: 'Templates de automação aplicáveis nos clientes',
  },
  {
    name: 'Academia',
    href: '/tutorials',
    icon: GraduationCap,
    description: 'Aulas e documentação dos clientes',
  },
];
