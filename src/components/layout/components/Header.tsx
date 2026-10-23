import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Menu,
  PanelRightClose,
  PanelRightOpen,
  Building2,
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
import MenuSecoes from './MenuSecoes';
import { useGuardaDeSaida } from '@/hooks/useAlteracoesNaoSalvas';
import { secoesDoCelular, type MenuItem as MenuItemType, type MenuSection } from '../config/menuItems';
import { useCan } from '@/hooks/useCan';
import RodapeDoMenu from './RodapeDoMenu';
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
}: HeaderProps) {
  const { t } = useLanguage('layout');
  const account = useAppDataStore(state => state.account);
  const fetchAccount = useAppDataStore(state => state.fetchAccount);
  // Fase 3: menu mobile também pergunta antes de sair com alteração não salva.
  const { aoClicar: guardarSaida, dialogoDeConfirmacao } = useGuardaDeSaida();
  // Gaveta do celular: aba com `celularPede` só pra quem tem a chave (suporte vê tudo, pelo useCan).
  const pode = useCan();
  const podeAlguma = (permissoes: string[]) => permissoes.some(p => {
    const [recurso, acao] = p.split('.');
    return pode(recurso, acao);
  });

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
                  {/* Mesmas seções do computador (uma aberta por vez), sem as
                      telas de montar/configurar (Raio-X do celular, 10/10/2026). */}
                  <MenuSecoes secoes={secoesDoCelular(secoes, podeAlguma)} mobile aoNavegar={() => setIsMobileMenuOpen(false)} />
                  {/* Mesma fileira de ícones do rodapé do computador. */}
                  <div className="mt-3 pt-3 border-t border-sidebar-border">
                    <RodapeDoMenu itens={rodape} aoNavegar={() => setIsMobileMenuOpen(false)} />
                  </div>
                </nav>
              </ScrollArea>

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
            <Link to="/dashboard"><AppLogo className="h-7" /></Link>
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
            DemoModeToggle saiu daqui pro menu hambúrguer (não é ação urgente).
            O botão do tour saiu de vez em 19/10/2026, junto com o tour antigo.
            A lupa saiu em 15/10/2026 (topo enxuto, pedido do dono). */}
        <div className="shrink-0 flex justify-end items-center gap-1">
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
            'flex items-center justify-between transition-[width] duration-200 ease-out motion-reduce:transition-none overflow-hidden px-4 relative',
            isCollapsed ? 'w-16' : 'w-60',
          )}
        >
          {/* App Logo - only show when not collapsed */}
          {!isCollapsed && (
            <div className="flex-shrink-0 flex items-center gap-2">
              <Link to="/dashboard"><AppLogo className="h-7" /></Link>
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

        {/* Centro: nome da conta do cliente (identifica de quem é o CRM).
            Com o menu aberto, o cartão da conta no topo do menu já mostra o
            nome, então aqui só aparece com o menu recolhido (onde o cartão some). */}
        <div className="flex-1 flex items-center justify-center min-w-0 px-4">
          {isCollapsed && account?.name && (
            <div className="flex items-center gap-2 min-w-0 rounded-md bg-primary/10 px-3 py-1.5 animate-in fade-in duration-200 motion-reduce:animate-none">
              <Building2 className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="lm-redact truncate text-sm font-semibold text-sidebar-foreground">
                {account.name}
              </span>
            </div>
          )}
        </div>

        {/* Right side
            Topo enxuto (15/10/2026, pedido do dono, "por enquanto"): a barra
            "Buscar... Ctrl K" e o ? do tour saíram; tema e modo demo foram pro
            rodapé do menu lateral (Sidebar). O Ctrl+K continua no MainLayout. */}
        <div className="flex items-center gap-2 px-4">
          {/* Área do Admin (só super-admin no host raiz) */}
          <AdminAreaButton />
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
