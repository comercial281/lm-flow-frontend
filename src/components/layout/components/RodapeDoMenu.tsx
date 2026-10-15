import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LifeBuoy, Moon, Sun, Eye, EyeOff } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/ds';
import { cn } from '@/lib/utils';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useDemoMode } from '@/hooks/useDemoMode';
import { itemAtivo, type MenuItem as MenuItemType } from '../config/menuItems';

// WhatsApp de suporte da Leal Mídia: chip "Tony Operacional". Antes apontava pro
// número do Evolution (31 9621-9989), herdado do fork.
export const SUPORTE_WHATSAPP_URL =
  'https://api.whatsapp.com/send/?phone=5511959247348&text=Ol%C3%A1%21+Preciso+de+suporte.&type=phone_number&app_absent=0';

const ICONE = { width: '1.125rem', height: '1.125rem' };

interface RodapeDoMenuProps {
  itens: MenuItemType[];
  /** Menu recolhido (w-16): os ícones empilham e o nome aparece à direita. */
  recolhido?: boolean;
  /** Gaveta do celular: fecha ao navegar. */
  aoNavegar?: () => void;
}

/**
 * Rodapé do menu como fileira de ícones (15/10/2026): o que leva pra outro
 * lugar (Guia, Suporte) | o que muda a tela (Tema, Modo demo). O nome aparece
 * ao passar o mouse; o estado aparece sem passar (lua/sol, olho riscado em roxo).
 */
export default function RodapeDoMenu({ itens, recolhido = false, aoNavegar }: RodapeDoMenuProps) {
  const { pathname } = useLocation();
  const { theme, toggleTheme } = useDarkMode();
  const { demoMode, toggleDemoMode } = useDemoMode();
  const escuro = theme === 'dark';
  const lado = recolhido ? 'right' : 'top';

  const botao = (ativo: boolean) =>
    cn(
      'flex h-9 w-9 items-center justify-center rounded-lg transition-colors duration-200 cursor-pointer',
      ativo ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-accent/80',
    );

  const comNome = (nome: string, filho: React.ReactElement) => (
    <Tooltip key={nome}>
      <TooltipTrigger asChild>{filho}</TooltipTrigger>
      <TooltipContent side={lado}>
        <p className="font-medium">{nome}</p>
      </TooltipContent>
    </Tooltip>
  );

  return (
    <div
      data-rodape-do-menu
      className={cn('flex gap-1', recolhido ? 'flex-col items-center' : 'items-center px-[3px]')}
    >
      {itens.map(item => {
        const ativo = itemAtivo(item, pathname);
        return comNome(
          item.name,
          <Link
            to={item.href}
            onClick={aoNavegar}
            aria-label={item.name}
            aria-current={ativo ? 'page' : undefined}
            className={botao(ativo)}
          >
            <item.icon style={ICONE} aria-hidden="true" />
          </Link>,
        );
      })}
      {comNome(
        'Falar com o suporte',
        <a href={SUPORTE_WHATSAPP_URL} target="_blank" rel="noreferrer" aria-label="Falar com o suporte" className={botao(false)}>
          <LifeBuoy style={ICONE} aria-hidden="true" />
        </a>,
      )}

      <span
        aria-hidden="true"
        data-divisoria
        className={cn('shrink-0 bg-sidebar-border', recolhido ? 'my-1 h-px w-4' : 'mx-1 h-4 w-px')}
      />

      {comNome(
        escuro ? 'Tema claro' : 'Tema escuro',
        <button type="button" onClick={toggleTheme} aria-label={escuro ? 'Tema claro' : 'Tema escuro'} className={botao(false)}>
          {escuro ? <Sun style={ICONE} aria-hidden="true" /> : <Moon style={ICONE} aria-hidden="true" />}
        </button>,
      )}
      {comNome(
        demoMode ? 'Modo demo: ligado (dados borrados)' : 'Modo demo: desligado',
        <button
          type="button"
          onClick={toggleDemoMode}
          aria-pressed={demoMode}
          aria-label="Modo demo"
          className={botao(demoMode)}
        >
          {demoMode ? <EyeOff style={ICONE} aria-hidden="true" /> : <Eye style={ICONE} aria-hidden="true" />}
        </button>,
      )}
    </div>
  );
}
