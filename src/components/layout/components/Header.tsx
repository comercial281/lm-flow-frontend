import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Menu,
  PanelRightClose,
  PanelRightOpen,
  Building2,
  Search,
} from 'lucide-react';
import {
  Button,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  ScrollArea,
} from '@/components/ui/ds';
import { useLanguage } from '../../../hooks/useLanguage';
import NotificationBell from '../NotificationBell';
import PlantaoToggle from './PlantaoToggle';
import ProfileMenu from './ProfileMenu';
import { TourFab } from '@/components/TourFab';
import MenuItem from './MenuItem';
import MenuSecoes from './MenuSecoes';
import { useGuardaDeSaida } from '@/hooks/useAlteracoesNaoSalvas';
import { itemAtivo, type MenuItem as MenuItemType, type MenuSection } from '../config/menuItems';
import { ThemeToggle } from '../../ThemeToggle';
import { DemoModeToggle } from '../../DemoModeToggle';
import AdminAreaButton from './AdminAreaButton';
import { AppLogo } from '../../AppLogo';
import { useAppDataStore } from '@/store/appDataStore';

// Utility function for className merging
function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

interface User {
  id: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  avatar_url?: string;
}

interface HeaderProps {
  user: User;
  isCollapsed: boolean;
  isMobileMenuOpen: boolean;
  secoes: MenuSection[];
  rodape: MenuItemType[];
  toggleSidebar: () => void;
  setIsMobileMenuOpen: (open: boolean) => void;
  setLogoutDialogOpen: (open: boolean) => void;
  onOpenSearch?: () => void;
}

export default function Header({
  user,
  isCollapsed,
  isMobileMenuOpen,
  secoes,
  rodape,
  toggleSidebar,
  setIsMobileMenuOpen,
  setLogoutDialogOpen,
  onOpenSearch,
}: HeaderProps) {
  const { t } = useLanguage('layout');
  const { pathname } = useLocation();
  const account = useAppDataStore(state => state.account);
  const fetchAccount = useAppDataStore(state => state.fetchAccount);
  // Fase 3: menu mobile também pergunta antes de sair com alteração não salva.
  const { aoClicar: guardarSaida, dialogoDeConfirmacao } = useGuardaDeSaida();

  // Garante que o nome da conta esteja disponível em qualquer rota
  // (o fetch é cacheado por 15min no appDataStore)
  useEffect(() => {
    fetchAccount().catch(() => {});
  }, [fetchAccount]);

  return (
    <div role="banner" className="flex-shrink-0 bg-sidebar border-b border-sidebar-border px-0 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] flex items-center shadow-sm">
      {/* Mobile Layout */}
      <div className="md:hidden flex items-center w-full px-4">
        {/* Left: Menu Button */}
        <div className="shrink-0 flex justify-start">
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-sidebar-foreground cursor-pointer">
                <Menu className="h-5 w-5" />
                <span className="sr-only">{t('sidebar.openMenu')}</span>
              </Button>
            </SheetTrigger>

            <SheetContent side="left" className="w-80 p-0 !bg-sidebar text-sidebar-foreground">

              <SheetHeader className="border-b border-sidebar-border p-6">
                <SheetTitle className="text-left text-sidebar-foreground">
                  {t('sidebar.navigationMenu')}
                </SheetTitle>
              </SheetHeader>

              <ScrollArea className="flex-1 min-h-0 overflow-hidden p-4">
                <nav onClickCapture={guardarSaida} className="space-y-1">
                  {/* Mesmas seções do computador: uma aberta por vez. */}
                  <MenuSecoes secoes={secoes} mobile aoNavegar={() => setIsMobileMenuOpen(false)} />
                  <div className="mt-3 pt-3 border-t border-sidebar-border space-y-1">
                    {rodape.map(item => (
                      <MenuItem
                        key={item.href}
                        item={item}
                        mobile
                        isActive={itemAtivo(item, pathname)}
                        onClick={() => setIsMobileMenuOpen(false)}
                      />
                    ))}
                  </div>
                </nav>
              </ScrollArea>

              {/* Ações que saíram da barra do topo no mobile (ver comentário no
                  bloco "Right" abaixo): não são urgentes, então moram aqui. */}
              <div className="p-4 border-t border-sidebar-border flex items-center gap-2">
                <ThemeToggle />
                <TourFab />
                <DemoModeToggle />
              </div>

              {/* Mobile User Menu */}
              <ProfileMenu
                user={user}
                mobile
                setLogoutDialogOpen={setLogoutDialogOpen}
                setIsMobileMenuOpen={setIsMobileMenuOpen}
              />
            </SheetContent>
          </Sheet>
        </div>

        {/* Center: Logo + nome da conta */}
        <div className="flex-1 flex justify-center min-w-0">
          <div className="flex flex-col items-center min-w-0">
            <Link to="/dashboard"><AppLogo className="h-8 max-w-32" /></Link>
            {account?.name && (
              <span className="lm-redact text-[11px] font-medium text-muted-foreground truncate max-w-40">
                {account.name}
              </span>
            )}
          </div>
        </div>

        {/* Right: Notifications and User Menu
            NÃO usar flex-1 aqui. Os três blocos eram flex-1 (= 1/3 da tela cada),
            mas 6 ícones não cabem em 1/3 de um celular: com justify-end o excesso
            vazava PRA ESQUERDA, por cima do centro — a lupa montava em cima da
            logo (print do iPhone, 16/07/2026). shrink-0 nas laterais + min-w-0 no
            centro faz o centro ceder espaço em vez de ser invadido.
            TourFab e DemoModeToggle saíram daqui pro menu hambúrguer: não são
            ações urgentes e eram 2 dos 6 ícones brigando por espaço. */}
        <div className="shrink-0 flex justify-end items-center gap-1">
          {onOpenSearch && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onOpenSearch}
              className="text-sidebar-foreground cursor-pointer"
            >
              <Search className="h-5 w-5" />
              <span className="sr-only">Buscar</span>
            </Button>
          )}
          <PlantaoToggle compact />
          <NotificationBell />
          <ProfileMenu
            user={user}
            setLogoutDialogOpen={setLogoutDialogOpen}
          />
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden md:flex items-center w-full">
        {/* Left side - aligned with sidebar */}
        <div
          className={cn(
            'flex items-center justify-between transition-all duration-300 ease-in-out px-4 relative',
            isCollapsed ? 'w-16' : 'w-60',
          )}
        >
          {/* App Logo - only show when not collapsed */}
          {!isCollapsed && (
            <div className="flex-shrink-0 flex items-center gap-2">
              <Link to="/dashboard"><AppLogo className="h-8 max-w-32" /></Link>
            </div>
          )}

          {/* Desktop sidebar toggle - always at the right edge of sidebar area */}
          <div className={cn('flex items-center', isCollapsed ? 'w-full justify-center' : 'ml-auto')}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleSidebar}
                  aria-label={isCollapsed ? t('sidebar.expand') : t('sidebar.collapse')}
                  className="h-8 w-8 text-sidebar-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent flex-shrink-0 cursor-pointer"
                >
                  {isCollapsed ? (
                    <PanelRightClose className="h-4 w-4" />
                  ) : (
                    <PanelRightOpen className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isCollapsed ? t('sidebar.expand') : t('sidebar.collapse')}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Centro: nome da conta do cliente (identifica de quem é o CRM) */}
        <div className="flex-1 flex items-center justify-center min-w-0 px-4">
          {account?.name && (
            <div className="flex items-center gap-2 min-w-0 rounded-md bg-primary/10 px-3 py-1.5">
              <Building2 className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="lm-redact truncate text-sm font-semibold text-sidebar-foreground">
                {account.name}
              </span>
            </div>
          )}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 px-4">
          {onOpenSearch && (
            <button
              type="button"
              onClick={onOpenSearch}
              className="hidden lg:flex items-center gap-2 rounded-md border border-sidebar-border bg-background/50 px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent transition-colors cursor-pointer"
            >
              <Search className="h-4 w-4" />
              <span>Buscar...</span>
              <kbd className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium tracking-wide">
                Ctrl K
              </kbd>
            </button>
          )}
          <TourFab />
          {/* Área do Admin (só super-admin no host raiz) */}
          <AdminAreaButton />
          {/* Theme Toggle */}
          <ThemeToggle />
          {/* Modo Demo (borra dados sensíveis p/ gravar tutoriais) */}
          <DemoModeToggle />
          {/* Modo Plantão (push de lead novo) */}
          <PlantaoToggle />
          {/* Notifications */}
          <NotificationBell />
          {/* User Menu */}
          <ProfileMenu
            user={user}
            setLogoutDialogOpen={setLogoutDialogOpen}
          />
        </div>
      </div>
      {dialogoDeConfirmacao}
    </div>
  );
}
