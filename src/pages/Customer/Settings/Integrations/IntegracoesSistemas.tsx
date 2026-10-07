import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMenuSecoes } from '@/contexts/MenuContext';
import { openSupport } from '@/components/support/openSupport';
import { cvcrmService, type CvcrmStatus } from '@/services/cvcrm/cvcrmService';
import type { SubMenuItem } from '@/components/layout/config/menuItems';
import { itemDeIntegracoes, NENHUMA_INTEGRACAO } from './cartoes';
import SeloDoCartao from './SeloDoCartao';

// Integrações → Sistemas (07/10/2026): os sistemas do cliente pra onde a IA manda
// o lead. Um cartão por tela marcada `cartao: 'sistemas'` no menu (hoje só o
// CVCRM). Sistema novo = mais uma tela no menu, nada muda aqui além do estado.
// Sem "em breve" com nome de sistema (decisão do dono, 07/10): vira promessa.

export function estadoDoCvcrm(s: CvcrmStatus): string {
  if (!s.connected) return 'Não conectado';
  if (s.token_state === 'unreadable') return 'Precisa de um token novo';
  return `Conectado · ${s.subdomain}.cvcrm.com.br`;
}

// Estado embaixo do nome. Falhou = sem estado (a tela de conexão mostra o erro).
function useEstado(href: string): string | null {
  const [estado, setEstado] = useState<string | null>(null);
  useEffect(() => {
    if (href !== '/settings/cvcrm') return;
    let vivo = true;
    cvcrmService.get()
      .then((s) => { if (vivo) setEstado(estadoDoCvcrm(s)); })
      .catch(() => {});
    return () => { vivo = false; };
  }, [href]);
  return estado;
}

function CartaoDeSistema({ tela }: { tela: SubMenuItem }) {
  const estado = useEstado(tela.href);
  return (
    <Link
      to={tela.href}
      className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/60 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <SeloDoCartao icone={tela.icon} tamanho="grande" />
      <span className="flex flex-col">
        <span className="font-semibold text-foreground">{tela.name}</span>
        {estado && <span className="text-sm text-muted-foreground">{estado}</span>}
      </span>
    </Link>
  );
}

export default function IntegracoesSistemas() {
  const sistemas = (itemDeIntegracoes(useMenuSecoes())?.abas ?? []).filter(t => t.cartao === 'sistemas');

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <p className="text-sm text-muted-foreground">Leve os leads direto pro sistema que sua imobiliária já usa.</p>

      {sistemas.length === 0 ? (
        <p className="text-sm text-muted-foreground">{NENHUMA_INTEGRACAO}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {sistemas.map(tela => <li key={tela.href}><CartaoDeSistema tela={tela} /></li>)}
        </ul>
      )}

      <p className="text-sm text-muted-foreground">
        Usa outro sistema?{' '}
        <button type="button" className="text-primary underline" onClick={() => openSupport()}>
          Fale com o suporte
        </button>
      </p>
    </div>
  );
}
