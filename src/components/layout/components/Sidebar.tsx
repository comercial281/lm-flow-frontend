import { useLocation } from 'react-router-dom';
import { LifeBuoy } from 'lucide-react';
import { TooltipProvider } from '@/components/ui/ds';
import { cn } from '@/lib/utils';
import MenuItem from './MenuItem';
import MenuSecoes from './MenuSecoes';
import { useGuardaDeSaida } from '@/hooks/useAlteracoesNaoSalvas';
import { itemAtivo, type MenuItem as MenuItemType, type MenuSection } from '../config/menuItems';

// WhatsApp de suporte da Leal Mídia (o mesmo "Preciso de suporte" de antes).
export const SUPORTE_WHATSAPP_URL =
  'https://api.whatsapp.com/send/?phone=553196219989&text=Ol%C3%A1%21+Preciso+de+suporte.&type=phone_number&app_absent=0';

interface SidebarProps {
  isCollapsed: boolean;
  secoes: MenuSection[];
  rodape: MenuItemType[];
}

export default function Sidebar({ isCollapsed, secoes, rodape }: SidebarProps) {
  const { pathname } = useLocation();
  // Fase 3: com alteração não salva na tela, clicar no menu pergunta antes.
  const { aoClicar: guardarSaida, dialogoDeConfirmacao } = useGuardaDeSaida();

  return (
    <>
      <div
        role="complementary"
        aria-label="Menu lateral"
        className={cn(
          'hidden md:flex bg-sidebar text-sidebar-foreground flex-col border-r border-sidebar-border',
          isCollapsed ? 'w-16' : 'w-60',
        )}
      >
        <TooltipProvider delayDuration={300}>
          <nav onClickCapture={guardarSaida} className="flex-1 min-h-0 overflow-y-auto px-2 py-4">
            {isCollapsed ? (
              // Recolhido: só ícones, com um traço entre as seções. Sem seção
              // que abre e fecha — o nome de cada item aparece ao passar o mouse.
              secoes.map((secao, i) => (
                <div key={secao.id} className={cn('space-y-1', i > 0 && 'mt-2 pt-2 border-t border-sidebar-border')}>
                  {secao.itens.map(item => (
                    <MenuItem key={item.id || item.href} item={item} isCollapsed isActive={itemAtivo(item, pathname)} />
                  ))}
                </div>
              ))
            ) : (
              <MenuSecoes secoes={secoes} />
            )}
          </nav>

          {/* Rodapé fixo: Guia do LM Flow e suporte. */}
          <div onClickCapture={guardarSaida} className="px-2 py-2 space-y-1 border-t border-sidebar-border">
            {rodape.map(item => (
              <MenuItem key={item.href} item={item} isCollapsed={isCollapsed} isActive={itemAtivo(item, pathname)} />
            ))}
            <a
              href={SUPORTE_WHATSAPP_URL}
              target="_blank"
              rel="noreferrer"
              title={isCollapsed ? 'Falar com o suporte' : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/80 transition-colors',
                isCollapsed && 'justify-center',
              )}
            >
              <LifeBuoy className="flex-shrink-0" style={{ width: '1.125rem', height: '1.125rem' }} aria-hidden="true" />
              {isCollapsed ? <span className="sr-only">Falar com o suporte</span> : <span className="font-medium text-sm">Falar com o suporte</span>}
            </a>
          </div>
        </TooltipProvider>
      </div>
      {dialogoDeConfirmacao}
    </>
  );
}
