'use client';

import { Button } from '@/components/ui/ds';
import { LogOut } from 'lucide-react';

// Barra vermelha do admin master: aparece SÓ quando você entrou no CRM de um
// cliente pelo painel "Clientes CRM" (SSO 1-clique). Lê o marcador de sessão
// gravado em masterSso.consumeMasterSso(). Cliente normal nunca vê isso.
export default function ImpersonationBar() {
  const client = typeof window !== 'undefined' ? sessionStorage.getItem('lm_master_client') : null;
  const rootUrl = typeof window !== 'undefined' ? sessionStorage.getItem('lm_master_root') : null;

  if (!client) return null;

  const back = () => {
    sessionStorage.removeItem('lm_master_client');
    sessionStorage.removeItem('lm_master_root');
    window.location.href = rootUrl || '/';
  };

  return (
    <div className="bg-red-600 text-white py-2 px-4 sticky top-0 z-[100] shadow-md">
      <div className="mx-auto flex justify-between items-center gap-3 max-w-full">
        <p className="text-sm font-medium truncate">
          Você está no CRM de <span className="font-bold">{client}</span>
          <span className="opacity-80"> · admin master</span>
        </p>
        <Button
          onClick={back}
          size="sm"
          className="bg-white text-red-700 hover:bg-red-50 flex items-center gap-2 shrink-0"
        >
          <LogOut className="h-4 w-4" />
          Voltar ao painel master
        </Button>
      </div>
    </div>
  );
}
