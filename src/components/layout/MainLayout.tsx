import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/ds';
import { toast } from 'sonner';
import { Header, Sidebar } from './components';
import {
  getCustomerMenuItems,
  MenuItem as MenuItemType,
  filterMenuItemsByPermissions,
} from './config/menuItems';

import { useLanguage } from '../../hooks/useLanguage';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '@/contexts/PermissionsContext';
import { useTenantFeatures } from '@/contexts/TenantFeaturesContext';
import { useMenuState } from '@/hooks/useMenuState';
import { useDashboardApps } from '@/hooks/useDashboardApps';
import { injectDashboardAppsIntoMenu } from '@/utils/injectDashboardApps';
import { applyMenuPrefs, MENU_PREFS_EVENT } from './config/menuPrefs';
import MenuCustomizer from './components/MenuCustomizer';
import InstallAppPrompt from './components/InstallAppPrompt';
import ClientModeBar from './ClientModeBar';
import { WelcomeTourModal } from '@/components/WelcomeTourModal';
import GlobalCommandPalette from '@/components/command-palette/GlobalCommandPalette';

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const { t } = useLanguage('layout');
  const { user, logout } = useAuth();
  const { can, canAny, canAll } = usePermissions();
  const { features: tenantFeatures } = useTenantFeatures();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuPrefsVersion, setMenuPrefsVersion] = useState(0);
  const [showMenuCustomizer, setShowMenuCustomizer] = useState(false);

  useEffect(() => {
    const onPrefs = () => setMenuPrefsVersion(v => v + 1);
    window.addEventListener(MENU_PREFS_EVENT, onPrefs);
    return () => window.removeEventListener(MENU_PREFS_EVENT, onPrefs);
  }, []);
  const pathname = location.pathname;

  // Estados do layout
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  // Atalho global Cmd+K (Mac) / Ctrl+K (Windows) abre a busca global.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setCommandOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Load dashboard apps for sidebar integration
  const { apps: dashboardApps } = useDashboardApps({
    autoLoad: true,
    loadDelay: 1000, // Defer slightly to not block initial render
  });

  // Load saved sidebar state
  useEffect(() => {
    const savedState = localStorage.getItem('sidebar-collapsed');
    if (savedState) {
      setIsCollapsed(JSON.parse(savedState));
    }
  }, []);

  // Save sidebar state
  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  // Menu items baseado no tipo de usuário e rota atual
  const getMenuItems = useCallback((): MenuItemType[] => {
    return getCustomerMenuItems(t);
  }, [t]);

  // Itens permitidos (filtrados por permissão) — usados pelo editor de menu.
  const permittedMenuItems = useMemo(() => {
    const rawMenuItems = getMenuItems();
    let finalItems = filterMenuItemsByPermissions(rawMenuItems, can, canAny, canAll, user?.role?.key, user?.email, tenantFeatures);

    if (dashboardApps.length > 0) {
      finalItems = injectDashboardAppsIntoMenu(finalItems, dashboardApps);
    }

    return finalItems;
  }, [getMenuItems, can, canAny, canAll, dashboardApps, user?.role?.key, user?.email, tenantFeatures]);

  // Aplica as preferências do usuário (esconder/favoritar/ordenar) por cima.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const menuItems = useMemo(() => applyMenuPrefs(permittedMenuItems), [permittedMenuItems, menuPrefsVersion]);

  // Use the custom menu state hook
  const menuState = useMenuState(menuItems, setIsMobileMenuOpen);

  const handleLogout = async () => {
    setLogoutDialogOpen(false);

    toast.loading(t('logout.loggingOut'), { id: 'logout' });

    await new Promise(resolve => setTimeout(resolve, 800));

    try {
      await logout(); // Now await the async logout function
      toast.success(t('logout.success'), { id: 'logout' });
      await new Promise(resolve => setTimeout(resolve, 500));
      navigate('/login');
    } catch {
      toast.error(t('logout.error'), { id: 'logout' });
    }
  };

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  // Se não há usuário, não renderizar o layout
  if (!user) {
    return <div className="flex h-screen items-center justify-center">{t('common.loading')}</div>;
  }

  return (
    <div className="flex flex-col h-screen bg-background transition-colors duration-150 ease-in-out">

      {/* Barra do Modo Cliente (super-admin) — só aparece quando ativo */}
      <ClientModeBar />

      {/* Header */}
      <Header
        user={user}
        isCollapsed={isCollapsed}
        isMobileMenuOpen={isMobileMenuOpen}
        menuItems={menuItems}
        activeMenu={menuState.activeMenu}
        pathname={pathname}
        toggleSidebar={toggleSidebar}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        setLogoutDialogOpen={setLogoutDialogOpen}
        isMenuItemActive={menuState.isMenuItemActive}
        isMenuWithSubItemsActive={menuState.isMenuWithSubItemsActive}
        handleMenuClick={menuState.handleMenuClick}
        onOpenSearch={() => setCommandOpen(true)}
      />

      {/* Main Layout Container */}
      <div className="flex flex-1 min-h-0 transition-colors duration-150 ease-in-out">
        {/* Sidebar */}
        <Sidebar
          isCollapsed={isCollapsed}
          menuItems={menuItems}
          activeSubmenu={menuState.activeSubmenu}
          activeMenu={menuState.activeMenu}
          isMenuWithSubItemsActive={menuState.isMenuWithSubItemsActive}
          handleMenuClick={menuState.handleMenuClick}
          setActiveSubmenu={menuState.setActiveSubmenu}
          onCustomizeMenu={() => setShowMenuCustomizer(true)}
        />

        {/* Main Content */}
        <main className="flex-1 overflow-auto bg-background transition-colors duration-150 ease-in-out">
          <div className="h-full">{children}</div>
        </main>

      </div>

      {/* Busca global (Cmd+K) */}
      <GlobalCommandPalette
        open={commandOpen}
        onOpenChange={setCommandOpen}
        menuItems={menuItems}
      />

      {/* Tour */}
      <WelcomeTourModal />

      {/* Instalar app (PWA) na tela inicial */}
      <InstallAppPrompt />

      {/* Logout Dialog */}
      <Dialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader className="text-left space-y-2">
            <DialogTitle className="text-lg font-semibold">{t('logout.title')}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {t('logout.description')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setLogoutDialogOpen(false)}>
              {t('logout.cancel')}
            </Button>
            <Button onClick={handleLogout}>{t('logout.confirm')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Personalizar menu */}
      {showMenuCustomizer && (
        <MenuCustomizer items={permittedMenuItems} onClose={() => setShowMenuCustomizer(false)} />
      )}
    </div>
  );
}
