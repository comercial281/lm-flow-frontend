import { useLocation } from 'react-router-dom';
import { LifeBuoy } from 'lucide-react';
import { TooltipProvider } from '@/components/ui/ds';
import { cn } from '@/lib/utils';
import MenuItem from './MenuItem';
import MenuRecolhido from './MenuRecolhido';
import MenuSecoes from './MenuSecoes';
import { useGuardaDeSaida } from '@/hooks/useAlteracoesNaoSalvas';
import { useAppDataStore } from '@/store/appDataStore';
import { useAuth } from '@/contexts/AuthContext';
import { useMenuRecolhidoAtrasado } from '../menuRecolhidoAtrasado';
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
    // "Vidro roxo": gradiente da marca bem vazado + borda e sombra roxas suaves.
    // Fica abaixo do item ativo do menu (gradiente cheio) na hierarquia.
    <div className="mb-4 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent px-3 py-2.5 shadow-[0_6px_16px_-8px_rgba(124,58,237,0.45)]">
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
  // A largura segue `isCollapsed` na hora; o conteúdo só vira "recolhido" quando a
  // largura termina de fechar (ao abrir, na hora). Ver armadilha 8 no CLAUDE.md.
  const recolhido = useMenuRecolhidoAtrasado(isCollapsed);

  return (
    <>
      <div
        role="complementary"
        aria-label="Menu lateral"
        className={cn(
          'hidden md:flex bg-sidebar text-sidebar-foreground flex-col border-r border-sidebar-border',
          // Abre e fecha com movimento (200 ms). overflow-hidden corta o que passa da
          // largura enquanto ela muda; sem animação para quem pede menos movimento.
          'overflow-hidden transition-[width] duration-200 ease-out motion-reduce:transition-none',
          isCollapsed ? 'w-16' : 'w-60',
        )}
      >
        <TooltipProvider delayDuration={300}>
          {/* Uma coluna só, que rola inteira quando passa da tela: cartão da
              conta, seções e rodapé em sequência. O rodapé vem logo depois do
              último bloco, sem ficar preso no fundo (era o vão embaixo de
              Minha imobiliária). O espaço da barra de rolagem fica reservado
              sempre (scrollbar-gutter), senão o menu estreita ao abrir uma
              seção que faz a lista passar da tela. Só no aberto: no recolhido
              (w-16) a reserva espremeria os ícones. */}
          <nav
            onClickCapture={guardarSaida}
            // Largura própria e fixa (a do estado final): o conteúdo já nasce no tamanho
            // certo e o container só o revela, então rótulo nenhum quebra de linha no meio
            // do movimento.
            className={cn(
              'flex-1 min-h-0 overflow-y-auto px-3 py-4 shrink-0',
              // -1px: a borda do container come 1px da largura; sem isso o nav corta.
              recolhido ? 'w-[calc(4rem-1px)]' : 'w-[calc(15rem-1px)] [scrollbar-gutter:stable]',
            )}
          >
            {/* O conteúdo trocado entra com um fade curto (key remonta a cada troca). */}
            <div
              key={recolhido ? 'recolhido' : 'aberto'}
              className="animate-in fade-in duration-200 motion-reduce:animate-none"
            >
              {!recolhido && <CartaoDaConta />}
              {recolhido ? (
                // Recolhido: itens da seção fixa + um ícone por seção que abre a lista num popover.
                <MenuRecolhido secoes={secoes} />
              ) : (
                <MenuSecoes secoes={secoes} />
              )}

            {/* Rodapé: Guia do LM Flow e suporte, depois de um divisor. */}
            <div className="mt-3 pt-3 space-y-1 border-t border-sidebar-border">
              {rodape.map(item => (
                <MenuItem key={item.href} item={item} isCollapsed={recolhido} isActive={itemAtivo(item, pathname)} />
              ))}
              <a
                href={SUPORTE_WHATSAPP_URL}
                target="_blank"
                rel="noreferrer"
                title={recolhido ? 'Falar com o suporte' : undefined}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/80 transition-colors',
                  recolhido && 'justify-center',
                )}
              >
                <LifeBuoy className="flex-shrink-0" style={{ width: '1.125rem', height: '1.125rem' }} aria-hidden="true" />
                {recolhido ? <span className="sr-only">Falar com o suporte</span> : <span className="font-medium text-sm min-w-0 truncate">Falar com o suporte</span>}
              </a>
            </div>
            </div>
          </nav>
        </TooltipProvider>
      </div>
      {dialogoDeConfirmacao}
    </>
  );
}
