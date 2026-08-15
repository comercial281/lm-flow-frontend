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
  Bot,
  ClipboardList,
  Wand2,
  MessageSquarePlus,
  Radio,
  DollarSign,
  Sparkles,
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
    // Mural pra deixar aberto num segundo monitor: substitui o "ficar olhando
    // o grupo do WhatsApp" pra saber se lead está caindo (e se parou).
    name: 'Leads ao Vivo',
    href: '/admin/leads-ao-vivo',
    icon: Radio,
    description: 'Mural dos leads caindo agora em todos os clientes',
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
    description: 'Conhecimento e lições que toda IA Vendedora herda',
  },
  {
    // Esta tela lista as IAs de PRÉ-ATENDIMENTO (sales_agents) de todos os
    // clientes — é a IA Vendedora vista de fora. Chamava-se "Agentes de IA",
    // colidindo com o grupo de robô externo; agora usa o nome que o cliente vê.
    name: 'IA Vendedora',
    href: '/admin/agentes',
    icon: Bot,
    description: 'A IA Vendedora de todos os clientes: ligar, desligar e configurar',
  },
  {
    // Vem ANTES do Custo de propósito: esta é a tela que se abre na frente do
    // cliente, e a outra é a que fecha a fatura.
    name: 'Resultados da IA',
    href: '/admin/resultados-ia',
    icon: Sparkles,
    description: 'O que a IA produziu: leads atendidos, taxa de resposta e visitas que ela agendou',
  },
  {
    name: 'Custo da IA',
    href: '/admin/custo-ia',
    icon: DollarSign,
    description: 'Quanto cada cliente consumiu de IA: a chave da Anthropic é uma só para todos',
  },
  {
    name: 'Aperfeiçoamento',
    href: '/admin/aperfeicoamento',
    icon: Wand2,
    description: 'Ensine a IA por descrição ou pelas conversas passadas; você aprova',
  },
  {
    name: 'Formulários',
    href: '/admin/formularios',
    icon: ClipboardList,
    description: 'Monte formulários com link público; as respostas caem aqui',
  },
  {
    name: 'Sugestões/Bugs',
    href: '/admin/sugestoes-bugs',
    icon: MessageSquarePlus,
    description: 'Sugestões e bugs que os clientes enviam de dentro do CRM',
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
