import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import MenuItem from './MenuItem';
import {
  donoDoEndereco,
  itemAtivo,
  type MenuItem as MenuItemType,
  type MenuSection,
} from '../config/menuItems';

// ── MENU EM SEÇÕES (fase 4, modelo da Lais) ──────────────────────────────────
//
// A seção fixa (Principal) fica sempre aberta, sem cabeçalho. As outras abrem e
// fecham, UMA POR VEZ: abrir uma fecha a que estava aberta. Ao navegar, abre
// sozinha a seção da página em que a pessoa está — senão o "uma por vez" a
// deixaria sem saber onde está. Endereço que não é de nenhum item (/profile)
// não mexe no que está aberto.
//
// O mesmo componente desenha o menu do computador e a gaveta do celular.

interface MenuSecoesProps {
  secoes: MenuSection[];
  mobile?: boolean;
  /** Clicou num item (a gaveta do celular fecha). */
  aoNavegar?: () => void;
}

export default function MenuSecoes({ secoes, mobile = false, aoNavegar }: MenuSecoesProps) {
  const { pathname } = useLocation();
  const secaoDoEndereco = (p: string) => {
    const dono = donoDoEndereco(secoes, p);
    return dono && !dono.secao.fixa ? dono.secao.id : null;
  };
  const [aberta, setAberta] = useState<string | null>(() => secaoDoEndereco(pathname));

  useEffect(() => {
    const daqui = secaoDoEndereco(pathname);
    if (daqui) setAberta(daqui);
    // Só o endereço decide aqui; `secoes` muda de referência a cada filtro.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const desenhaItem = (item: MenuItemType) => (
    <MenuItem
      key={item.id || item.href}
      item={item}
      mobile={mobile}
      isActive={itemAtivo(item, pathname)}
      onClick={() => aoNavegar?.()}
    />
  );

  return (
    <div className="space-y-1">
      {secoes.map(secao => {
        if (secao.fixa) {
          return (
            <div key={secao.id} className="space-y-1 pb-2">
              {secao.itens.map(desenhaItem)}
            </div>
          );
        }
        const estaAberta = aberta === secao.id;
        const Icone = secao.icone;
        const temAtivo = secao.itens.some(i => itemAtivo(i, pathname));
        return (
          <div key={secao.id}>
            <button
              type="button"
              aria-expanded={estaAberta}
              onClick={() => setAberta(estaAberta ? null : secao.id)}
              className={cn(
                'flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm font-medium transition-colors',
                temAtivo && !estaAberta ? 'text-primary' : 'text-sidebar-foreground/80 hover:text-foreground hover:bg-accent/80',
              )}
            >
              {Icone && <Icone className="flex-shrink-0" style={{ width: '1.125rem', height: '1.125rem' }} aria-hidden="true" />}
              <span className="flex-1">{secao.rotulo}</span>
              <ChevronDown
                className={cn('h-3.5 w-3.5 opacity-60 transition-transform', estaAberta && 'rotate-180')}
                aria-hidden="true"
              />
            </button>
            {estaAberta && (
              <div className="ml-5 mt-1 mb-1 space-y-0.5 border-l border-sidebar-border pl-2">
                {secao.itens.map(desenhaItem)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
