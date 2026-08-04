import { useEffect, useMemo, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Input,
  Button,
  Badge,
  Checkbox,
} from '@/components/ui/ds';
import { Popover, PopoverContent, PopoverTrigger } from '@evoapi/design-system/popover';
import { Tag, EyeOff, MapPin, Building2, X, ChevronDown } from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';
import { BaseFilter } from '@/types/core';
import { labelsService } from '@/services/contacts/labelsService';

interface ContactQuickFiltersProps {
  activeFilters: BaseFilter[];
  onApply: (filters: BaseFilter[]) => void;
}

const ALL_TAGS = '__all__';
const QUICK_KEYS = ['labels', 'city', 'company'];

// Lê o valor atual de um atributo dentro dos filtros ativos (string única).
function readValue(filters: BaseFilter[], attributeKey: string, filterOperator?: string): string {
  const f = filters.find(
    item =>
      item.attributeKey === attributeKey &&
      (filterOperator === undefined || item.filterOperator === filterOperator),
  );
  if (!f) return '';
  return Array.isArray(f.values) ? String(f.values[0] ?? '') : String(f.values ?? '');
}

// Lê a lista de valores de um atributo/operador (usada pela exclusão, que aceita
// várias etiquetas de uma vez).
function readValues(filters: BaseFilter[], attributeKey: string, filterOperator: string): string[] {
  const f = filters.find(
    item => item.attributeKey === attributeKey && item.filterOperator === filterOperator,
  );
  if (!f) return [];
  return (Array.isArray(f.values) ? f.values : [f.values]).map(String).filter(Boolean);
}

// Substitui (ou remove) a entrada de um atributo+operador, preservando os demais
// filtros (inclusive os avançados montados pelo modal). A chave é o PAR
// atributo+operador: "com a etiqueta X" e "sem as etiquetas Y,Z" são dois
// filtros de `labels` que precisam coexistir.
function withFilter(
  base: BaseFilter[],
  attributeKey: string,
  filterOperator: string,
  values: string | string[] | null,
): BaseFilter[] {
  const rest = base.filter(
    item => !(item.attributeKey === attributeKey && item.filterOperator === filterOperator),
  );

  const list = (Array.isArray(values) ? values : [values ?? ''])
    .map(value => String(value).trim())
    .filter(Boolean);

  if (list.length === 0) return rest;

  return [
    ...rest,
    {
      attributeKey,
      filterOperator,
      values: list.length === 1 ? list[0] : list,
      queryOperator: 'and',
      attributeModel: 'standard',
    },
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

  const tagValue = readValue(activeFilters, 'labels', 'equal_to');
  const excludedTags = readValues(activeFilters, 'labels', 'not_equal_to');
  const cityFromFilters = readValue(activeFilters, 'city');
  const companyFromFilters = readValue(activeFilters, 'company');

  // Inputs de texto mantêm rascunho local; aplicam no Enter ou ao limpar.
  const [cityDraft, setCityDraft] = useState(cityFromFilters);
  const [companyDraft, setCompanyDraft] = useState(companyFromFilters);

  useEffect(() => setCityDraft(cityFromFilters), [cityFromFilters]);
  useEffect(() => setCompanyDraft(companyFromFilters), [companyFromFilters]);

  const hasAny = useMemo(
    () => activeFilters.some(f => QUICK_KEYS.includes(f.attributeKey)),
    [activeFilters],
  );

  const applyTag = (value: string) => {
    const next = value === ALL_TAGS ? '' : value;
    onApply(withFilter(activeFilters, 'labels', 'equal_to', next));
  };

  // Exclusão: marcar/desmarcar uma etiqueta na lista de "não mostrar".
  const toggleExcludedTag = (title: string) => {
    const next = excludedTags.includes(title)
      ? excludedTags.filter(item => item !== title)
      : [...excludedTags, title];
    onApply(withFilter(activeFilters, 'labels', 'not_equal_to', next));
  };

  const clearExcludedTags = () => onApply(withFilter(activeFilters, 'labels', 'not_equal_to', null));

  const applyCity = () => onApply(withFilter(activeFilters, 'city', 'contains', cityDraft));
  const applyCompany = () => onApply(withFilter(activeFilters, 'company', 'contains', companyDraft));

  const clearAll = () => onApply(activeFilters.filter(f => !QUICK_KEYS.includes(f.attributeKey)));

  return (
    <div className="flex flex-wrap items-center gap-2 mb-3">
      {/* Tags — com a etiqueta */}
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

      {/* Tags — SEM a etiqueta (filtro negativo, aceita várias) */}
      <div className="flex items-center gap-1.5">
        <EyeOff className="h-4 w-4 text-muted-foreground" />
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="h-9 w-52 justify-between bg-background font-normal"
              disabled={labels.length === 0}
            >
              <span className="truncate">
                {excludedTags.length === 0
                  ? t('filter.quick.withoutTagsPlaceholder')
                  : t('filter.quick.withoutTagsSummary', { count: excludedTags.length })}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 p-2">
            <div className="px-1 pb-2 text-xs text-muted-foreground">
              {t('filter.quick.withoutTagsHint')}
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {labels.map(title => (
                <label
                  key={title}
                  className="flex items-center gap-2 rounded px-1 py-1.5 text-sm cursor-pointer hover:bg-accent"
                >
                  <Checkbox
                    checked={excludedTags.includes(title)}
                    onCheckedChange={() => toggleExcludedTag(title)}
                  />
                  <span className="truncate">{title}</span>
                </label>
              ))}
            </div>
            {excludedTags.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearExcludedTags}
                className="mt-2 h-7 w-full text-muted-foreground"
              >
                <X className="h-3.5 w-3.5 mr-1" />
                {t('filter.quick.clear')}
              </Button>
            )}
          </PopoverContent>
        </Popover>
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

      {/* Etiquetas excluídas ficam visíveis fora do popover: filtro negativo que
          não aparece é filtro que o usuário esquece que ligou. */}
      {excludedTags.map(title => (
        <Badge key={title} variant="secondary" className="h-7 gap-1 pl-2 pr-1">
          <span className="text-xs">{t('filter.quick.withoutTagBadge', { tag: title })}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toggleExcludedTag(title)}
            className="h-4 w-4 p-0 hover:bg-transparent"
          >
            <X className="h-3 w-3" />
          </Button>
        </Badge>
      ))}

      {hasAny && (
        <Button variant="ghost" size="sm" onClick={clearAll} className="h-9 text-muted-foreground">
          <X className="h-4 w-4 mr-1" />
          {t('filter.quick.clear')}
        </Button>
      )}
    </div>
  );
}
