import type React from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import {
  Plus,
  Download,
  Trash2,
  Merge,
  CheckCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/ds';
import { BaseHeader, HeaderAction } from '@/components/base';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useFeature } from '@/contexts/TenantFeaturesContext';
import { contactsHeaderGates } from './contactsHeaderGates';

interface ContactsHeaderProps {
  totalCount: number;
  selectedCount: number;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onNewContact: () => void;
  onExport: () => void;
  onBulkDelete: () => void;
  onMergeContacts: () => void;
  onClearSelection: () => void;
  /** true quando a seleção alcança todos os contatos da consulta, não só a página. */
  allMatchingSelected?: boolean;
  onSelectAllMatching?: () => void;
  /** Pílulas e "Filtros" (ContactsFiltros), na linha da busca. */
  filtros?: React.ReactNode;
}

export default function ContactsHeader({
  totalCount,
  selectedCount,
  searchValue,
  onSearchChange,
  onNewContact,
  onExport,
  onBulkDelete,
  onMergeContacts,
  onClearSelection,
  allMatchingSelected = false,
  onSelectAllMatching,
  filtros,
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

  const gates = contactsHeaderGates(ff, isReady, can);

  const primaryAction: HeaderAction | undefined = gates.create ? {
    label: 'Novo contato',
    icon: <Plus className="h-4 w-4" />,
    onClick: onNewContact,
    dataTour: 'contacts-new-button',
  } : undefined;

  // Só Exportar, com texto (decisão do dono, 02/10/2026). O Importar saiu de
  // Contatos pra todo mundo: planilha entra pelo Bolsão e pelo quadro do funil,
  // que distribuem; aqui ela virava contato solto, sem dono nem funil.
  const secondaryActions: HeaderAction[] = gates.export
    ? [{
        label: 'Exportar',
        icon: <Download className="h-4 w-4" />,
        onClick: onExport,
        variant: 'outline' as const,
      }]
    : [];

  const bulkActions: HeaderAction[] = [
    // Mesclar exige escolher quem fica e quem some, contato a contato — não faz
    // sentido com a base inteira marcada, então some no modo "todos".
    ...(!allMatchingSelected && selectedCount >= 2 && gates.merge
      ? [
          {
            label: t('header.mergeContacts'),
            icon: <Merge className="h-4 w-4" />,
            onClick: onMergeContacts,
            variant: 'outline' as const,
          },
        ]
      : []),
    ...(gates.delete ? [{
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
      title="Contatos"
      subtitle="Todas as pessoas que já falaram com você, com o histórico e as etiquetas."
      totalCount={totalCount}
      // No modo "todos", o número que importa é o do conjunto inteiro — mostrar
      // os 20 da página faria o usuário achar que o delete só pega a página.
      selectedCount={allMatchingSelected ? totalCount : selectedCount}
      searchValue={searchValue}
      onSearchChange={onSearchChange}
      searchPlaceholder="Buscar por nome ou celular"
      primaryAction={primaryAction}
      secondaryActions={secondaryActions}
      bulkActions={bulkActions}
      onClearSelection={onClearSelection}
      selectionExtra={selectionExtra}
      aoLadoDaBusca={filtros}
    />
  );
}
