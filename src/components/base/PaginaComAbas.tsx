import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Abas from '@/components/base/Abas';
import { useMenuSecoes } from '@/contexts/MenuContext';
import { donoDoEndereco } from '@/components/layout/config/menuItems';

// ── PÁGINA COM ABAS (fase 4) ─────────────────────────────────────────────────
//
// Moldura das páginas que juntam várias telas sob um assunto (Integrações,
// Bolsão, Fluxos de mensagem, Automações, Campos personalizados). Entra como
// rota-moldura SEM endereço próprio: as telas de dentro mantêm o endereço que
// já tinham, então link salvo e link com filtro continuam valendo.
//
// Título e abas vêm do item do menu dono do endereço, na lista JÁ filtrada pelo
// cargo (MenuContext). Aba que a pessoa não pode abrir não aparece. Com uma aba
// só, a moldura não desenha nada: a tela de dentro já tem o próprio título, e
// uma fileira com uma aba é ruído. É o caso do corretor no Bolsão, e dele em
// "Meus números" (a aba WhatsApp de Integrações é de gestor).
export default function PaginaComAbas() {
  const secoes = useMenuSecoes();
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  // O <main> é o mesmo elemento entre trocas de aba (só o Outlet muda): sem
  // isto, o scroll de uma aba larga fica na posição antiga ao entrar numa mais
  // estreita, e o conteúdo novo parece sumido.
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [pathname]);

  const dono = donoDoEndereco(secoes, pathname);
  const abas = dono?.aba ? dono.item.abas ?? [] : [];

  if (!dono || abas.length < 2) return <Outlet />;

  const Icone = dono.item.icon;
  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border px-6 pt-4">
        <div className="flex items-center gap-2 mb-3">
          <Icone className="h-5 w-5 text-primary" aria-hidden="true" />
          <h1 className="text-lg font-semibold">{dono.item.name}</h1>
        </div>
        {/* Trocar de aba com alteração não salva pergunta antes (Abas da casa). */}
        <Abas
          rotulo={`Abas de ${dono.item.name}`}
          abas={abas.map(aba => ({ chave: aba.href, rotulo: aba.name, icone: aba.icon, para: aba.href, exata: aba.exata }))}
        />
      </div>
      <main ref={mainRef} className="flex-1 min-w-0 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
