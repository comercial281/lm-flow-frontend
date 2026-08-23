import { Zap, Trash2, Plus } from 'lucide-react';
import { Button, Input } from '@/components/ui/ds';

interface QuickRepliesHeaderProps {
  totalCount: number;
  selectedCount: number;
  searchValue: string;
  onSearchChange: (query: string) => void;
  onNew: () => void;
  onBulkDelete: () => void;
  onClearSelection: () => void;
  showBulkActions: boolean;
}

export default function QuickRepliesHeader({
  totalCount,
  selectedCount,
  searchValue,
  onSearchChange,
  onNew,
  onBulkDelete,
  onClearSelection,
  showBulkActions,
}: QuickRepliesHeaderProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold">Respostas Rápidas</h1>
          <span className="text-sm text-muted-foreground">({totalCount})</span>
        </div>
        <Button onClick={onNew} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Nova Resposta
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Input
          placeholder="Buscar por título ou conteúdo..."
          value={searchValue}
          onChange={e => onSearchChange(e.target.value)}
          className="max-w-sm"
        />
        {showBulkActions && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm text-muted-foreground">{selectedCount} selecionados</span>
            <Button variant="outline" size="sm" onClick={onClearSelection}>
              Limpar seleção
            </Button>
            <Button variant="destructive" size="sm" onClick={onBulkDelete}>
              <Trash2 className="h-4 w-4 mr-1" />
              Excluir selecionados
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
