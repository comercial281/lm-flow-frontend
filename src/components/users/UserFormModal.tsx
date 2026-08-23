import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/ds';
import { toast } from 'sonner';
import usersService from '@/services/users/usersService';
import { customRolesService } from '@/services/customRoles/customRolesService';
import type { User, UserFormData, CRole } from '@/types/users';
import type { CustomRole } from '@/types/customRoles';
import { Loader2, Shield } from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';

// Fallback estático (mostrado enquanto o backend não respondeu ou se
// a API de cargos falhar). Substituído pelos cargos reais do DB assim
// que carregar.
const FALLBACK_ROLES: { value: CRole; label: string; description: string }[] = [
  { value: 'admin',   label: 'Administrador', description: 'Acesso total ao sistema' },
  { value: 'manager', label: 'Gerente',       description: 'Gestão de imóveis, clientes e relatórios' },
  { value: 'agent',   label: 'Corretor',      description: 'Atendimento e cadastro de interesse' },
];

// Mapping: legacy enum (chave_role) -> system role slug
const ENUM_TO_SLUG: Record<string, string> = {
  admin:   'administrador',
  manager: 'gerente',
  agent:   'corretor',
};
const SLUG_TO_ENUM: Record<string, CRole> = {
  administrador: 'admin',
  gerente:       'manager',
  corretor:      'agent',
};

interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onSuccess: () => void;
}

export default function UserFormModal({ isOpen, onClose, user, onSuccess }: UserFormModalProps) {
  const { t } = useLanguage('users');

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<UserFormData & { chave_role: CRole; custom_role_id?: number | null }>({
    name: '',
    email: '',
    chave_role: 'agent',
    availability: 'online',
    password: '',
    confirmPassword: '',
    custom_role_id: null,
    whatsapp_number: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);

  // Carrega cargos dinâmicos ao abrir o modal
  useEffect(() => {
    if (!isOpen) return;
    customRolesService
      .list()
      .then(setCustomRoles)
      .catch(() => setCustomRoles([]));
  }, [isOpen]);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name,
        email: user.email,
        chave_role: user.chave_role ?? 'agent',
        availability: user.availability || 'online',
        custom_role_id: (user as any).custom_role_id ?? null,
        whatsapp_number: user.whatsapp_number ?? '',
      });
    } else {
      setFormData({
        name: '',
        email: '',
        chave_role: 'agent',
        availability: 'online',
        password: '',
        confirmPassword: '',
        custom_role_id: null,
        whatsapp_number: '',
      });
    }
    setErrors({});
  }, [user]);

  const handleFieldChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const e = { ...prev };
        delete e[field];
        return e;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = t('form.validation.nameRequired');
    }

    if (!formData.email.trim()) {
      newErrors.email = t('form.validation.emailRequired');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = t('form.validation.emailInvalid');
    }

    if (!user) {
      if (!formData.password) {
        newErrors.password = t('form.validation.passwordRequired');
      } else if ((formData.password?.length ?? 0) < 6) {
        newErrors.password = t('form.validation.passwordMinLength');
      }
      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = t('form.validation.passwordMismatch');
      }
    } else if (formData.password) {
      if ((formData.password?.length ?? 0) < 6) {
        newErrors.password = t('form.validation.passwordMinLength');
      }
      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = t('form.validation.passwordMismatch');
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    try {
      if (user) {
        const updateData: any = {
          name: formData.name,
          availability: formData.availability,
        };
        // Send custom_role_id when one is selected; backend syncs chave_role automatically.
        if (formData.custom_role_id) {
          updateData.custom_role_id = formData.custom_role_id;
        } else {
          updateData.chave_role = formData.chave_role;
        }
        if (formData.password) updateData.password = formData.password;
        updateData.whatsapp_number = formData.whatsapp_number ?? '';
        await usersService.updateUser(user.id, updateData);
        toast.success(t('form.messages.updateSuccess'));
      } else {
        const createData: any = {
          name: formData.name,
          email: formData.email,
          chave_role: formData.chave_role,
          availability: formData.availability,
          password: formData.password,
        };
        if (formData.custom_role_id) createData.custom_role_id = formData.custom_role_id;
        if (formData.whatsapp_number) createData.whatsapp_number = formData.whatsapp_number;
        await usersService.createUser(createData as UserFormData);
        toast.success(t('form.messages.createSuccess'));
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Erro ao salvar usuário:', error);
      toast.error(t('form.messages.saveError'));
    } finally {
      setLoading(false);
    }
  };

  // Quando um custom_role está selecionado, usa ele. Senão, mostra o enum fallback.
  const selectedCustomRole = customRoles.find(r => r.id === formData.custom_role_id);
  const selectedRole = selectedCustomRole
    ? { value: formData.chave_role, label: selectedCustomRole.name, description: selectedCustomRole.description ?? '' }
    : FALLBACK_ROLES.find(r => r.value === formData.chave_role);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-sidebar border-sidebar-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sidebar-foreground">
            {user ? t('form.title.edit') : t('form.title.create')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nome */}
          <div className="space-y-2">
            <Label htmlFor="name">{t('form.fields.name.label')}</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={e => handleFieldChange('name', e.target.value)}
              placeholder={t('form.fields.name.placeholder')}
              className={`bg-sidebar border-sidebar-border text-sidebar-foreground ${errors.name ? 'border-red-500' : ''}`}
              disabled={loading}
            />
            {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">{t('form.fields.email.label')}</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={e => handleFieldChange('email', e.target.value)}
              placeholder={t('form.fields.email.placeholder')}
              className={`bg-sidebar border-sidebar-border text-sidebar-foreground ${errors.email ? 'border-red-500' : ''}`}
              disabled={loading || !!user}
            />
            {errors.email && <p className="text-sm text-red-500">{errors.email}</p>}
            {user && (
              <p className="text-xs text-sidebar-foreground/60">
                {t('form.fields.email.cannotChange')}
              </p>
            )}
          </div>

          {/* WhatsApp (para receber lembretes de automação) */}
          <div className="space-y-2">
            <Label htmlFor="whatsapp_number">WhatsApp</Label>
            <Input
              id="whatsapp_number"
              type="tel"
              value={formData.whatsapp_number ?? ''}
              onChange={e => handleFieldChange('whatsapp_number', e.target.value)}
              placeholder="Ex: 5511959462815 (com DDD e país)"
              className="bg-sidebar border-sidebar-border text-sidebar-foreground"
              disabled={loading}
            />
            <p className="text-xs text-sidebar-foreground/60">
              Número que recebe os lembretes das automações (ação "Avisar usuário no WhatsApp").
            </p>
          </div>

          {/* Perfil de acesso */}
          <div className="space-y-2">
            <Label htmlFor="chave_role" className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" />
              Perfil de acesso
            </Label>
            <Select
              value={formData.custom_role_id ? `custom:${formData.custom_role_id}` : `enum:${formData.chave_role}`}
              onValueChange={value => {
                if (value.startsWith('custom:')) {
                  const id = Number(value.slice(7));
                  const role = customRoles.find(r => r.id === id);
                  setFormData(prev => ({
                    ...prev,
                    custom_role_id: id,
                    chave_role: (SLUG_TO_ENUM[role?.slug ?? ''] ?? 'agent') as CRole,
                  }));
                } else {
                  const enumVal = value.slice(5) as CRole;
                  // Sincroniza com cargo do sistema correspondente, se existir
                  const slug = ENUM_TO_SLUG[enumVal];
                  const role = customRoles.find(r => r.slug === slug);
                  setFormData(prev => ({
                    ...prev,
                    chave_role: enumVal,
                    custom_role_id: role?.id ?? null,
                  }));
                }
              }}
              disabled={loading}
            >
              <SelectTrigger className="bg-sidebar border-sidebar-border text-sidebar-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {customRoles.length === 0 &&
                  FALLBACK_ROLES.map(role => (
                    <SelectItem key={role.value} value={`enum:${role.value}`}>
                      <span className="font-medium">{role.label}</span>
                    </SelectItem>
                  ))}
                {customRoles.map(role => (
                  <SelectItem key={role.id} value={`custom:${role.id}`}>
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ background: role.color }}
                      />
                      <span className="font-medium">{role.name}</span>
                      {role.system && (
                        <span className="rounded bg-muted px-1 py-0.5 text-[10px] uppercase text-muted-foreground">
                          sistema
                        </span>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedRole && selectedRole.description && (
              <p className="text-xs text-sidebar-foreground/60">{selectedRole.description}</p>
            )}
          </div>

          {/* Disponibilidade */}
          <div className="space-y-2">
            <Label htmlFor="availability">{t('form.fields.availability.label')}</Label>
            <Select
              value={formData.availability}
              onValueChange={value => handleFieldChange('availability', value)}
              disabled={loading}
            >
              <SelectTrigger className="bg-sidebar border-sidebar-border text-sidebar-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="online">{t('form.fields.availability.online')}</SelectItem>
                <SelectItem value="busy">{t('form.fields.availability.busy')}</SelectItem>
                <SelectItem value="offline">{t('form.fields.availability.offline')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Senha */}
          {(!user || formData.password) && (
            <>
              <div className="space-y-2">
                <Label htmlFor="password">
                  {user ? t('form.fields.password.labelOptional') : t('form.fields.password.label')}
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password ?? ''}
                  onChange={e => handleFieldChange('password', e.target.value)}
                  placeholder={t('form.fields.password.placeholder')}
                  className={`bg-sidebar border-sidebar-border text-sidebar-foreground ${errors.password ? 'border-red-500' : ''}`}
                  disabled={loading}
                />
                {errors.password && <p className="text-sm text-red-500">{errors.password}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">
                  {user
                    ? t('form.fields.confirmPassword.labelOptional')
                    : t('form.fields.confirmPassword.label')}
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={formData.confirmPassword ?? ''}
                  onChange={e => handleFieldChange('confirmPassword', e.target.value)}
                  placeholder={t('form.fields.confirmPassword.placeholder')}
                  className={`bg-sidebar border-sidebar-border text-sidebar-foreground ${errors.confirmPassword ? 'border-red-500' : ''}`}
                  disabled={loading}
                />
                {errors.confirmPassword && (
                  <p className="text-sm text-red-500">{errors.confirmPassword}</p>
                )}
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="bg-sidebar hover:bg-sidebar-accent border-sidebar-border"
            >
              {t('form.actions.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-primary hover:bg-primary/85 text-primary-foreground border-0 font-semibold"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('form.actions.saving')}
                </>
              ) : user ? (
                t('form.actions.save')
              ) : (
                t('form.actions.create')
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
