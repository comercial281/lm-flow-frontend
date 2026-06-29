import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button, Avatar, AvatarFallback, AvatarImage,
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel
} from '@evoapi/design-system';
import { useLanguage } from '@/hooks/useLanguage';
import { getProfileMenuItems } from '../config/menuItems';
import { Role } from '@/types/auth';
import { availabilityOptions, getAvailabilityConfig } from '@/hooks/useUserAvailability';
import { useAuthStore } from '@/store/authStore';
import apiAuth from '@/services/core/apiAuth';
import { toast } from 'sonner';

interface User {
  id: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  avatar_url?: string;
  role?: Role;
  availability?: string;
}

interface ProfileMenuProps {
  user: User;
  mobile?: boolean;
  setLogoutDialogOpen: (open: boolean) => void;
  setIsMobileMenuOpen?: (open: boolean) => void;
}

const CustomLink = ({ href, onClick, children, className }: { href: string; onClick?: () => void; children: React.ReactNode; className?: string }) => {
  if (href === '#' && onClick) return <button onClick={onClick} className={className}>{children}</button>;
  return <a href={href} className={className}>{children}</a>;
};

export default function ProfileMenu({ user, mobile = false, setLogoutDialogOpen, setIsMobileMenuOpen }: ProfileMenuProps) {
  const { t } = useLanguage('layout');
  const navigate = useNavigate();
  const updateAvailabilityStore = useAuthStore(s => s.updateAvailability);
  const currentAvailability = useAuthStore(s => (s.currentUser as any)?.availability) ?? 'online';
  const [updatingAvail, setUpdatingAvail] = useState(false);

  const handleAvailability = useCallback(async (value: 'online' | 'busy' | 'offline') => {
    setUpdatingAvail(true);
    try {
      await apiAuth.post('/profile/availability', { profile: { availability: value } });
      updateAvailabilityStore(value);
    } catch {
      toast.error('Erro ao atualizar disponibilidade');
    } finally {
      setUpdatingAvail(false);
    }
  }, [updateAvailabilityStore]);

  const availConfig = getAvailabilityConfig(currentAvailability);

  const getUserInitials = (name?: string) =>
    (name ?? '').split(' ').map(w => w.charAt(0)).join('').toUpperCase().slice(0, 2) || '?';

  const getUserDisplayName = () => {
    if (!user) return t('profile.defaultUser');
    if (user.name) return user.name;
    if (user.firstName && user.lastName) return `${user.firstName} ${user.lastName}`;
    if (user.firstName) return user.firstName;
    return user.email.split('@')[0];
  };

  const userName = getUserDisplayName();
  const userInitials = getUserInitials(userName);
  const profileMenuItems = getProfileMenuItems(t, navigate, setLogoutDialogOpen);

  const AvailabilityPicker = () => (
    <div className="px-2 py-1.5">
      <p className="text-xs text-muted-foreground mb-1.5 font-medium">Disponibilidade</p>
      <div className="flex gap-1">
        {availabilityOptions.map(opt => (
          <button key={opt.value} disabled={updatingAvail} onClick={() => handleAvailability(opt.value)}
            className={`flex-1 flex flex-col items-center gap-0.5 rounded px-1 py-1.5 text-[10px] font-medium transition-colors border ${
              currentAvailability === opt.value
                ? 'bg-primary/10 border-primary/40 text-primary'
                : 'border-transparent text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}>
            <span className={`h-2 w-2 rounded-full ${opt.color}`} />
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );

  const AvatarWithDot = ({ size = 'h-8 w-8', border = 'border-background' }: { size?: string; border?: string }) => (
    <div className="relative">
      <Avatar className={size}>
        <AvatarImage src={user.avatar_url} alt={userName} />
        <AvatarFallback className="bg-sidebar-primary text-white font-medium">{userInitials}</AvatarFallback>
      </Avatar>
      <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 ${border} ${availConfig.color}`} />
    </div>
  );

  if (mobile) {
    return (
      <div className="p-4 border-t border-sidebar-border bg-sidebar">
        <div className="flex items-center gap-3 p-3 rounded-md bg-sidebar-accent/50">
          <AvatarWithDot border="border-sidebar" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-sidebar-foreground truncate">{userName}</div>
            <div className="text-xs text-muted-foreground truncate">{user.email}</div>
            {user.role && <div className="text-xs text-sidebar-primary truncate mt-0.5">{user.role.name}</div>}
          </div>
        </div>
        <div className="mt-2 space-y-1">
          {profileMenuItems.filter(item => item.name !== t('profile.myProfile')).map(item => (
            <CustomLink key={item.href} href={item.href} onClick={() => { if (item.onClick) item.onClick(); if (setIsMobileMenuOpen) setIsMobileMenuOpen(false); }}
              className="flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors">
              <item.icon className="h-4 w-4" />
              <span>{item.name}</span>
            </CustomLink>
          ))}
        </div>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-10 w-auto px-2 py-2 text-sidebar-foreground hover:bg-sidebar-accent cursor-pointer">
          <AvatarWithDot border="border-sidebar" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex items-center gap-2">
            <AvatarWithDot />
            <div className="flex flex-col">
              <span className="text-sm font-medium">{userName}</span>
              <span className="text-xs text-muted-foreground">{user.email}</span>
              {user.role && <span className="text-xs text-primary font-medium">{user.role.name}</span>}
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <AvailabilityPicker />
        <DropdownMenuSeparator />
        {profileMenuItems.map(item => (
          <DropdownMenuItem key={item.href} onClick={() => { if (item.onClick) item.onClick(); else if (item.href !== '#') navigate(item.href); }} className="cursor-pointer">
            <item.icon className="h-4 w-4" />
            <span>{item.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
