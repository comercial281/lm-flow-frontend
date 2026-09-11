import {
  Plus,
  Download,
  Mail,
} from 'lucide-react';
import { BaseHeader, HeaderAction, HeaderFilter } from '@/components/base';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useLanguage } from '@/hooks/useLanguage';

interface UsersHeaderProps {
  totalCount: number;
  selectedCount: number;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onNewUser: () => void;
  onBulkInvite: () => void;
  onFilter: () => void;
  onClearSelection?: () => void;
  activeFilters?: HeaderFilter[];
  showFilters?: boolean;
}

export default function UsersHeader({
  totalCount,
  selectedCount,
  searchValue,
  onSearchChange,
  onNewUser,
  onBulkInvite,
  onFilter,
  onClearSelection,
  activeFilters = [],
  showFilters = true,
}: UsersHeaderProps) {
  const { can } = useUserPermissions();
  const { t } = useLanguage('users');

  const primaryAction: HeaderAction | undefined = can('users', 'create') ? {
    label: t('header.newUser'),
    icon: <Plus className="h-4 w-4" />,
    onClick: onNewUser,
  } : undefined;

  const secondaryActions: HeaderAction[] = [
    ...(can('users', 'create') ? [{
      label: t('header.bulkInvite'),
      icon: <Mail className="h-4 w-4" />,
      onClick: onBulkInvite,
      variant: 'outline' as const,
      iconOnly: true,
    }] : []),
    {
      label: t('header.export'),
      icon: <Download className="h-4 w-4" />,
      onClick: () => {}, // TODO: Implement export
      variant: 'outline',
      iconOnly: true,
    },
  ];

  // ⚠️ NÃO existe ação em massa aqui, e é de propósito.
  //
  // A exclusão em massa chamava o mesmo caminho do *Excluir* individual, que
  // para quem já atendeu um lead vira uma DESATIVAÇÃO — sem escolher quem fica
  // com os leads de cada um, e sem ninguém ver o que cada pessoa carregava.
  // Desativar dez corretores em silêncio é exatamente a meia-desativação que a
  // janela de confirmação veio impedir.
  const bulkActions: HeaderAction[] = [];

  return (
    <BaseHeader
      title={t('title')}
      subtitle={t('subtitle')}
      totalCount={totalCount}
      selectedCount={selectedCount}
      searchValue={searchValue}
      onSearchChange={onSearchChange}
      searchPlaceholder={t('header.searchPlaceholder')}
      primaryAction={primaryAction}
      secondaryActions={secondaryActions}
      bulkActions={bulkActions}
      filters={activeFilters}
      onFilterClick={onFilter}
      showFilters={showFilters}
      onClearSelection={onClearSelection}
    />
  );
}
