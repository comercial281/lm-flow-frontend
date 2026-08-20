import { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Building2,
  Bell,
  GraduationCap,
  UsersRound,
  Bot,
  DollarSign,
} from 'lucide-react';

/**
 * Menu da Área do Admin (Leal Mídia).
 *
 * Shell separado do CRM: aqui NÃO entra nada que o cliente use. Se um item
 * serve pro cliente, ele mora em menuItems.ts (menu do CRM), não aqui.
 *
 * Reorganizado em 19/08/2026: era uma lista chapada de 15 itens, muitos deles
 * sub-telas de outro item maior. Agora cada item de topo é um assunto —
 * telas relacionadas viraram abas DENTRO do item, não itens à parte:
 *   Clientes     -> Clientes, Leads ao Vivo, Modo Cliente, Formulários,
 *                    Sugestões/Bugs, Atividade (tudo que gira em torno do
 *                    cliente e do que ele faz no CRM)
 *   IA Vendedora -> Agentes, Cérebro Universal, Resultados, Aperfeiçoamento
 *                    (tudo que é a IA de pré-atendimento)
 * "Biblioteca" (templates de automação) foi excluída: não tinha uso real.
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
    description: 'Clientes, leads ao vivo, modo cliente, formulários, sugestões/bugs e atividade',
  },
  {
    // Lista as IAs de PRÉ-ATENDIMENTO (sales_agents) de todos os clientes —
    // é a IA Vendedora vista de fora. Agora também reúne Cérebro Universal,
    // Resultados e Aperfeiçoamento como abas, por serem a mesma IA.
    name: 'IA Vendedora',
    href: '/admin/agentes',
    icon: Bot,
    description: 'A IA Vendedora de todos os clientes: agentes, cérebro, resultados e aperfeiçoamento',
  },
  {
    name: 'Custo da IA',
    href: '/admin/custo-ia',
    icon: DollarSign,
    description: 'Quanto cada cliente consumiu de IA: a chave da Anthropic é uma só para todos',
  },
  {
    name: 'Central de Push',
    href: '/admin/push',
    icon: Bell,
    description: 'Avisos no celular: regras, disparo manual e o que falhou',
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
