import React, { useState, useEffect } from 'react';
import {
  Button,
  DialogFooter,
  Input,
  Label,
  Textarea,
  Switch,
} from '@/components/ui/ds';
import { Save, X } from 'lucide-react';
import { CampoDaJanela, GrupoDaJanela } from '@/components/base/janela';
import { Team, TeamFormData } from '@/types/users';
import { useLanguage } from '@/hooks/useLanguage';

interface TeamFormProps {
  team?: Team;
  isNew?: boolean;
  loading?: boolean;
  onSubmit: (data: TeamFormData) => void;
  onCancel?: () => void;
}

interface FormData {
  name: string;
  description: string;
  allow_auto_assign: boolean;
}

const initialFormData: FormData = {
  name: '',
  description: '',
  allow_auto_assign: true,
};

export default function TeamForm({
  team,
  isNew = false,
  loading = false,
  onSubmit,
  onCancel,
}: TeamFormProps) {
  const { t } = useLanguage('teams');
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<Partial<FormData>>({});

  // Load team data when editing
  useEffect(() => {
    if (team && !isNew) {
      setFormData({
        name: team.name || '',
        description: team.description || '',
        allow_auto_assign: team.allow_auto_assign ?? true,
      });
    }
  }, [team, isNew]);

  const validateForm = (): boolean => {
    const newErrors: Partial<FormData> = {};

    if (!formData.name.trim()) {
      newErrors.name = t('form.name.required');
    } else if (formData.name.length < 2) {
      newErrors.name = t('form.name.minLength');
    }

    if (formData.description && formData.description.length > 500) {
      newErrors.description = t('form.description.maxLength');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const teamData: TeamFormData = {
      name: formData.name.trim(),
      description: formData.description.trim() || undefined,
      allow_auto_assign: formData.allow_auto_assign,
    };

    onSubmit(teamData);
  };

  const handleInputChange = (field: keyof FormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-5">
      <GrupoDaJanela titulo={t('form.basicInfo')}>
        <CampoDaJanela
          rotulo={t('form.name.label')}
          htmlFor="name"
          obrigatorio
          erro={errors.name}
        >
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            placeholder={t('form.name.placeholder')}
            aria-invalid={!!errors.name}
            disabled={loading}
          />
        </CampoDaJanela>

        <CampoDaJanela
          rotulo={t('form.description.label')}
          htmlFor="description"
          erro={errors.description}
          ajuda={t('form.description.counter', { current: formData.description.length })}
        >
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            placeholder={t('form.description.placeholder')}
            className="resize-none"
            aria-invalid={!!errors.description}
            rows={3}
            disabled={loading}
          />
        </CampoDaJanela>
      </GrupoDaJanela>

      <GrupoDaJanela titulo={t('form.configuration')}>
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <Label htmlFor="allow-auto-assign" className="text-[13px] font-medium text-foreground/80">
              {t('form.autoAssign.label')}
            </Label>
            <p className="text-xs text-muted-foreground">
              {t('form.autoAssign.description')}
            </p>
          </div>
          <Switch
            id="allow-auto-assign"
            checked={formData.allow_auto_assign}
            onCheckedChange={(checked) => handleInputChange('allow_auto_assign', checked)}
            disabled={loading}
          />
        </div>
      </GrupoDaJanela>

      {/* Form Actions */}
      <DialogFooter>
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={loading}
            className="min-w-[100px]"
          >
            <X className="h-4 w-4 mr-2" />
            {t('form.actions.cancel')}
          </Button>
        )}
        <Button
          type="submit"
          disabled={loading || !formData.name.trim()}
          className="min-w-[120px]"
        >
          {loading ? (
            t('form.actions.saving')
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              {isNew ? t('form.actions.create') : t('form.actions.save')}
            </>
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}
