import { Edit, Trash2, Share2 } from 'lucide-react';
import { formatDateBR } from '@/utils/dateUtils';
import BaseTable from '@/components/base/BaseTable';
import type { TableColumn } from '@/components/base/BaseTable';
import type { QuickReply } from '@/types/knowledge';

interface QuickRepliesTableProps {
  quickReplies: QuickReply[];
  selectedQuickReplies: QuickReply[];
  loading: boolean;
  onSelectionChange: (items: QuickReply[]) => void;
  onEdit: (item: QuickReply) => void;
  onDelete: (item: QuickReply) => void;
  onCreateQuickReply: () => void;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onSort: (column: 'title' | 'created_at' | 'usage_count') => void;
}

export default function QuickRepliesTable({
  quickReplies,
  selectedQuickReplies,
  loading,
  onSelectionChange,
  onEdit,
  onDelete,
  sortBy,
  sortOrder,
  onSort,
}: QuickRepliesTableProps) {
  const columns: TableColumn<Record<string, any>>[] = [
    {
      key: 'title',
      label: 'Título',
      sortable: true,
      render: (item: Record<string, any>) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{item.title}</span>
          {item.shared && (
            <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              <Share2 className="h-3 w-3" />
              compartilhado
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'content',
      label: 'Conteúdo',
      render: (item: Record<string, any>) => (
        <div className="text-muted-foreground max-w-md">
          <div className="line-clamp-2 whitespace-pre-wrap text-sm">{item.content}</div>
        </div>
      ),
    },
    {
      key: 'usage_count',
      label: 'Usos',
      sortable: true,
      render: (item: Record<string, any>) => (
        <span className="text-sm text-muted-foreground">{item.usage_count}</span>
      ),
    },
    {
      key: 'created_at',
      label: 'Criado em',
      sortable: true,
      render: (item: Record<string, any>) => (
        <span className="text-sm text-muted-foreground">
          {formatDateBR(item.created_at)}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (item: Record<string, any>) => (
        <div className="flex items-center gap-1 justify-end">
          <button
            onClick={e => { e.stopPropagation(); onEdit(item as QuickReply); }}
            className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete(item as QuickReply); }}
            className="p-1.5 rounded hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <BaseTable
      data={quickReplies as Record<string, any>[]}
      columns={columns}
      selectedItems={selectedQuickReplies as Record<string, any>[]}
      loading={loading}
      onSelectionChange={onSelectionChange as (items: Record<string, any>[]) => void}
      sortBy={sortBy}
      sortOrder={sortOrder}
      onSort={onSort as (column: string) => void}
      getRowKey={(item: Record<string, any>) => item.id}
    />
  );
}
