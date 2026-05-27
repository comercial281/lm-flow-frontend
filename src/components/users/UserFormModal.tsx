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
} from '@evoapi/design-system';
import { toast } from 'sonner';
import usersService from '@/services/users/usersService';
import type { User, UserFormData, UserUpdateData, CRole } from '@/types/users';
import { Loader2, Shield } from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';

// LM Flow roles — static, single-tenant
const CHAVE_ROLES: { value: CRole; label: string; description: string }[] = [
  {
    value: 'admin',
    label: 'Administrador',
    description: 'Acesso total ao sistema',
  },
  {
    value: 'manager',
    label: 'Gerente',
    description: 'Gestão de imóveis, clientes e relatórios',
  },
  {
    value: 'agent',
    label: 'Corretor',
    description: 'Atendimento e cadastro de interesse',
  },
];

interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onSuccess: () => void;
}

export default function UserFormModal({ isOpen, onClose, user, onSuccess }: UserFormModalProps) {
  const { t } = useLanguage('users');

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<UserFormData & { chave_role: CRole }>({
    name: '',
    email: '',
    chave_role: 'agent',
    availability: 'online',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name,
        email: user.email,
        chave_role: user.chave_role ?? 'agent',
        availability: user.availability || 'online',
      });
    } else {
      setFormData({
        name: '',
        email: '',
        chave_role: 'agent',
        availability: 'online',
        password: '',
        confirmPassword: '',
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
        const updateData: UserUpdateData = {
          name: formData.name,
          chave_role: formData.chave_role,
          availability: formData.availability,
        };
        if (formData.password) updateData.password = formData.password;
        await usersService.updateUser(user.id, updateData);
        toast.success(t('form.messages.updateSuccess'));
      } else {
        const createData = {
          name: formData.name,
          email: formData.email,
          chave_role: formData.chave_role,
          availability: formData.availability,
          password: formData.password,
        };
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

  const selectedRole = CHAVE_ROLES.find(r => r.value === formData.chave_role);

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

          {/* Perfil de acesso */}
          <div className="space-y-2">
            <Label htmlFor="chave_role" className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" />
              Perfil de acesso
            </Label>
            <Select
              value={formData.chave_role}
              onValueChange={value => handleFieldChange('chave_role', value)}
              disabled={loading}
            >
              <SelectTrigger className="bg-sidebar border-sidebar-border text-sidebar-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHAVE_ROLES.map(role => (
                  <SelectItem key={role.value} value={role.value}>
                    <span className="font-medium">{role.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedRole && (
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
