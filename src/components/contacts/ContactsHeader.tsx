import { useLanguage } from '@/hooks/useLanguage';
import {
  Plus,
  Download,
  Upload,
  Trash2,
  Merge,
} from 'lucide-react';
import { BaseHeader, HeaderAction, HeaderFilter } from '@/components/base';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useFeature } from '@/contexts/TenantFeaturesContext';

interface ContactsHeaderProps {
  totalCount: number;
  selectedCount: number;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onNewContact: () => void;
  onImport: () => void;
  onExport: () => void;
  onFilter: () => void;
  onBulkDelete: () => void;
  onMergeContacts: () => void;
  onClearSelection: () => void;
  activeFilters?: HeaderFilter[];
  showFilters?: boolean;
}

export default function ContactsHeader({
  totalCount,
  selectedCount,
  searchValue,
  onSearchChange,
  onNewContact,
  onImport,
  onExport,
  onFilter,
  onBulkDelete,
  onMergeContacts,
  onClearSelection,
  activeFilters = [],
  showFilters = true,
}: ContactsHeaderProps) {
  const { t } = useLanguage('contacts');
  const { can, isReady } = useUserPermissions();

  // Feature flags do tenant (ausente/ligada = true → preserva comportamento atual).
  const ff = {
    import: useFeature('contacts_import'),
    export: useFeature('contacts_export'),
    create: useFeature('contacts_create'),
    delete: useFeature('contacts_delete'),
    merge: useFeature('contacts_merge'),
  };

  const primaryAction: HeaderAction | undefined = ff.create && isReady && can('contacts', 'create') ? {
    label: t('header.newContact'),
    icon: <Plus className="h-4 w-4" />,
    onClick: onNewContact,
    dataTour: 'contacts-new-button',
  } : undefined;

  const secondaryActions: HeaderAction[] = [
    ...(ff.export && isReady && can('contacts', 'read') ? [{
      label: t('header.export'),
      icon: <Download className="h-4 w-4" />,
      onClick: onExport,
      variant: 'outline' as const,
      iconOnly: true,
    }] : []),
    ...(ff.import && isReady && can('contacts', 'create') ? [{
      label: t('header.import'),
      icon: <Upload className="h-4 w-4" />,
      onClick: onImport,
      variant: 'outline' as const,
      iconOnly: true,
    }] : []),
  ];

  const bulkActions: HeaderAction[] = [
    ...(ff.merge && selectedCount >= 2 && isReady && can('contacts', 'update')
      ? [
          {
            label: t('header.mergeContacts'),
            icon: <Merge className="h-4 w-4" />,
            onClick: onMergeContacts,
            variant: 'outline' as const,
          },
        ]
      : []),
    ...(ff.delete && isReady && can('contacts', 'delete') ? [{
      label: t('header.bulkDelete'),
      icon: <Trash2 className="h-4 w-4" />,
      onClick: onBulkDelete,
      variant: 'destructive' as const,
    }] : []),
  ];

  return (
    <BaseHeader
      title={t('header.title')}
      subtitle={t('header.subtitle')}
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
      filterButtonDataTour="contacts-filter-button"
      onClearSelection={onClearSelection}
    />
  );
}
