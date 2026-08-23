import { useLanguage } from '@/hooks/useLanguage';
import {
  Plus,
  Download,
  Upload,
  Trash2,
  Merge,
  CheckCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/ds';
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
  /** true quando a seleção alcança todos os contatos da consulta, não só a página. */
  allMatchingSelected?: boolean;
  onSelectAllMatching?: () => void;
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
  allMatchingSelected = false,
  onSelectAllMatching,
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
    // Mesclar exige escolher quem fica e quem some, contato a contato — não faz
    // sentido com a base inteira marcada, então some no modo "todos".
    ...(ff.merge && !allMatchingSelected && selectedCount >= 2 && isReady && can('contacts', 'update')
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
      label: allMatchingSelected ? t('header.bulkDeleteAll', { count: totalCount }) : t('header.bulkDelete'),
      icon: <Trash2 className="h-4 w-4" />,
      onClick: onBulkDelete,
      variant: 'destructive' as const,
    }] : []),
  ];

  // Ponte entre "marquei a página" e "quero a base toda": o convite só aparece
  // quando há mais contatos fora da página do que dentro dela.
  const canOfferSelectAll =
    !!onSelectAllMatching && !allMatchingSelected && selectedCount > 0 && totalCount > selectedCount;

  const selectionExtra = (
    <>
      {canOfferSelectAll && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onSelectAllMatching}
          className="h-7 px-2 text-primary hover:text-primary hover:bg-sidebar-accent"
        >
          <CheckCheck className="h-3.5 w-3.5 mr-1" />
          {t('header.selectAllMatching', { count: totalCount })}
        </Button>
      )}
      {allMatchingSelected && (
        <span className="text-xs text-sidebar-foreground/70">{t('header.allMatchingSelected')}</span>
      )}
    </>
  );

  return (
    <BaseHeader
      title={t('header.title')}
      subtitle={t('header.subtitle')}
      totalCount={totalCount}
      // No modo "todos", o número que importa é o do conjunto inteiro — mostrar
      // os 20 da página faria o usuário achar que o delete só pega a página.
      selectedCount={allMatchingSelected ? totalCount : selectedCount}
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
      selectionExtra={selectionExtra}
    />
  );
}
