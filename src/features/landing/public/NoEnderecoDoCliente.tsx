// Monta a landing só no endereço do próprio cliente (regra em enderecoDaLanding.ts).
// Usado pela entrada enxuta (src/lp) e pelas rotas antigas do CRM. Sem roteador
// e sem nada do CRM aqui: a entrada enxuta importa este arquivo.
import { useEffect, type ReactNode } from 'react';
import { enderecoDaLanding } from './enderecoDaLanding';

export function LandingIndisponivel() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0F0520] px-6 text-center text-neutral-400">
      Esta página não está disponível.
    </div>
  );
}

export function NoEnderecoDoCliente({ tenant, children }: { tenant: string; children: ReactNode }) {
  const decisao = enderecoDaLanding(window.location, tenant);
  const destino = decisao.tipo === 'redirecionar' ? decisao.url : null;

  useEffect(() => {
    if (destino) window.location.replace(destino);
  }, [destino]);

  if (decisao.tipo === 'indisponivel') return <LandingIndisponivel />;
  if (destino) return null;
  return <>{children}</>;
}
