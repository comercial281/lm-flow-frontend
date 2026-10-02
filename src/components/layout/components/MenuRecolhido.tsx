import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { LayoutGrid } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/ds';
import { cn } from '@/lib/utils';
import MenuItem from './MenuItem';
import { itemAtivo, type MenuSection } from '../config/menuItems';

const ATRASO_FECHAR_MS = 150;
// Atraso de intenção: passar o mouse de relance pela barra não abre caixa nenhuma.
const ATRASO_ABRIR_MS = 150;

/**
 * Uma seção não fixa no menu recolhido: UM ícone que abre a lista da seção num
 * popover (ao clicar ou ao passar o mouse). Dentro, os itens aparecem com nome.
 * Aberto por hover, o popover NÃO puxa o foco (quem digita em Conversas não
 * pode perder o campo de mensagem); aberto por clique ou teclado, puxa.
 */
function SecaoRecolhida({ secao, pathname }: { secao: MenuSection; pathname: string }) {
  const [aberto, setAberto] = useState(false);
  const timerFechar = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const timerAbrir = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const viaHover = useRef(false);
  const Icone = secao.icone ?? LayoutGrid;
  const ativa = secao.itens.some(item => itemAtivo(item, pathname));

  useEffect(
    () => () => {
      clearTimeout(timerFechar.current);
      clearTimeout(timerAbrir.current);
    },
    [],
  );

  const abrir = (porHover: boolean) => {
    clearTimeout(timerFechar.current);
    clearTimeout(timerAbrir.current);
    // Já aberto: só o hover não muda a origem (clique/teclado mantém o foco).
    if (!(porHover && aberto)) viaHover.current = porHover;
    setAberto(true);
  };
  const fechar = () => {
    clearTimeout(timerFechar.current);
    clearTimeout(timerAbrir.current);
    setAberto(false);
  };
  const abrirComAtraso = () => {
    clearTimeout(timerFechar.current);
    if (aberto) return;
    clearTimeout(timerAbrir.current);
    timerAbrir.current = setTimeout(() => abrir(true), ATRASO_ABRIR_MS);
  };
  // Atraso curto pro mouse conseguir atravessar do ícone até a lista.
  const fecharComAtraso = () => {
    clearTimeout(timerAbrir.current);
    clearTimeout(timerFechar.current);
    timerFechar.current = setTimeout(() => setAberto(false), ATRASO_FECHAR_MS);
  };

  return (
    <Popover open={aberto} onOpenChange={o => (o ? abrir(false) : fechar())}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={secao.rotulo}
          aria-expanded={aberto}
          onClick={e => {
            // Clique sempre abre, na hora (o padrão do Radix alternaria e fecharia o que o hover abriu).
            e.preventDefault();
            abrir(false);
          }}
          onMouseEnter={abrirComAtraso}
          onMouseLeave={fecharComAtraso}
          className={cn(
            'flex w-full items-center justify-center px-3 py-2 rounded-lg transition-all duration-200',
            ativa ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-accent/80',
          )}
        >
          <Icone className="flex-shrink-0" style={{ width: '1.125rem', height: '1.125rem' }} aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        className="w-56 p-2"
        onMouseEnter={() => {
          clearTimeout(timerFechar.current);
        }}
        onMouseLeave={fecharComAtraso}
        onOpenAutoFocus={e => viaHover.current && e.preventDefault()}
        onCloseAutoFocus={e => viaHover.current && e.preventDefault()}
      >
        <div className="text-xs font-semibold text-muted-foreground px-2 pb-1">{secao.rotulo}</div>
        <div className="space-y-1">
          {secao.itens.map(item => (
            <MenuItem key={item.id || item.href} item={item} isActive={itemAtivo(item, pathname)} onClick={fechar} />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function MenuRecolhido({ secoes }: { secoes: MenuSection[] }) {
  const { pathname } = useLocation();
  const visiveis = secoes.filter(secao => secao.itens.length > 0);

  return (
    <>
      {visiveis.map((secao, i) => (
        <div key={secao.id} className={cn('space-y-1', i > 0 && 'mt-3 pt-3 border-t border-sidebar-border')}>
          {secao.fixa ? (
            secao.itens.map(item => (
              <MenuItem key={item.id || item.href} item={item} isCollapsed isActive={itemAtivo(item, pathname)} />
            ))
          ) : (
            <SecaoRecolhida secao={secao} pathname={pathname} />
          )}
        </div>
      ))}
    </>
  );
}
