import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import { DemoModeToggle } from '@/components/DemoModeToggle';
import ProfileMenu from './components/ProfileMenu';
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
import { ADMIN_MENU_ITEMS } from './config/adminMenuItems';

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

interface AdminLayoutProps {
  children: React.ReactNode;
}

/**
 * Shell da Área do Admin — separado do MainLayout de propósito.
 *
 * O ponto da separação: dentro do CRM o Giovani parece um usuário do cliente,
 * com o menu do cliente na frente. Aqui o app inteiro troca — menu próprio,
 * sem MenuCustomizer, sem dashboard apps, sem tour. A única ponte de volta é o
 * botão "Voltar ao CRM".
 *
 * O gate (host raiz + super-admin) NÃO mora aqui: fica no SuperAdminRoute, em
 * routes/index.tsx, que envolve este layout.
 */
export default function AdminLayout({ children }: AdminLayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);

  const handleLogout = async () => {
    setLogoutDialogOpen(false);
    toast.loading('Saindo...', { id: 'logout' });
    try {
      await logout();
      toast.success('Até mais.', { id: 'logout' });
      navigate('/login');
    } catch {
      toast.error('Erro ao sair.', { id: 'logout' });
    }
  };

  if (!user) {
    return <div className="flex h-screen items-center justify-center">Carregando...</div>;
  }

  const isActive = (href: string) =>
    href === '/admin' ? location.pathname === '/admin' : location.pathname.startsWith(href);

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header próprio — barra violeta marca que você NÃO está no CRM */}
      <header className="flex items-center justify-between gap-3 border-b border-sidebar-border bg-sidebar px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-md bg-gradient-to-r from-[#7C3AED] to-[#9333EA] px-3 py-1.5">
            <ShieldCheck className="h-4 w-4 text-white" />
            <span className="text-sm font-semibold tracking-wide text-white">ÁREA DO ADMIN</span>
          </div>
          <span className="hidden text-xs text-muted-foreground sm:inline">Leal Mídia</span>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/dashboard"
            className="flex items-center gap-1.5 rounded-md border border-sidebar-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Voltar ao CRM</span>
          </Link>
          <ThemeToggle />
          <DemoModeToggle />
          <ProfileMenu user={user} setLogoutDialogOpen={setLogoutDialogOpen} />
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar do admin */}
        <nav
          role="navigation"
          aria-label="Menu da Área do Admin"
          className="hidden w-56 flex-col border-r border-sidebar-border bg-sidebar px-2 py-4 md:flex"
        >
          <div className="space-y-1">
            {ADMIN_MENU_ITEMS.map(item => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  title={item.description}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors',
                    active
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  <item.icon className={cn('h-4 w-4 flex-shrink-0', active && 'text-primary')} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>

          <div className="mt-auto border-t border-sidebar-border p-3">
            <p className="text-xs text-muted-foreground">
              Você está no painel da Leal Mídia. O que você faz aqui afeta os clientes.
            </p>
          </div>
        </nav>

        <main className="flex-1 overflow-auto bg-background">
          {/* Menu horizontal no mobile (a sidebar some) */}
          <div className="flex gap-1 overflow-x-auto border-b border-sidebar-border bg-sidebar px-2 py-1.5 md:hidden">
            {ADMIN_MENU_ITEMS.map(item => (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  'whitespace-nowrap rounded-md px-3 py-1.5 text-xs transition-colors',
                  isActive(item.href)
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-accent',
                )}
              >
                {item.name}
              </Link>
            ))}
          </div>
          <div className="h-full">{children}</div>
        </main>
      </div>

      <Dialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader className="text-left space-y-2">
            <DialogTitle className="text-lg font-semibold">Sair da conta</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Você vai precisar entrar de novo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setLogoutDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleLogout}>Sair</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
