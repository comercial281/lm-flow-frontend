import { Plus } from 'lucide-react';
import { BaseHeader } from '@/components/base';
import { useLanguage } from '@/hooks/useLanguage';

interface PipelinesHeaderProps {
  totalCount: number;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onNewPipeline: () => void;
}

export default function PipelinesHeader({
  totalCount,
  searchValue,
  onSearchChange,
  onNewPipeline,
}: PipelinesHeaderProps) {
  const { t } = useLanguage('pipelines');

  return (
    <BaseHeader
      title={t('pipelinesHeader.title')}
      subtitle={totalCount > 0 ? t('pipelinesHeader.subtitle', { count: totalCount }) : t('pipelinesHeader.organize')}
      searchValue={searchValue}
      onSearchChange={onSearchChange}
      searchPlaceholder={t('pipelinesHeader.searchPlaceholder')}
      primaryAction={{
        label: t('pipelinesHeader.newPipeline'),
        icon: <Plus className="h-4 w-4" />,
        onClick: onNewPipeline,
        dataTour: 'pipelines-new-button',
      }}
    />
  );
}
