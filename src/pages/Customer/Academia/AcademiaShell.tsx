// Chrome de tela cheia da Área de Membros — reusa o MembersLayout do app
// (mesma marca/tema, sem o CRM em volta) e guarda a config do LM Hub.

import { type ReactNode } from 'react';
import MembersLayout from '@/components/layout/MembersLayout';
import Aviso from '@/components/base/Aviso';
import { LMHUB_CONFIGURED } from '@/lib/supabaseLmHub';

export default function AcademiaShell({ children }: { children: ReactNode }) {
  return (
    <MembersLayout>
      {LMHUB_CONFIGURED ? (
        <div className="flex min-h-full flex-col">{children}</div>
      ) : (
        <div className="flex h-full items-center justify-center p-6">
          <Aviso tom="atencao" titulo="Área de membros indisponível" className="max-w-md">
            As variáveis <code>VITE_LMHUB_SUPABASE_URL</code> e <code>VITE_LMHUB_SUPABASE_ANON_KEY</code> precisam ser configuradas no deploy do seu LM Flow.
          </Aviso>
        </div>
      )}
    </MembersLayout>
  );
}
