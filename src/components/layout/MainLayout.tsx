import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { menuRecolhido, ROTA_CONVERSAS } from './menuRecolhidoEm';
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
  getCustomerMenuSections,
  getFooterMenuItems,
  filterMenuSections,
  filterMenuItemsByPermissions,
} from './config/menuItems';
import { MenuProvider } from '@/contexts/MenuContext';

import { useLanguage } from '../../hooks/useLanguage';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '@/contexts/PermissionsContext';
import { useTenantFeatures } from '@/contexts/TenantFeaturesContext';
import { useIsSuperAdmin } from '@/hooks/useIsSuperAdmin';
import { useKeyboardInsetVar } from '@/hooks/useKeyboardInset';
import { useDashboardApps } from '@/hooks/useDashboardApps';
import { useRoutePrefetch } from '@/hooks/useRoutePrefetch';
import { injectDashboardAppsIntoMenu } from '@/utils/injectDashboardApps';
import InstallAppPrompt from './components/InstallAppPrompt';
import PendingOffersBanner from '@/components/roleta/PendingOffersBanner';
import { PendingOffersProvider } from '@/contexts/PendingOffersContext';
import { WelcomeTourModal } from '@/components/WelcomeTourModal';
import GlobalCommandPalette from '@/components/command-palette/GlobalCommandPalette';
import FeedbackWidget from '@/components/feedback/FeedbackWidget';

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const { t } = useLanguage('layout');
  const { user, logout } = useAuth();
  const { can, canAny, canAll } = usePermissions();
  const { features: tenantFeatures, archivedKeys } = useTenantFeatures();
  // Suporte da Leal Mídia (Fase 1 — Cargos): vem do servidor, não do e-mail.
  const isSupport = useIsSuperAdmin();
  const navigate = useNavigate();

  // Mantém --keyboard-inset atualizada para a casca encolher com o teclado
  // do celular (ver a altura do container abaixo).
  useKeyboardInsetVar();

  // Prefetch ocioso dos chunks das páginas do menu principal — MainLayout só
  // monta com usuário autenticado, então a rota real já passou pelo
  // PrivateRoute/CustomerRoute (ver src/routes/index.tsx). Ver
  // src/hooks/useRoutePrefetch.ts.
  useRoutePrefetch(!!user);


  // Estados do layout
  // `salvo` é a preferência da pessoa (gravada). Em Conversas o menu recolhe
  // sozinho, sem mexer nela; `escolhaNaVisita` guarda só o clique da visita.
  const [salvo, setSalvo] = useState(false);
  const [escolhaNaVisita, setEscolhaNaVisita] = useState<boolean | null>(null);
  const emConversas = ROTA_CONVERSAS.test(useLocation().pathname);
  const isCollapsed = menuRecolhido({ salvo, emConversas, escolhaNaVisita });
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

  // Ao sair de Conversas a escolha da visita some.
  useEffect(() => {
    if (!emConversas) setEscolhaNaVisita(null);
  }, [emConversas]);

  // Load saved sidebar state
  useEffect(() => {
    const savedState = localStorage.getItem('sidebar-collapsed');
    if (savedState) {
      setSalvo(JSON.parse(savedState));
    }
  }, []);

  // Save sidebar state
  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', JSON.stringify(salvo));
  }, [salvo]);

  // Menu em seções (fase 4), já filtrado por cargo, função do cliente e
  // arquivamento. A MESMA lista desenha o menu, a gaveta do celular, a busca e
  // as abas das páginas (MenuContext) — nunca discordam.
  const regras = [can, canAny, canAll, user?.role?.key, user?.email, tenantFeatures, archivedKeys, isSupport] as const;
  const secoes = useMemo(() => {
    const filtradas = filterMenuSections(getCustomerMenuSections(), ...regras);
    if (dashboardApps.length === 0) return filtradas;
    return filtradas.map(secao => ({ ...secao, itens: injectDashboardAppsIntoMenu(secao.itens, dashboardApps) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboardApps, ...regras]);
  const rodape = useMemo(
    () => filterMenuItemsByPermissions(getFooterMenuItems(), ...regras),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    regras,
  );
  const itensParaBusca = useMemo(() => [...secoes.flatMap(s => s.itens), ...rodape], [secoes, rodape]);

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
    if (emConversas) setEscolhaNaVisita(!isCollapsed);
    else setSalvo(!salvo);
  };

  // Se não há usuário, não renderizar o layout
  if (!user) {
    return <div className="flex h-screen items-center justify-center">{t('common.loading')}</div>;
  }

  return (
    // `dvh`, não `vh`: no celular o `vh` ignora a barra de endereço do
    // navegador, então o rodapé da tela (a barra de digitar do chat, por
    // exemplo) fica embaixo dela. Mesmo motivo do `max-h-[92dvh]` em ds.tsx.
    //
    // E menos --keyboard-inset: este é o ÚNICO nó que manda na altura do
    // viewport — tudo abaixo é flex-1/min-h-0 — então encolher só ele faz a
    // barra de digitar subir junto com o teclado e a lista de mensagens
    // encolher, sem mais nenhuma mudança de layout. Com o teclado fechado a
    // variável é 0px e a conta vira 100dvh, idêntico ao que era.
    // Sem transição na altura de propósito: animar faria a barra chegar
    // atrasada em relação ao teclado (`transition-colors` só afeta cores).
    <PendingOffersProvider>
    <div className="flex flex-col h-[calc(100dvh-var(--keyboard-inset,0px))] bg-background transition-colors duration-150 ease-in-out">

      {/* Ofertas da roleta esperando aceite — só aparece quando há alguma */}
      <PendingOffersBanner />

      {/* Header */}
      <Header
        user={user}
        isCollapsed={isCollapsed}
        isMobileMenuOpen={isMobileMenuOpen}
        secoes={secoes}
        rodape={rodape}
        toggleSidebar={toggleSidebar}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        setLogoutDialogOpen={setLogoutDialogOpen}
        onOpenSearch={() => setCommandOpen(true)}
      />

      {/* Main Layout Container */}
      <div className="flex flex-1 min-h-0 transition-colors duration-150 ease-in-out">
        {/* Sidebar */}
        <Sidebar isCollapsed={isCollapsed} secoes={secoes} rodape={rodape} />

        {/* Main Content — as páginas com abas leem o menu filtrado daqui. */}
        <main className="flex-1 overflow-auto bg-background transition-colors duration-150 ease-in-out">
          <MenuProvider value={secoes}>
            <div className="h-full">{children}</div>
          </MenuProvider>
        </main>

      </div>

      {/* Busca global (Cmd+K) */}
      <GlobalCommandPalette
        open={commandOpen}
        onOpenChange={setCommandOpen}
        menuItems={itensParaBusca}
      />

      {/* Tour */}
      <WelcomeTourModal />

      {/* Instalar app (PWA) na tela inicial */}
      <InstallAppPrompt />

      {/* Botão flutuante de Sugestões/Bugs (cai na aba do admin) */}
      <FeedbackWidget />

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
    </div>
    </PendingOffersProvider>
  );
}
