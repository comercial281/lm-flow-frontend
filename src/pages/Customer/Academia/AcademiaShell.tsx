// Chrome de tela cheia da Área de Membros — reusa o MembersLayout do app
// (mesma marca/tema, sem o CRM em volta) e guarda a config do LM Hub.

import { type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import MembersLayout from '@/components/layout/MembersLayout';
import { LMHUB_CONFIGURED } from '@/lib/supabaseLmHub';

export default function AcademiaShell({ children }: { children: ReactNode }) {
  return (
    <MembersLayout>
      {LMHUB_CONFIGURED ? (
        <div className="flex min-h-full flex-col">{children}</div>
      ) : (
        <div className="flex h-full items-center justify-center p-6">
          <div className="max-w-md bg-card border border-orange-500/40 rounded-xl p-6 flex items-start gap-3">
            <AlertTriangle size={20} className="text-orange-500 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold mb-1">Área de membros indisponível</p>
              <p className="text-muted-foreground text-xs">
                As variáveis <code>VITE_LMHUB_SUPABASE_URL</code> e <code>VITE_LMHUB_SUPABASE_ANON_KEY</code> precisam ser configuradas no deploy deste tenant.
              </p>
            </div>
          </div>
        </div>
      )}
    </MembersLayout>
  );
}
