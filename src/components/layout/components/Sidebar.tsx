import React from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import { Link, useLocation } from 'react-router-dom';
import { X, EyeOff } from 'lucide-react';
import {
  Button,
  TooltipProvider,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/ds';
import MenuItem from './MenuItem';
import { MenuItem as MenuItemType } from '../config/menuItems';

// Utility function for className merging
function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

interface SidebarProps {
  isCollapsed: boolean;
  menuItems: MenuItemType[];
  activeSubmenu: MenuItemType | null;
  activeMenu: string | null;
  isMenuWithSubItemsActive: (item: MenuItemType) => boolean;
  handleMenuClick: (item: MenuItemType, e: React.MouseEvent) => void;
  setActiveSubmenu: (item: MenuItemType | null) => void;
  onCustomizeMenu?: () => void;
}

export default function Sidebar({
  isCollapsed,
  menuItems,
  activeSubmenu,
  activeMenu,
  isMenuWithSubItemsActive,
  handleMenuClick,
  setActiveSubmenu,
  onCustomizeMenu,
}: SidebarProps) {
  const location = useLocation();
  const pathname = location.pathname;
  const { t } = useLanguage('layout');
  const currentYear = new Date().getFullYear();

  const companyName = t('sidebar.footer.brand');
  const supportWhatsappUrl = 'https://api.whatsapp.com/send/?phone=553196219989&text=Ol%C3%A1%21+Preciso+de+suporte.&type=phone_number&app_absent=0';

  const mainMenuItems = menuItems.filter(item => item.href !== '/tutorials');
  const tutorialsItem = menuItems.find(item => item.href === '/tutorials');

  // [redesign] grupos da sidebar (estética do protótipo). Só rótulo visual —
  // não altera a ordem nem o menu customizável.
  const GROUP_BY_HREF: Record<string, string> = {
    '/dashboard': 'Principal',
    '/conversations': 'Principal',
    '/contacts': 'Principal',
    '/pipelines': 'Principal',
    '/disparos': 'Comercial',
    '/ia-vendedora': 'Comercial',
    '/equipe': 'Comercial',
    '/properties': 'Imobiliário',
    '/visits': 'Imobiliário',
    '/proposals': 'Imobiliário',
    '/contracts': 'Imobiliário',
    '/property-capture-requests': 'Imobiliário',
    '/property-interests': 'Imobiliário',
    '/agents/list': 'Inteligência',
    '/channels': 'Inteligência',
    '/automations': 'Inteligência',
    '/marketplace': 'Inteligência',
  };
  let lastSidebarGroup = '';

  return (
    <>
      {/* Desktop Sidebar */}
      <div
        role="complementary"
        aria-label="Menu lateral"
        className={cn(
          'hidden md:flex bg-sidebar text-sidebar-foreground flex-col border-r border-sidebar-border',
          isCollapsed ? 'w-16' : 'w-56',
        )}
      >
        <TooltipProvider delayDuration={300}>
          {/* Navigation Menu */}
          <nav className="space-y-1.5 flex-1 min-h-0 overflow-y-auto px-2 py-4">
            {mainMenuItems.flatMap(item => {
              const group = GROUP_BY_HREF[item.href] || '';
              const showHeader = !!group && group !== lastSidebarGroup && !isCollapsed;
              if (group) lastSidebarGroup = group;
              const menuNode = (
                <MenuItem
                  key={item.id || item.href}
                  item={item}
                  isCollapsed={isCollapsed}
                  isActive={isMenuWithSubItemsActive(item)}
                  activeMenu={activeMenu}
                  onClick={(e) => handleMenuClick(item, e)}
                />
              );
              return showHeader
                ? [
                    <div
                      key={`group-${group}`}
                      className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40 select-none"
                    >
                      {group}
                    </div>,
                    menuNode,
                  ]
                : [menuNode];
            })}
          </nav>

          {/* Personalizar menu */}
          {onCustomizeMenu && !isCollapsed && (
            <div className="px-2 pb-1">
              <button
                onClick={onCustomizeMenu}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs text-sidebar-foreground/55 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="4" y1="21" y2="14"/><line x1="4" x2="4" y1="10" y2="3"/><line x1="12" x2="12" y1="21" y2="12"/><line x1="12" x2="12" y1="8" y2="3"/><line x1="20" x2="20" y1="21" y2="16"/><line x1="20" x2="20" y1="12" y2="3"/><line x1="2" x2="6" y1="14" y2="14"/><line x1="10" x2="14" y1="8" y2="8"/><line x1="18" x2="22" y1="16" y2="16"/></svg>
                Personalizar menu
              </button>
            </div>
          )}

          {/* Tutorials - fixed at bottom */}
          {tutorialsItem && (
            <div className="px-2 pb-2">
              <MenuItem
                item={tutorialsItem}
                isCollapsed={isCollapsed}
                isActive={pathname === tutorialsItem.href}
                activeMenu={activeMenu}
                onClick={(e) => handleMenuClick(tutorialsItem, e)}
              />
            </div>
          )}

          {/* Sidebar Footer */}
          <div className="p-4 border-t border-sidebar-border">
            {isCollapsed ? (
              <div className="flex flex-col items-center">
                <div className="text-xs text-muted-foreground text-center">© {currentYear}</div>
              </div>
            ) : (
              <>
                <div className="text-sm text-sidebar-foreground font-medium">{companyName}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {t('sidebar.footer.copyright', { year: currentYear })}
                </div>
                <div className="mt-2 flex flex-col gap-1 text-xs">
                  <a
                    href="https://docs.evolutionfoundation.com.br/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {t('sidebar.footer.documentation')}
                  </a>
                  <a
                    href={supportWhatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {t('sidebar.footer.support')}
                  </a>
                </div>
              </>
            )}
          </div>
        </TooltipProvider>
      </div>

      {/* Second Sidebar for Submenus */}
      {activeSubmenu && !isCollapsed && (
        <div className="hidden md:flex w-64 bg-sidebar text-sidebar-foreground flex-col border-r border-sidebar-border">
          {/* Submenu Header */}
          <div className="flex items-center gap-3 p-4 border-b border-sidebar-border">
            <activeSubmenu.icon className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <h3 className="font-semibold text-sidebar-foreground">{activeSubmenu.name}</h3>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setActiveSubmenu(null);
                  }}
                  className="h-8 w-8 p-0 hover:bg-sidebar-accent text-sidebar-foreground hover:text-sidebar-foreground"
                >
                  <X className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>{t('sidebar.closeSubmenu')}</p>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Submenu Items */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {activeSubmenu.subItems?.map(subItem => {
              // For submenu items, check exact match first, then startsWith
              // But if another subitem has a more specific match (longer path), prefer that one
              const exactMatch = pathname === subItem.href;
              const startsWithMatch = pathname.startsWith(subItem.href + '/');

              // Check if any other subitem has a more specific match
              const hasMoreSpecificMatch = activeSubmenu.subItems?.some(otherSubItem =>
                otherSubItem.href !== subItem.href &&
                (pathname === otherSubItem.href || pathname.startsWith(otherSubItem.href + '/')) &&
                otherSubItem.href.length > subItem.href.length
              );

              const isSubActive = exactMatch || (startsWithMatch && !hasMoreSpecificMatch);
              return (
                <Link
                  key={subItem.href}
                  to={subItem.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-md transition-all text-sm',
                    isSubActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                  )}
                >
                  <subItem.icon className={cn('flex-shrink-0 h-4 w-4', isSubActive && 'text-primary')} />
                  <div className="flex items-center gap-2 flex-1">
                    <span className="font-medium">{subItem.name}</span>
                    {subItem.hiddenFromClient && (
                      <span className="flex items-center" title="Oculto pro cliente (você vê como super-admin)">
                        <EyeOff className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" aria-label="Oculto pro cliente" />
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </>
  );
}
