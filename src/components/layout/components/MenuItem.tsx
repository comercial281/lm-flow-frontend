import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, EyeOff } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/ds';
import { MenuItem as MenuItemType } from '../config/menuItems';

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

interface MenuItemProps {
  item: MenuItemType;
  mobile?: boolean;
  isCollapsed?: boolean;
  isActive: boolean;
  activeMenu: string | null;
  onClick: (e: React.MouseEvent) => void;
}

export default function MenuItem({
  item,
  mobile = false,
  isCollapsed = false,
  isActive,
  onClick,
}: MenuItemProps) {
  const hasSubItems = item.subItems && item.subItems.length > 0;

  const menuItem = (
    <Link
      to={hasSubItems && !mobile && item.href === '#' ? '#' : item.href}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group',
        mobile ? 'w-full' : isCollapsed ? 'justify-center' : '',
        isActive
          ? mobile
            ? 'bg-primary text-primary-foreground'
            : isCollapsed
            ? 'bg-primary/20 text-primary'
            : 'bg-primary text-primary-foreground shadow-[0_2px_12px_rgba(124,58,237,0.35)]'
          : 'text-muted-foreground hover:text-foreground hover:bg-accent/80',
      )}
    >
      <item.icon
        className={cn(
          'flex-shrink-0 h-4.5 w-4.5 transition-colors duration-200',
          isActive && !mobile ? 'text-primary-foreground' : isActive ? 'text-primary-foreground' : 'group-hover:text-foreground',
        )}
        style={{ width: '1.125rem', height: '1.125rem' }}
      />
      {(!isCollapsed || mobile) && (
        <>
          <div className="flex items-center gap-2 flex-1">
            <span className="font-medium text-sm">{item.name}</span>
            {item.hiddenFromClient && (
              <span className="flex items-center" title="Oculto pro cliente (você vê como super-admin)">
                <EyeOff className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" aria-label="Oculto pro cliente" />
              </span>
            )}
          </div>
          {hasSubItems && !mobile && (
            <div className="ml-auto">
              <ChevronRight className="h-3.5 w-3.5 opacity-60" />
            </div>
          )}
        </>
      )}
    </Link>
  );

  if (!mobile && isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {menuItem}
        </TooltipTrigger>
        <TooltipContent side="right">
          <div>
            <p className="font-medium">{item.name}</p>
            {hasSubItems && (
              <div className="mt-1 space-y-1">
                {item.subItems?.map(subItem => (
                  <div key={subItem.href} className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground">
                      {subItem.name}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  return menuItem;
}
