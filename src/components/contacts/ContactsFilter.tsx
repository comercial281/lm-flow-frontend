import { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import BaseFilter from '@/components/base/BaseFilter';
import {
  BaseFilter as ContactFilter,
  CONTACT_FILTER_TYPES,
  DEFAULT_CONTACT_FILTER,
  FilterType,
} from '@/types/core';
import { labelsService } from '@/services/contacts/labelsService';

interface ContactsFilterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: ContactFilter[];
  onFiltersChange: (filters: ContactFilter[]) => void;
  onApplyFilters: (filters: ContactFilter[]) => void;
  onClearFilters: () => void;
}

export default function ContactsFilter({
  open,
  onOpenChange,
  filters,
  onFiltersChange,
  onApplyFilters,
  onClearFilters,
}: ContactsFilterProps) {
  const { t } = useLanguage('contacts');
  const [labelOptions, setLabelOptions] = useState<Array<{ label: string; value: string }>>([]);

  // Carrega as tags da conta para popular o filtro de labels.
  useEffect(() => {
    if (!open) return;
    let active = true;
    labelsService
      .getLabels()
      .then(res => {
        if (!active) return;
        const opts = (res.data || []).map(label => ({ label: label.title, value: label.title }));
        setLabelOptions(opts);
      })
      .catch(() => {
        // Falha silenciosa: o filtro de tags fica sem opções, demais filtros seguem.
      });
    return () => {
      active = false;
    };
  }, [open]);

  // Injeta as opções de tags carregadas no tipo de filtro "labels".
  const filterTypes = useMemo<FilterType[]>(
    () =>
      CONTACT_FILTER_TYPES.map(ft =>
        ft.attributeKey === 'labels' ? { ...ft, options: labelOptions } : ft,
      ),
    [labelOptions],
  );

  return (
    <BaseFilter
      open={open}
      onOpenChange={onOpenChange}
      filters={filters}
      onFiltersChange={onFiltersChange}
      onApplyFilters={onApplyFilters}
      onClearFilters={onClearFilters}
      filterTypes={filterTypes}
      defaultFilter={DEFAULT_CONTACT_FILTER}
      title={t('filter.title')}
      description={t('filter.description')}
      applyButtonText={t('filter.apply')}
      clearButtonText={t('filter.clear')}
      addFilterText={t('filter.addFilter')}
      translationNamespace="contacts"
    />
  );
}
