import { useState } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Input,
  Calendar,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Button,
} from '@/components/ui/ds';
import { CalendarIcon, X } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

import { BaseFilter, FilterType } from '@/types/core';

interface BaseFilterRowProps<T extends BaseFilter> {
  filter: T;
  index: number;
  showQueryOperator: boolean;
  filterTypes: FilterType[];
  onUpdate: (index: number, field: keyof T, value: string | number | boolean) => void;
  onRemove: (index: number) => void;
  className?: string;
  translationNamespace?: string;
}

export default function BaseFilterRow<T extends BaseFilter>({
  filter,
  index,
  showQueryOperator,
  filterTypes,
  onUpdate,
  onRemove,
  className = '',
  translationNamespace = 'common',
}: BaseFilterRowProps<T>) {
  const { t } = useLanguage(translationNamespace);
  const { t: tCommon } = useLanguage('common');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const currentFilterType = filterTypes.find(ft => ft.attributeKey === filter.attributeKey);

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      onUpdate(index, 'values' as keyof T, format(date, 'yyyy-MM-dd'));
      setCalendarOpen(false);
    }
  };

  const renderValueInput = () => {
    if (!currentFilterType) return null;

    const needsValueInput = !['is_present', 'is_not_present'].includes(filter.filterOperator);

    if (!needsValueInput) return null;

    switch (currentFilterType.inputType) {
      case 'date':
        return (
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start text-left font-normal truncate min-w-0"
              >
                <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                <span className="truncate">
                  {filter.values
                    ? format(new Date(filter.values as string), 'dd/MM/yyyy', { locale: pt })
                    : tCommon('base.filter.selectDate')}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={filter.values ? new Date(filter.values as string) : undefined}
                onSelect={handleDateSelect}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        );
      case 'search_select':
        return (
          <Select
            value={filter.values as string}
            onValueChange={value => onUpdate(index, 'values' as keyof T, value)}
          >
            <SelectTrigger className="w-full truncate min-w-0">
              <SelectValue placeholder={tCommon('base.filter.selectOption')} className="truncate" />
            </SelectTrigger>
            <SelectContent>
              {currentFilterType.options?.map(option => {
                // Check if label is a translation key (contains a dot, indicating namespace.key format)
                const isTranslationKey = typeof option.label === 'string' && option.label.includes('.');
                const displayLabel = isTranslationKey ? t(option.label) : option.label;
                return (
                  <SelectItem
                    key={option.value}
                    value={option.value.toString()}
                    className="truncate"
                  >
                    {displayLabel}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        );
      case 'number':
        return (
          <Input
            type="number"
            value={filter.values as string}
            onChange={e => onUpdate(index, 'values' as keyof T, e.target.value)}
            placeholder={tCommon('base.filter.enterNumber')}
            className="w-full truncate min-w-0"
          />
        );
      default:
        return (
          <Input
            type="text"
            value={filter.values as string}
            onChange={e => onUpdate(index, 'values' as keyof T, e.target.value)}
            placeholder={tCommon('base.filter.enterValue')}
            className="w-full truncate min-w-0"
          />
        );
    }
  };

  return (
    <div
      className={`flex items-center gap-3 p-4 rounded-lg border border-border min-w-0 overflow-hidden ${className}`}
    >
      {/* Query Operator */}
      {showQueryOperator && (
        <div className="flex-shrink-0">
          <Select
            value={filter.queryOperator}
            onValueChange={(value: 'and' | 'or') =>
              onUpdate(index, 'queryOperator' as keyof T, value)
            }
          >
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="and">
                {tCommon('base.filter.and')}
              </SelectItem>
              <SelectItem value="or">
                {tCommon('base.filter.or')}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Attribute */}
      <div className="min-w-0 flex-1">
        <Select
          value={filter.attributeKey}
          onValueChange={value => onUpdate(index, 'attributeKey' as keyof T, value)}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {filterTypes.map(filterType => (
              <SelectItem
                key={filterType.attributeKey}
                value={filterType.attributeKey}
              >
                {t(filterType.attributeI18nKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Operator */}
      <div className="min-w-0 flex-1">
        <Select
          value={filter.filterOperator}
          onValueChange={value => onUpdate(index, 'filterOperator' as keyof T, value)}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {currentFilterType?.filterOperators.map(operator => (
              <SelectItem
                key={operator.key}
                value={operator.key}
              >
                {t(operator.label)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Value */}
      <div className="flex-1 min-w-0">{renderValueInput()}</div>

      {/* Remove Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onRemove(index)}
        aria-label="Remover filtro"
        title="Remover filtro"
        className="flex-shrink-0"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
