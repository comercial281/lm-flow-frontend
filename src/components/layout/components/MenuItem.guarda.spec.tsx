import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MenuItem from './MenuItem';
import { MenuItem as MenuItemType } from '../config/menuItems';
import { Users, Settings } from 'lucide-react';

describe('MenuItem — atributo data-abre-submenu', () => {
  const createItem = (href: string, subItems: MenuItemType[] | undefined = undefined): MenuItemType => ({
    id: `item-${href}`,
    name: 'Test Item',
    href,
    icon: Users,
    subItems,
  });

  it('item com subItems e href "#" → data-abre-submenu presente', () => {
    const subItem = createItem('/sub1');
    const item = createItem('#', [subItem]);
    render(
      <MemoryRouter>
        <MenuItem
          item={item}
          isActive={false}
          activeMenu={null}
          onClick={() => {}}
        />
      </MemoryRouter>,
    );
    const link = screen.getByRole('link');
    expect(link.hasAttribute('data-abre-submenu')).toBe(true);
    expect(link.getAttribute('data-abre-submenu')).toBe('');
  });

  it('item com subItems e href "/contacts" → data-abre-submenu ausente', () => {
    const subItem = createItem('/contacts/sub');
    const item = createItem('/contacts', [subItem]);
    render(
      <MemoryRouter>
        <MenuItem
          item={item}
          isActive={false}
          activeMenu={null}
          onClick={() => {}}
        />
      </MemoryRouter>,
    );
    const link = screen.getByRole('link');
    expect(link.hasAttribute('data-abre-submenu')).toBe(false);
  });

  it('item sem subItems → data-abre-submenu ausente', () => {
    const item = createItem('/dashboard');
    render(
      <MemoryRouter>
        <MenuItem
          item={item}
          isActive={false}
          activeMenu={null}
          onClick={() => {}}
        />
      </MemoryRouter>,
    );
    const link = screen.getByRole('link');
    expect(link.hasAttribute('data-abre-submenu')).toBe(false);
  });
});
