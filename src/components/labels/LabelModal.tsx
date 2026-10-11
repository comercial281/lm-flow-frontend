import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Label as UILabel,
} from '@/components/ui/ds';
import { Label } from '@/types/settings';
import { useUserPermissions } from '@/hooks/useUserPermissions';

interface LabelModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label?: Label;
  isNew: boolean;
  loading: boolean;
  onSubmit: (data: {
    title: string;
    color: string;
  }) => void;
}

// Mesma paleta de 12 cores que o servidor sorteia (sem cinzas escuros).
const DEFAULT_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#ec4899',
];

const getRandomColor = () => {
  return DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)];
};

export default function LabelModal({
  open,
  onOpenChange,
  label,
  isNew,
  loading,
  onSubmit,
}: LabelModalProps) {
  const { t } = useLanguage('labels');
  const { can } = useUserPermissions();
  const [formData, setFormData] = useState({
    title: '',
    color: DEFAULT_COLORS[7],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      if (label && !isNew) {
        setFormData({
          title: label.title,
          color: label.color,
        });
      } else {
        setFormData({
          title: '',
          color: getRandomColor(),
        });
      }
      setErrors({});
    }
  }, [open, label, isNew]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = t('modal.validation.nameRequired');
    } else if (formData.title.length < 2) {
      newErrors.title = t('modal.validation.nameMinLength');
    }

    if (!formData.color.trim()) {
      newErrors.color = t('modal.validation.colorRequired');
    } else if (!/^#[0-9A-F]{6}$/i.test(formData.color)) {
      newErrors.color = t('modal.validation.colorInvalid');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Verificar permissões antes de validar o formulário
    const requiredPermission = isNew ? 'create' : 'update';
    if (!can('labels', requiredPermission)) {
      return;
    }

    if (!validateForm()) {
      return;
    }

    onSubmit({
      title: formData.title.toLowerCase().trim(),
      color: formData.color,
    });
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isNew ? t('modal.title.create') : t('modal.title.edit')}
          </DialogTitle>
          <DialogDescription>
            {isNew ? t('modal.description.create') : t('modal.description.edit')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <UILabel htmlFor="title">
              {t('modal.labels.name')} <span className="text-destructive">*</span>
            </UILabel>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              placeholder={t('modal.placeholders.name')}
              className={errors.title ? 'border-destructive' : ''}
              style={{ textTransform: 'lowercase' }}
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title}</p>
            )}
          </div>

          <div className="space-y-2">
            <UILabel htmlFor="color">
              {t('modal.labels.color')} <span className="text-destructive">*</span>
            </UILabel>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded border border-input"
                style={{ backgroundColor: formData.color }}
              />
              <Input
                id="color"
                type="text"
                value={formData.color}
                onChange={(e) => handleInputChange('color', e.target.value)}
                placeholder={t('modal.placeholders.color')}
                className={`font-mono ${errors.color ? 'border-destructive' : ''}`}
              />
            </div>
            {errors.color && (
              <p className="text-sm text-destructive">{errors.color}</p>
            )}

            {/* Color presets */}
            <div className="flex flex-wrap gap-2 mt-2">
              {DEFAULT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`w-6 h-6 rounded border-2 ${
                    formData.color === color ? 'border-primary' : 'border-input'
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => handleInputChange('color', color)}
                />
              ))}
            </div>
          </div>
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {t('modal.buttons.cancel')}
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={loading || !can('labels', isNew ? 'create' : 'update')}
          >
            {loading ? t('modal.buttons.saving') : isNew ? t('modal.buttons.create') : t('modal.buttons.update')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
