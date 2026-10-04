import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard, Radio, Building2, Smartphone, Wallet, Users, ScrollText, MessageCircle,
  Megaphone, Bell, BellRing, Landmark, GraduationCap, Archive, Globe, LifeBuoy,
  Bot, Sparkles, Brain, CalendarCheck, UsersRound,
} from 'lucide-react';
import { enderecoCasa } from './menuItems';

/**
 * Menu da Área do Admin (Leal Mídia). Shell separado do CRM: aqui NÃO entra
 * nada que o cliente use.
 *
 * Fase 4 (01/10/2026, spec `specs/2026-10-01-fase-4-area-do-admin-design.md`):
 * mesmo padrão do menu novo do CRM. Cada item é uma página, e as subdivisões
 * são ABAS NO TOPO, lidas daqui pela `AdminPaginaComAbas` — menu e abas não têm
 * como discordar. Não existe terceiro nível.
 *
 * Cada aba é uma rota própria. Aba que já tinha endereço manteve (Push em
 * /admin/push, Academia em /admin/academia, Site em /admin/plataforma), pra
 * link salvo continuar valendo. `exata` marca a aba cujo endereço é começo do
 * de outra aba.
 */
export interface AdminAba {
  name: string;
  href: string;
  icon: LucideIcon;
  exata?: boolean;
  /** Outros endereços que também pertencem a esta aba (ex.: a ficha de um usuário). */
  tambem?: RegExp[];
}

export interface AdminMenuItem {
  name: string;
  href: string;
  icon: LucideIcon;
  description: string;
  abas?: AdminAba[];
}

export const ADMIN_MENU_ITEMS: AdminMenuItem[] = [
  {
    name: 'Visão Geral',
    href: '/admin',
    icon: LayoutDashboard,
    description: 'A carteira num relance e os leads chegando agora',
    abas: [
      { name: 'Dashboard', href: '/admin', icon: LayoutDashboard, exata: true },
      { name: 'Leads ao vivo', href: '/admin/leads-ao-vivo', icon: Radio },
    ],
  },
  // Chat de suporte (04/10/2026): a tela de trabalho do time, por isso item
  // próprio e não aba de Plataforma. Sem abas: /admin/suporte/:id casa aqui.
  {
    name: 'Suporte',
    href: '/admin/suporte',
    icon: LifeBuoy,
    description: 'Chamados dos clientes: dúvidas, bugs e sugestões',
  },
  {
    name: 'Clientes',
    href: '/admin/clientes',
    icon: Building2,
    description: 'Cada cliente, os números de WhatsApp dele e quanto ele custa',
    abas: [
      { name: 'Clientes', href: '/admin/clientes', icon: Building2, exata: true },
      { name: 'Números conectados', href: '/admin/clientes/numeros', icon: Smartphone },
      { name: 'Custos', href: '/admin/clientes/custos', icon: Wallet },
    ],
  },
  {
    name: 'Usuários',
    href: '/admin/usuarios',
    icon: Users,
    description: 'Todas as pessoas de todos os clientes: acessos, logs e a mensagem de acesso',
    abas: [
      {
        name: 'Usuários',
        href: '/admin/usuarios',
        icon: Users,
        exata: true,
        // Ficha: /admin/usuarios/:cliente/:id (dois trechos; Logs e Mensagem de acesso têm um só).
        tambem: [/^\/admin\/usuarios\/[^/]+\/[^/]+\/?$/],
      },
      { name: 'Logs', href: '/admin/usuarios/logs', icon: ScrollText },
      { name: 'Mensagem de acesso', href: '/admin/usuarios/mensagem-de-acesso', icon: MessageCircle },
    ],
  },
  {
    name: 'Comunicação',
    href: '/admin/comunicacao',
    icon: Megaphone,
    description: 'Falar com os clientes: avisos na tela, push e WhatsApp',
    abas: [
      { name: 'Avisos na tela', href: '/admin/comunicacao', icon: Bell, exata: true },
      { name: 'Push', href: '/admin/push', icon: BellRing },
      { name: 'WhatsApp', href: '/admin/comunicacao/whatsapp', icon: MessageCircle },
    ],
  },
  {
    name: 'Plataforma',
    href: '/admin/academia',
    icon: Landmark,
    description: 'O que vale em todas as imobiliárias de uma vez',
    abas: [
      { name: 'Academia', href: '/admin/academia', icon: GraduationCap },
      { name: 'Menus arquivados', href: '/admin/plataforma/menus-arquivados', icon: Archive },
      { name: 'Site', href: '/admin/plataforma', icon: Globe, exata: true },
    ],
  },
  {
    name: 'IA Vendedora',
    href: '/admin/agentes',
    icon: Bot,
    description: 'A IA Vendedora de todos os clientes',
    abas: [
      { name: 'Agentes', href: '/admin/agentes', icon: Bot, exata: true },
      { name: 'Dashboard', href: '/admin/agentes/dashboard', icon: Sparkles },
      { name: 'Conhecimento', href: '/admin/agentes/conhecimento', icon: Brain },
      { name: 'Aviso de visita', href: '/admin/agentes/aviso-de-visita', icon: CalendarCheck },
    ],
  },
  {
    name: 'Equipe',
    href: '/admin/equipe',
    icon: UsersRound,
    description: 'Pessoas da Leal Mídia com acesso ao admin',
  },
];

/**
 * Qual item (e qual aba) é dono do endereço. Ganha o endereço mais longo que
 * casa, igual ao `donoDoEndereco` do CRM. Item sem abas casa pelo próprio href.
 */
export function donoDoEnderecoAdmin(
  itens: AdminMenuItem[],
  pathname: string,
): { item: AdminMenuItem; aba?: AdminAba } | null {
  let melhor: { item: AdminMenuItem; aba?: AdminAba; tamanho: number } | null = null;
  for (const item of itens) {
    const candidatos: { href: string; exata?: boolean; aba?: AdminAba }[] = item.abas?.length
      ? item.abas.map(aba => ({ href: aba.href, exata: aba.exata, aba }))
      : [{ href: item.href }];
    // Endereços extras de uma aba (ficha de usuário) contam como o href da aba.
    for (const aba of item.abas ?? []) {
      if (aba.tambem?.some(r => r.test(pathname))) {
        if (!melhor || aba.href.length > melhor.tamanho) melhor = { item, aba, tamanho: aba.href.length };
      }
    }
    for (const c of candidatos) {
      if (enderecoCasa(pathname, c.href, c.exata) && (!melhor || c.href.length > melhor.tamanho)) {
        melhor = { item, aba: c.aba, tamanho: c.href.length };
      }
    }
  }
  return melhor ? { item: melhor.item, aba: melhor.aba } : null;
}
