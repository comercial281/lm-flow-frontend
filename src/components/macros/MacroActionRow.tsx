import React, { useState } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Input,
  Textarea,
  Button,
} from '@/components/ui/ds';
import { Upload, X } from 'lucide-react';
import { MACRO_ACTION_TYPES } from '@/types/automation';
import { cn } from '@/lib/utils';
import { CampoDaJanela, GradeDaJanela } from '@/components/base/janela';

interface ActionRowProps {
  action: {
    action_name: string;
    action_params: any[];
  };
  index: number;
  options: {
    inboxes: any[];
    agents: any[];
    teams: any[];
    labels: any[];
    campaigns: any[];
  };
  onUpdate: (index: number, action: any) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
  errors: Record<string, string>;
  disabled: boolean;
}

export default function MacroActionRow({
  action,
  index,
  options,
  onUpdate,
  onRemove,
  canRemove,
  errors,
  disabled,
}: ActionRowProps) {
  const { t } = useLanguage('macros');
  const [uploadingFile, setUploadingFile] = useState(false);

  const selectedActionConfig = MACRO_ACTION_TYPES.find(a => a.key === action.action_name);

  const handleFieldChange = (field: string, value: any) => {
    const updated = { ...action, [field]: value };

    // Reset params quando mudar a ação
    if (field === 'action_name') {
      updated.action_params = [];
    }

    onUpdate(index, updated);
  };

  const handleParamsChange = (params: any[]) => {
    onUpdate(index, { ...action, action_params: params });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    try {
      // TODO: Implementar upload real
      // const blobId = await macroService.uploadAttachment(file);
      const blobId = `blob_${Date.now()}`; // Mock para desenvolvimento

      handleParamsChange([blobId]);
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
    } finally {
      setUploadingFile(false);
    }
  };

  const renderActionInput = () => {
    if (!selectedActionConfig) return null;

    const { inputType, options: actionOptions } = selectedActionConfig;

    switch (inputType) {
      case 'select':
        let selectOptions: any[] = [];

        // Determinar opções baseadas na ação
        switch (action.action_name) {
          case 'assign_agent':
            selectOptions = options.agents;
            break;
          case 'assign_team':
            selectOptions = options.teams;
            break;
          case 'change_priority':
          case 'change_status':
            selectOptions = actionOptions || [];
            break;
          default:
            selectOptions = actionOptions || [];
        }

        return (
          <Select
            value={action.action_params[0]?.toString() || ''}
            onValueChange={value => handleParamsChange([parseInt(value) || value])}
            disabled={disabled}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t('actionRow.selectPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {selectOptions.length === 0 ? (
                <SelectItem value="loading" disabled>
                  {t('actionRow.loadingOptions')}
                </SelectItem>
              ) : (
                selectOptions.map(option => (
                  <SelectItem
                    key={option.value || option.id}
                    value={(option.value || option.id).toString()}
                  >
                    {option.label || option.name || option.title}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        );

      case 'multi_select':
        let multiSelectOptions: any[] = [];

        switch (action.action_name) {
          case 'add_label':
          case 'remove_label':
            multiSelectOptions = options.labels;
            break;
          default:
            multiSelectOptions = actionOptions || [];
        }

        return (
          <div className="space-y-2">
            <Select
              value=""
              onValueChange={value => {
                const numValue = parseInt(value) || value;
                if (value && !action.action_params.includes(numValue)) {
                  handleParamsChange([...action.action_params, numValue]);
                }
              }}
              disabled={disabled}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('actionRow.multiSelectPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {multiSelectOptions.length === 0 ? (
                  <SelectItem value="loading" disabled>
                    {t('actionRow.loadingOptions')}
                  </SelectItem>
                ) : (
                  multiSelectOptions.map(option => (
                    <SelectItem
                      key={option.value || option.id}
                      value={(option.value || option.id).toString()}
                    >
                      {option.label || option.name || option.title}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>

            {/* Valores selecionados */}
            {action.action_params.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {action.action_params.map(paramValue => {
                  const option = multiSelectOptions.find(
                    o => (o.value || o.id).toString() === paramValue.toString(),
                  );
                  return (
                    <div
                      key={paramValue}
                      className="flex items-center gap-1 px-2 py-1 bg-muted rounded text-sm"
                    >
                      {option?.label || option?.name || option?.title || paramValue}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="-my-1.5 size-8 p-0 hover:bg-transparent text-muted-foreground"
                        onClick={() =>
                          handleParamsChange(action.action_params.filter(p => p !== paramValue))
                        }
                        disabled={disabled}
                        aria-label="Remover valor"
                        title="Remover valor"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );

      case 'textarea':
        return (
          <Textarea
            value={action.action_params[0] || ''}
            onChange={e => handleParamsChange([e.target.value])}
            placeholder={t('actionRow.textareaPlaceholder')}
            className="w-full"
            disabled={disabled}
            rows={3}
          />
        );

      case 'text':
        return (
          <Input
            type="text"
            value={action.action_params[0] || ''}
            onChange={e => handleParamsChange([e.target.value])}
            placeholder={
              action.action_name === 'snooze_conversation'
                ? t('actionRow.hoursPlaceholder')
                : t('actionRow.textPlaceholder')
            }
            className="w-full"
            disabled={disabled}
          />
        );

      case 'email':
        return (
          <Input
            type="email"
            value={action.action_params[0] || ''}
            onChange={e => handleParamsChange([e.target.value])}
            placeholder={t('actionRow.emailPlaceholder')}
            className="w-full"
            disabled={disabled}
          />
        );

      case 'url':
        return (
          <Input
            type="url"
            value={action.action_params[0] || ''}
            onChange={e => handleParamsChange([e.target.value])}
            placeholder={t('actionRow.urlPlaceholder')}
            className="w-full"
            disabled={disabled}
          />
        );

      case 'file':
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled || uploadingFile}
                onClick={() => document.getElementById(`file-${index}`)?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploadingFile ? t('actionRow.fileUploading') : t('actionRow.fileSelectButton')}
              </Button>

              <input
                id={`file-${index}`}
                type="file"
                className="hidden"
                onChange={handleFileUpload}
                disabled={disabled}
              />
            </div>

            {action.action_params.length > 0 && (
              <div className="text-sm text-muted-foreground">
                {t('actionRow.fileSelected', { filename: action.action_params[0] })}
              </div>
            )}
          </div>
        );

      default:
        return (
          <div className="text-sm text-muted-foreground italic">{t('actionRow.noConfig')}</div>
        );
    }
  };

  return (
    <div className={cn('flex items-end gap-3', index > 0 && 'border-t border-border pt-4')}>
      <GradeDaJanela className="min-w-0 flex-1">
        <CampoDaJanela rotulo={t('modal.form.actionLabel')} colunas={selectedActionConfig?.inputType ? 2 : 4} erro={errors[`action_${index}_name`]}>
          <Select
            value={action.action_name}
            onValueChange={value => handleFieldChange('action_name', value)}
            disabled={disabled}
          >
            <SelectTrigger
              className={cn('w-full', errors[`action_${index}_name`] && 'border-destructive')}
            >
              <SelectValue placeholder={t('actionRow.selectPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {MACRO_ACTION_TYPES.map(actionConfig => (
                <SelectItem
                  key={actionConfig.key}
                  value={actionConfig.key}
                >
                  <div>
                    <div className="font-medium">{actionConfig.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {actionConfig.description}
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CampoDaJanela>

        {/* Configuração da ação */}
        {selectedActionConfig && selectedActionConfig.inputType && (
          <CampoDaJanela rotulo={t('modal.form.configLabel')} colunas={2}>
            {renderActionInput()}
          </CampoDaJanela>
        )}
      </GradeDaJanela>

      {/* Botão de remover */}
      {canRemove && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onRemove(index)}
          disabled={disabled}
          aria-label="Remover ação"
          title="Remover ação"
          className="shrink-0 hover:border-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
