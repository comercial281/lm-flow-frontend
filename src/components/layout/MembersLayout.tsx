import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { AppLogo } from '@/components/AppLogo';
import { ThemeToggle } from '@/components/ThemeToggle';

interface MembersLayoutProps {
  children: React.ReactNode;
}

/**
 * Shell da área de membros (Academia do cliente).
 *
 * De propósito NÃO usa o MainLayout: a ideia é o cliente estudar sem o CRM em
 * volta — sem sidebar, sem notificação, sem plantão. É o padrão de plataforma de
 * curso (Hotmart/Herospark): tela limpa, e uma única porta de volta.
 *
 * Continua atrás do PrivateRoute — área de membros, não página pública.
 */
export default function MembersLayout({ children }: MembersLayoutProps) {
  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="relative flex items-center justify-between gap-3 border-b border-sidebar-border bg-sidebar px-4 py-2.5">
        <Link
          to="/dashboard"
          className="flex items-center gap-1.5 rounded-md border border-sidebar-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Voltar ao CRM</span>
        </Link>

        <div className="pointer-events-none absolute left-1/2 hidden -translate-x-1/2 md:block">
          <AppLogo />
        </div>

        <ThemeToggle />
      </header>

      <main className="min-h-0 flex-1 overflow-auto">{children}</main>
    </div>
  );
}
