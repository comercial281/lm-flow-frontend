import { useLanguage } from '@/hooks/useLanguage';
import { Button, Input } from '@/components/ui/ds';
import { Search, Plus } from 'lucide-react';

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
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('pipelinesHeader.title')}</h1>
        <p className="text-muted-foreground">
          {totalCount > 0
            ? t('pipelinesHeader.subtitle', { count: totalCount, plural: totalCount !== 1 ? 's' : '' })
            : t('pipelinesHeader.organize')
          }
        </p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            type="text"
            placeholder={t('pipelinesHeader.searchPlaceholder')}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>

        <Button onClick={onNewPipeline} data-tour="pipelines-new-button" className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          {t('pipelinesHeader.newPipeline')}
        </Button>
      </div>
    </div>
  );
}
