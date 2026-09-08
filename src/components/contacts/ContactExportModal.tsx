import { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Label,
  Checkbox,
} from '@/components/ui/ds';
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { BaseFilter as ContactFilter } from '@/types/core';
import { contactsService } from '@/services/contacts/contactsService';
import type { ContactExportColumn } from '@/types/contacts';

interface ContactExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (params: ExportParams) => Promise<void>;
  loading?: boolean;
  activeFilters?: ContactFilter[];
  totalCount?: number;
}

// Quem monta os filtros para o servidor é a TELA DE CONTATOS, que é quem os
// tem. A janela só diz SE eles devem entrar — montá-los aqui também seria uma
// segunda versão da mesma consulta, e a que valeria seria sempre a outra.
interface ExportParams {
  format: 'csv' | 'xlsx';
  fields: string[];
  includeFilters: boolean;
}

/** Lista de reserva, usada só enquanto o servidor não responde (ou contra um
 *  servidor antigo, que ainda não conhece o endereço das colunas). Precisa bater
 *  com o catálogo do backend — quem mexer num lado mexe no outro. */
const FALLBACK_COLUMNS: ContactExportColumn[] = [
  { key: 'created_at', label: 'Data de cadastro', group: 'Básico', default: true },
  { key: 'name', label: 'Nome', group: 'Básico', default: true },
  { key: 'phone_number', label: 'Telefone', group: 'Básico', default: true },
  { key: 'email', label: 'E-mail', group: 'Básico', default: true },
  { key: 'origem', label: 'Origem', group: 'Básico', default: true },
];

export default function ContactExportModal({
  open,
  onOpenChange,
  onExport,
  loading = false,
  activeFilters = [],
  totalCount = 0,
}: ContactExportModalProps) {
  const { t } = useLanguage('contacts');
  const [exporting, setExporting] = useState(false);
  const [format, setFormat] = useState<'csv' | 'xlsx'>('xlsx');
  const [columns, setColumns] = useState<ContactExportColumn[]>(FALLBACK_COLUMNS);
  const [loadingColumns, setLoadingColumns] = useState(false);
  const [selectedFields, setSelectedFields] = useState<string[]>(
    FALLBACK_COLUMNS.filter(c => c.default).map(c => c.key)
  );
  const [includeFilters, setIncludeFilters] = useState(true);

  // Quais campos existem quem diz é o SERVIDOR — é ele quem monta a planilha.
  // Uma lista própria aqui foi exatamente o defeito: a tela oferecia campos que
  // o servidor não exportava, e o gestor marcava sem que nada mudasse.
  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoadingColumns(true);

    contactsService
      .getExportColumns()
      .then(serverColumns => {
        if (cancelled || serverColumns.length === 0) return;
        setColumns(serverColumns);
        setSelectedFields(serverColumns.filter(c => c.default).map(c => c.key));
      })
      // Leitura de fundo não grita: sem resposta, valem os campos de reserva.
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoadingColumns(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  // Um bloco por grupo, na ordem em que o servidor mandou.
  const groups = useMemo(() => {
    const order: string[] = [];
    const byGroup = new Map<string, ContactExportColumn[]>();

    columns.forEach(column => {
      const group = column.group || 'Outros';
      if (!byGroup.has(group)) {
        byGroup.set(group, []);
        order.push(group);
      }
      byGroup.get(group)!.push(column);
    });

    return order.map(group => ({ group, items: byGroup.get(group)! }));
  }, [columns]);

  const handleFieldToggle = (fieldId: string, checked: boolean) => {
    setSelectedFields(prev => (checked ? [...prev, fieldId] : prev.filter(id => id !== fieldId)));
  };

  const handleReset = () => {
    setSelectedFields(columns.filter(c => c.default).map(c => c.key));
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await onExport({
        format,
        fields: selectedFields,
        includeFilters: includeFilters && activeFilters.length > 0,
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Error exporting contacts:', error);
    } finally {
      setExporting(false);
    }
  };

  const getExportDescription = () => {
    if (activeFilters.length > 0 && includeFilters) {
      return t('export.description', { count: totalCount });
    }
    return t('export.descriptionAll', { count: totalCount });
  };

  const busy = loading || exporting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('export.title')}</DialogTitle>
          <DialogDescription>{getExportDescription()}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Formato */}
          <div className="space-y-2">
            <Label>{t('export.format.title')}</Label>
            <div className="flex gap-3">
              <Button
                type="button"
                variant={format === 'xlsx' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFormat('xlsx')}
                className="flex-1"
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                {t('export.format.excel')}
              </Button>
              <Button
                type="button"
                variant={format === 'csv' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFormat('csv')}
                className="flex-1"
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                {t('export.format.csv')}
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              {format === 'xlsx' ? t('export.format.excelHint') : t('export.format.csvHint')}
            </p>
          </div>

          {/* Filtros da tela */}
          {activeFilters.length > 0 && (
            <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
              <Checkbox
                id="include-filters"
                checked={includeFilters}
                onCheckedChange={checked => setIncludeFilters(checked as boolean)}
              />
              <Label htmlFor="include-filters" className="text-sm font-normal cursor-pointer">
                {t('export.filters.title', { count: activeFilters.length })}
              </Label>
            </div>
          )}

          {/* Colunas */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t('export.fields.title')}</Label>
              <button
                type="button"
                onClick={handleReset}
                className="text-xs text-blue-600 hover:underline"
              >
                {t('export.fields.reset')}
              </button>
            </div>

            <div className="space-y-3 max-h-64 overflow-y-auto border rounded-lg p-3">
              {loadingColumns && (
                <p className="flex items-center gap-2 text-xs text-gray-500">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {t('export.fields.loading')}
                </p>
              )}

              {groups.map(({ group, items }) => (
                <div key={group} className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{group}</p>
                  {items.map(column => (
                    <div key={column.key} className="flex items-center space-x-2">
                      <Checkbox
                        id={`export-${column.key}`}
                        checked={selectedFields.includes(column.key)}
                        onCheckedChange={checked => handleFieldToggle(column.key, checked as boolean)}
                      />
                      <Label
                        htmlFor={`export-${column.key}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {column.label}
                      </Label>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <p className="text-xs text-gray-500">
              {t('export.fields.selected', { count: selectedFields.length })}
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <h4 className="text-sm font-medium text-blue-900 mb-1 flex items-center gap-2">
              <Download className="h-4 w-4" />
              {t('export.download.title')}
            </h4>
            <p className="text-xs text-blue-700">{t('export.download.description')}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {t('export.actions.cancel')}
          </Button>
          <Button onClick={handleExport} disabled={selectedFields.length === 0 || busy}>
            {exporting ? t('export.actions.exporting') : t('export.actions.export')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
