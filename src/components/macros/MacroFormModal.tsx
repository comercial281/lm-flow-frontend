import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
} from '@/components/ui/ds';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Macro, MACRO_ACTION_TYPES } from '@/types/automation';
import { macrosService } from '@/services/macros';
import MacroActionRow from './MacroActionRow';
import Aviso from '@/components/base/Aviso';
import CartoesDeEscolha from '@/components/base/CartoesDeEscolha';
import { CampoDaJanela, GrupoDaJanela } from '@/components/base/janela';

interface MacroFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  macro?: Macro | null;
  onSuccess: () => void;
}

interface FormData {
  name: string;
  visibility: 'personal' | 'global';
  actions: Array<{
    action_name: string;
    action_params: any[];
  }>;
}

const initialFormData: FormData = {
  name: '',
  visibility: 'personal',
  actions: [
    {
      action_name: 'assign_team',
      action_params: [],
    },
  ],
};

export default function MacroFormModal({ isOpen, onClose, macro, onSuccess }: MacroFormModalProps) {
  const { t } = useLanguage('macros');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formDataOptions, setFormDataOptions] = useState<{
    inboxes: any[];
    agents: any[];
    teams: any[];
    labels: any[];
    campaigns: any[];
  }>({
    inboxes: [],
    agents: [],
    teams: [],
    labels: [],
    campaigns: [],
  });

  const isEditing = !!macro;

  // Carregar dados do formulário
  useEffect(() => {
    if (isOpen) {
      loadFormData();
    }
  }, [isOpen]);

  // Carregar dados da macro para edição
  useEffect(() => {
    if (isOpen) {
      if (macro) {
        setFormData({
          name: macro.name,
          visibility: macro.visibility,
          actions: macro.actions,
        });
      } else {
        setFormData(initialFormData);
      }
      setErrors({});
    }
  }, [isOpen, macro]);

  const loadFormData = async () => {
    try {
      const data = await macrosService.getFormData();
      setFormDataOptions(data);
    } catch (error) {
      console.error('Erro ao carregar dados do formulário:', error);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = t('modal.validation.nameRequired');
    }

    if (formData.actions.length === 0) {
      newErrors.actions = t('modal.validation.actionsRequired');
    }

    // Validar ações
    formData.actions.forEach((action, index) => {
      if (!action.action_name) {
        newErrors[`action_${index}_name`] = t('modal.validation.actionTypeRequired');
      }

      // Validar parâmetros para ações que precisam
      const actionType = MACRO_ACTION_TYPES.find(type => type.key === action.action_name);
      if (actionType && actionType.inputType && actionType.inputType !== null) {
        // Para multi_select, verificar se tem pelo menos um item selecionado
        if (actionType.inputType === 'multi_select') {
          if (!action.action_params || action.action_params.length === 0) {
            newErrors[`action_${index}_params`] = t('modal.validation.selectAtLeastOne');
          }
        }
        // Para outros tipos com input, verificar se o primeiro parâmetro existe
        else if (
          !action.action_params ||
          action.action_params.length === 0 ||
          (!action.action_params[0] && action.action_params[0] !== 0)
        ) {
          newErrors[`action_${index}_params`] = t('modal.validation.fieldRequired');
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      if (isEditing) {
        await macrosService.updateMacro(macro.id, formData);
        toast.success(t('messages.updateSuccess'));
      } else {
        await macrosService.createMacro(formData);
        toast.success(t('messages.createSuccess'));
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving macro:', error);
      toast.error(isEditing ? t('messages.updateError') : t('messages.createError'));
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (field: keyof FormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));

    // Limpar erro do campo
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const addAction = () => {
    setFormData(prev => ({
      ...prev,
      actions: [
        ...prev.actions,
        {
          action_name: 'assign_team',
          action_params: [],
        },
      ],
    }));
  };

  const removeAction = (index: number) => {
    if (formData.actions.length <= 1) return;

    setFormData(prev => ({
      ...prev,
      actions: prev.actions.filter((_, i) => i !== index),
    }));
  };

  const updateAction = (index: number, updatedAction: any) => {
    setFormData(prev => ({
      ...prev,
      actions: prev.actions.map((action, i) => (i === index ? updatedAction : action)),
    }));

    // Limpar erros relacionados à ação
    const newErrors = { ...errors };
    delete newErrors[`action_${index}_name`];
    delete newErrors[`action_${index}_params`];
    setErrors(newErrors);
  };

  // const getActionTypeLabel = (actionType: string) => {
  //   const actionTypeObj = MACRO_ACTION_TYPES.find(type => type.key === actionType);
  //   return actionTypeObj?.name || actionType;
  // };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      {/* O `min-w-[700px]` saiu: no celular ele forçava barra de rolagem horizontal,
          e da largura de tablet pra cima o preset já entrega mais de 700px sozinho. */}
      <DialogContent
        size="wide"
        className="overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t('modal.title.edit') : t('modal.title.create')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-5">
          <GrupoDaJanela titulo={t('modal.form.groupIdentification')}>
            <CampoDaJanela rotulo={t('modal.form.name')} htmlFor="name" obrigatorio erro={errors.name}>
              <Input
                id="name"
                value={formData.name}
                onChange={e => handleFieldChange('name', e.target.value)}
                placeholder={t('modal.form.namePlaceholder')}
                className={errors.name ? 'border-destructive' : ''}
                disabled={loading}
              />
            </CampoDaJanela>

            {/* Visibilidade */}
            <CartoesDeEscolha
              rotulo={t('modal.form.visibility')}
              valor={formData.visibility}
              aoEscolher={valor => handleFieldChange('visibility', valor)}
              opcoes={[
                { valor: 'personal', rotulo: t('modal.form.visibilityPersonal'), descricao: t('modal.form.visibilityPersonalDesc') },
                { valor: 'global', rotulo: t('modal.form.visibilityGlobal'), descricao: t('modal.form.visibilityGlobalDesc') },
              ]}
            />
          </GrupoDaJanela>

          {/* Ações */}
          <GrupoDaJanela
            titulo={t('modal.form.actionsTitle')}
            acao={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addAction}
                disabled={loading}
              >
                <Plus className="h-4 w-4 mr-2" />
                {t('modal.form.addAction')}
              </Button>
            }
          >
            <p className="text-xs text-muted-foreground">{t('modal.form.actionsSubtitle')}</p>

            {errors.actions && <Aviso tom="erro" compacto>{errors.actions}</Aviso>}

            <div className="grid gap-4">
              {formData.actions.map((action, index) => (
                <MacroActionRow
                  key={index}
                  action={action}
                  index={index}
                  options={formDataOptions}
                  onUpdate={updateAction}
                  onRemove={removeAction}
                  canRemove={formData.actions.length > 1}
                  errors={errors}
                  disabled={loading}
                />
              ))}
            </div>
          </GrupoDaJanela>
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            {t('modal.buttons.cancel')}
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading
              ? t('modal.buttons.saving')
              : isEditing
              ? t('modal.buttons.update')
              : t('modal.buttons.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
