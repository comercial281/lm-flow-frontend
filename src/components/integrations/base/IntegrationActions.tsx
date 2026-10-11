import { useLanguage } from '@/hooks/useLanguage';
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/ds';
import BotaoMaisAcoes from '@/components/base/BotaoMaisAcoes';
import { Settings, Power, Trash2, RefreshCw, ExternalLink } from 'lucide-react';
import { Integration } from '@/types/integrations';

interface IntegrationAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
  disabled?: boolean;
  show?: boolean;
}

interface IntegrationActionsProps {
  integration: Integration;
  onConfigure?: () => void;
  onToggle?: () => void;
  onDelete?: () => void;
  onRefresh?: () => void;
  onExternalLink?: () => void;
  isProcessing?: boolean;
  customActions?: IntegrationAction[];
  showDropdown?: boolean;
}

export default function IntegrationActions({
  integration,
  onConfigure,
  onToggle,
  onDelete,
  onRefresh,
  onExternalLink,
  isProcessing = false,
  customActions = [],
  showDropdown = true
}: IntegrationActionsProps) {
  const { t } = useLanguage('integrations');
  
  const primaryActions: IntegrationAction[] = [
    {
      id: 'configure',
      label: t('actions.configure'),
      icon: Settings,
      onClick: onConfigure || (() => {}),
      variant: 'outline' as const,
      disabled: isProcessing || !onConfigure,
      show: !!onConfigure && integration.enabled
    },
    {
      id: 'toggle',
      label: integration.enabled ? t('actions.disconnect') : t('actions.connect'),
      icon: Power,
      onClick: onToggle || (() => {}),
      variant: integration.enabled ? 'outline' as const : 'default' as const,
      disabled: isProcessing || !onToggle,
      show: !!onToggle
    }
  ].filter(action => action.show);

  const dropdownActions: IntegrationAction[] = [
    {
      id: 'refresh',
      label: t('actions.refresh'),
      icon: RefreshCw,
      onClick: onRefresh || (() => {}),
      disabled: isProcessing || !onRefresh,
      show: !!onRefresh && integration.enabled
    },
    {
      id: 'external',
      label: t('actions.visitSite'),
      icon: ExternalLink,
      onClick: onExternalLink || (() => {}),
      disabled: isProcessing || !onExternalLink,
      show: !!onExternalLink
    },
    ...customActions,
    {
      id: 'delete',
      label: t('actions.delete'),
      icon: Trash2,
      onClick: onDelete || (() => {}),
      variant: 'destructive' as const,
      disabled: isProcessing || !onDelete,
      show: !!onDelete
    }
  ].filter(action => action.show);

  const visiblePrimaryActions = primaryActions.slice(0, 2);
  const remainingActions = [...primaryActions.slice(2), ...dropdownActions];
  const hasDropdownActions = showDropdown && remainingActions.length > 0;
  const menuComuns = remainingActions.filter(action => action.variant !== 'destructive');
  const menuDestrutivas = remainingActions.filter(action => action.variant === 'destructive');
  const renderItem = (action: IntegrationAction) => (
    <DropdownMenuItem
      key={action.id}
      variant={action.variant === 'destructive' ? 'destructive' : 'default'}
      onClick={action.onClick}
      disabled={action.disabled}
    >
      <action.icon className="h-4 w-4" />
      {action.label}
    </DropdownMenuItem>
  );

  return (
    <div className="flex items-center gap-2">
      {/* Primary Actions */}
      {visiblePrimaryActions.map((action) => (
        <Button
          key={action.id}
          variant={action.variant}
          size="sm"
          onClick={action.onClick}
          disabled={action.disabled}
          className={action.variant === 'destructive' ? 'text-red-600 hover:text-red-700 border-red-200 hover:border-red-300' : ''}
        >
          <action.icon className="w-4 h-4 mr-1" />
          {isProcessing && (action.id === 'toggle' || action.id === 'configure') ? t('actions.processing') : action.label}
        </Button>
      ))}

      {/* Dropdown for additional actions */}
      {hasDropdownActions && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <BotaoMaisAcoes compacto disabled={isProcessing} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {/* Menu ⋮ da casa: Excluir e afins por último, depois de um separador. */}
            {menuComuns.map(renderItem)}
            {menuComuns.length > 0 && menuDestrutivas.length > 0 && <DropdownMenuSeparator />}
            {menuDestrutivas.map(renderItem)}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
