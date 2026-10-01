import { useLocation } from 'react-router-dom';
import { LifeBuoy } from 'lucide-react';
import { TooltipProvider } from '@/components/ui/ds';
import { cn } from '@/lib/utils';
import MenuItem from './MenuItem';
import MenuSecoes from './MenuSecoes';
import { useGuardaDeSaida } from '@/hooks/useAlteracoesNaoSalvas';
import { useAppDataStore } from '@/store/appDataStore';
import { useAuth } from '@/contexts/AuthContext';
import { itemAtivo, type MenuItem as MenuItemType, type MenuSection } from '../config/menuItems';

// WhatsApp de suporte da Leal Mídia (o mesmo "Preciso de suporte" de antes).
export const SUPORTE_WHATSAPP_URL =
  'https://api.whatsapp.com/send/?phone=553196219989&text=Ol%C3%A1%21+Preciso+de+suporte.&type=phone_number&app_absent=0';

/**
 * Cartão da conta no topo do menu (como a Lais): o nome da imobiliária e o
 * cargo de quem está usando. O nome vem do mesmo cache que o celular mostra no
 * topo (o Header busca a conta ao montar). Some no menu recolhido.
 */
function CartaoDaConta() {
  const account = useAppDataStore(state => state.account);
  const { user } = useAuth();
  if (!account?.name) return null;
  const cargo = user?.role?.name;
  return (
    <div className="mb-4 rounded-xl bg-sidebar-accent/60 px-3 py-2.5">
      <p className="lm-redact text-sm font-semibold text-sidebar-foreground truncate" title={account.name}>
        {account.name}
      </p>
      {cargo && <p className="text-xs text-muted-foreground truncate">{cargo}</p>}
    </div>
  );
}

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
          {/* Uma coluna só, que rola inteira quando passa da tela: cartão da
              conta, seções e rodapé em sequência. O rodapé vem logo depois do
              último bloco, sem ficar preso no fundo (era o vão embaixo de
              Minha imobiliária). */}
          <nav onClickCapture={guardarSaida} className="flex-1 min-h-0 overflow-y-auto px-3 py-4">
            {!isCollapsed && <CartaoDaConta />}
            {isCollapsed ? (
              // Recolhido: só ícones, com um traço entre as seções. Sem seção
              // que abre e fecha — o nome de cada item aparece ao passar o mouse.
              secoes.map((secao, i) => (
                <div key={secao.id} className={cn('space-y-1', i > 0 && 'mt-3 pt-3 border-t border-sidebar-border')}>
                  {secao.itens.map(item => (
                    <MenuItem key={item.id || item.href} item={item} isCollapsed isActive={itemAtivo(item, pathname)} />
                  ))}
                </div>
              ))
            ) : (
              <MenuSecoes secoes={secoes} />
            )}

            {/* Rodapé: Guia do LM Flow e suporte, depois de um divisor. */}
            <div className="mt-3 pt-3 space-y-1 border-t border-sidebar-border">
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
          </nav>
        </TooltipProvider>
      </div>
      {dialogoDeConfirmacao}
    </>
  );
}
