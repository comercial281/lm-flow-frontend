import React from 'react';
import { Link } from 'react-router-dom';
import { EyeOff } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/ds';
import { cn } from '@/lib/utils';
import { MenuItem as MenuItemType } from '../config/menuItems';

interface MenuItemProps {
  item: MenuItemType;
  mobile?: boolean;
  isCollapsed?: boolean;
  isActive: boolean;
  onClick?: (e: React.MouseEvent) => void;
}

// Todo item do menu leva direto para uma página (fase 4): o que antes era
// sub-item virou aba no topo da página, então não há mais item que só abre
// submenu.
export default function MenuItem({
  item,
  mobile = false,
  isCollapsed = false,
  isActive,
  onClick,
}: MenuItemProps) {
  const menuItem = (
    <Link
      to={item.href}
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'relative flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group',
        mobile ? 'w-full' : isCollapsed ? 'justify-center' : '',
        isActive
          ? isCollapsed && !mobile
            ? 'bg-primary/20 text-primary'
            : 'bg-primary text-primary-foreground shadow-[0_2px_12px_rgba(124,58,237,0.35)]'
          : 'text-muted-foreground hover:text-foreground hover:bg-accent/80',
      )}
    >
      <item.icon
        className={cn(
          'flex-shrink-0 transition-colors duration-200',
          isActive ? (isCollapsed && !mobile ? 'text-primary' : 'text-primary-foreground') : 'group-hover:text-foreground',
        )}
        style={{ width: '1.125rem', height: '1.125rem' }}
      />
      {/* Recolhido só sobra o ícone: a bolinha vai no canto dele. */}
      {isCollapsed && !mobile && item.marcador && (
        <span role="img" aria-label="Novidade" data-marcador className="absolute right-2 top-1.5 h-2 w-2 rounded-full bg-destructive" />
      )}
      {(!isCollapsed || mobile) && (
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="font-medium text-sm min-w-0 truncate">{item.name}</span>
          {item.marcador && (
            <span role="img" aria-label="Novidade" data-marcador className="ml-1.5 inline-block h-2 w-2 shrink-0 rounded-full bg-destructive" />
          )}
          {item.hiddenFromClient && (
            <span className="flex items-center" title="Oculto pro cliente (você vê como super-admin)">
              <EyeOff className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" aria-label="Oculto pro cliente" />
            </span>
          )}
        </div>
      )}
    </Link>
  );

  if (!mobile && isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{menuItem}</TooltipTrigger>
        <TooltipContent side="right">
          <p className="font-medium">{item.name}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return menuItem;
}
