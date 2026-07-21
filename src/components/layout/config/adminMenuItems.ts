import { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Building2,
  Bell,
  Activity,
  Library,
  GraduationCap,
  UserCog,
  UsersRound,
  Brain,
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
    name: 'Modo Cliente',
    href: '/admin/modo-cliente',
    icon: UserCog,
    description: 'Editar follow-ups, agente de IA e automações de cada cliente daqui',
  },
  {
    name: 'Cérebro Universal',
    href: '/admin/cerebro',
    icon: Brain,
    description: 'Conhecimento e lições que todo agente de IA herda',
  },
  {
    name: 'Central de Push',
    href: '/admin/push',
    icon: Bell,
    description: 'Avisos no celular: regras, disparo manual e o que falhou',
  },
  {
    // Juntou "Auditoria" + "Uso": presença (quem está online) em cima, feed de
    // ações embaixo. Uso detalhado por usuário continua em /admin/uso (link).
    name: 'Atividade',
    href: '/admin/atividade',
    icon: Activity,
    description: 'Quem está online e tudo que os clientes fizeram',
  },
  {
    name: 'Biblioteca',
    href: '/admin/biblioteca',
    icon: Library,
    description: 'Templates de automação aplicáveis nos clientes',
  },
  {
    // Aponta pra DENTRO do admin, não pro /tutorials do CRM: o item era um
    // atalho que chutava o Giovani de volta pro shell do cliente.
    name: 'Academia',
    href: '/admin/academia',
    icon: GraduationCap,
    description: 'Publicar e gerenciar as aulas e a documentação',
  },
  {
    name: 'Equipe',
    href: '/admin/equipe',
    icon: UsersRound,
    description: 'Adicionar pessoas da Leal Mídia (acesso ao admin e ocultas nos logs)',
  },
];
