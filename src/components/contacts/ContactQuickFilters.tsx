import { useEffect, useMemo, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Input,
  Button,
} from '@evoapi/design-system';
import { Tag, MapPin, Building2, X } from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';
import { BaseFilter } from '@/types/core';
import { labelsService } from '@/services/contacts/labelsService';

interface ContactQuickFiltersProps {
  activeFilters: BaseFilter[];
  onApply: (filters: BaseFilter[]) => void;
}

const ALL_TAGS = '__all__';

// Lê o valor atual de um atributo dentro dos filtros ativos (string única).
function readValue(filters: BaseFilter[], attributeKey: string): string {
  const f = filters.find(item => item.attributeKey === attributeKey);
  if (!f) return '';
  return Array.isArray(f.values) ? String(f.values[0] ?? '') : String(f.values ?? '');
}

// Substitui (ou remove) a entrada de um atributo, preservando os demais filtros
// (inclusive os avançados montados pelo modal).
function withFilter(
  base: BaseFilter[],
  attributeKey: string,
  filterOperator: string,
  value: string | null,
): BaseFilter[] {
  const rest = base.filter(item => item.attributeKey !== attributeKey);
  if (!value || value.trim() === '') return rest;
  return [
    ...rest,
    { attributeKey, filterOperator, values: value.trim(), queryOperator: 'and', attributeModel: 'standard' },
  ];
}

export default function ContactQuickFilters({ activeFilters, onApply }: ContactQuickFiltersProps) {
  const { t } = useLanguage('contacts');
  const [labels, setLabels] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    labelsService
      .getLabels()
      .then(res => {
        if (!active) return;
        setLabels((res.data || []).map(l => l.title));
      })
      .catch(() => {
        /* sem opções de tag: os demais atalhos seguem funcionando */
      });
    return () => {
      active = false;
    };
  }, []);

  const tagValue = readValue(activeFilters, 'labels');
  const cityFromFilters = readValue(activeFilters, 'city');
  const companyFromFilters = readValue(activeFilters, 'company');

  // Inputs de texto mantêm rascunho local; aplicam no Enter ou ao limpar.
  const [cityDraft, setCityDraft] = useState(cityFromFilters);
  const [companyDraft, setCompanyDraft] = useState(companyFromFilters);

  useEffect(() => setCityDraft(cityFromFilters), [cityFromFilters]);
  useEffect(() => setCompanyDraft(companyFromFilters), [companyFromFilters]);

  const hasAny = useMemo(
    () => activeFilters.some(f => ['labels', 'city', 'company'].includes(f.attributeKey)),
    [activeFilters],
  );

  const applyTag = (value: string) => {
    const next = value === ALL_TAGS ? '' : value;
    onApply(withFilter(activeFilters, 'labels', 'equal_to', next));
  };

  const applyCity = () => onApply(withFilter(activeFilters, 'city', 'contains', cityDraft));
  const applyCompany = () => onApply(withFilter(activeFilters, 'company', 'contains', companyDraft));

  const clearAll = () => onApply(activeFilters.filter(f => !['labels', 'city', 'company'].includes(f.attributeKey)));

  return (
    <div className="flex flex-wrap items-center gap-2 mb-3">
      {/* Tags */}
      <div className="flex items-center gap-1.5">
        <Tag className="h-4 w-4 text-muted-foreground" />
        <Select value={tagValue || ALL_TAGS} onValueChange={applyTag}>
          <SelectTrigger className="h-9 w-44 bg-background">
            <SelectValue placeholder={t('filter.attributes.labels')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_TAGS}>{t('filter.quick.allTags')}</SelectItem>
            {labels.map(title => (
              <SelectItem key={title} value={title}>
                {title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Cidade */}
      <div className="flex items-center gap-1.5">
        <MapPin className="h-4 w-4 text-muted-foreground" />
        <Input
          value={cityDraft}
          onChange={e => setCityDraft(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && applyCity()}
          onBlur={() => cityDraft !== cityFromFilters && applyCity()}
          placeholder={t('filter.attributes.city')}
          className="h-9 w-36 bg-background"
        />
      </div>

      {/* Empresa */}
      <div className="flex items-center gap-1.5">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <Input
          value={companyDraft}
          onChange={e => setCompanyDraft(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && applyCompany()}
          onBlur={() => companyDraft !== companyFromFilters && applyCompany()}
          placeholder={t('filter.attributes.company')}
          className="h-9 w-36 bg-background"
        />
      </div>

      {hasAny && (
        <Button variant="ghost" size="sm" onClick={clearAll} className="h-9 text-muted-foreground">
          <X className="h-4 w-4 mr-1" />
          {t('filter.quick.clear')}
        </Button>
      )}
    </div>
  );
}
