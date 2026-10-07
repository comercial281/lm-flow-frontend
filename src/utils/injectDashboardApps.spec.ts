import { describe, it, expect } from 'vitest';
import { Plug } from 'lucide-react';
import type { MenuItem } from '@/components/layout/config/menuItems';
import type { DashboardApp } from '@/types/integrations';
import { injectDashboardAppsIntoMenu } from './injectDashboardApps';

const app = (sidebar_menu: string): DashboardApp => ({
  id: 'a1', title: 'Meu painel', content: [{ type: 'frame', url: 'https://x.test' }],
  display_type: 'sidebar', sidebar_menu: sidebar_menu as DashboardApp['sidebar_menu'], sidebar_position: 'after',
  created_at: '2026-10-07',
});

describe('injectDashboardAppsIntoMenu', () => {
  it('app de painel de "channels" entra depois de Integrações (href /settings/integrations)', () => {
    const menu: MenuItem[] = [{ name: 'Integrações', href: '/settings/integrations', icon: Plug }];
    const r = injectDashboardAppsIntoMenu(menu, [app('channels')]);
    expect(r.map(i => i.name)).toEqual(['Integrações', 'Meu painel']);
  });
});
