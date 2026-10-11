import { useLanguage } from '@/hooks/useLanguage';
import { Plus } from 'lucide-react';
import BaseHeader from '@/components/base/BaseHeader';
import { useUserPermissions } from '@/hooks/useUserPermissions';

interface LabelsHeaderProps {
  totalCount: number;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onNewLabel: () => void;
}

export default function LabelsHeader({
  totalCount,
  searchValue,
  onSearchChange,
  onNewLabel,
}: LabelsHeaderProps) {
  const { t } = useLanguage('labels');
  const { can } = useUserPermissions();

  return (
    <BaseHeader
      title={t('header.title')}
      subtitle={t('header.subtitle', { count: totalCount })}
      searchPlaceholder={t('header.searchPlaceholder')}
      searchValue={searchValue}
      onSearchChange={onSearchChange}
      primaryAction={
        can('labels', 'create') ? {
          label: t('header.newLabel'),
          icon: <Plus className="h-4 w-4" />,
          onClick: onNewLabel,
        } : undefined
      }
    />
  );
}
