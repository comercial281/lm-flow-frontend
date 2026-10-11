import { useLanguage } from '@/hooks/useLanguage';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
} from '@/components/ui/ds';
import { PipelineItem } from '@/types/analytics';

interface RemoveItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: PipelineItem | null;
  onConfirm: () => void;
  loading: boolean;
}

export default function RemoveItemModal({
  open,
  onOpenChange,
  item,
  onConfirm,
  loading,
}: RemoveItemModalProps) {
  const { t } = useLanguage('pipelines');

  if (!item) return null;

  // Get display name based on item type
  const getItemDisplayName = () => {
    if (item.type === 'contact' || !item.conversation) {
      return item.contact?.name || t('removeItem.unknownUser');
    }
    return item.conversation?.contact?.name || t('removeItem.unknownUser');
  };

  const getItemDisplayId = () => {
    if (item.type === 'conversation' && item.conversation) {
      return item.conversation.display_id;
    }
    return item.id;
  };

  const getItemStatus = () => {
    if (item.type === 'conversation' && item.conversation) {
      return item.conversation.status || 'N/A';
    }
    return 'N/A';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('removeItem.title')}</DialogTitle>
          <DialogDescription>{t('removeItem.description')}</DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-muted-foreground">
            {t('removeItem.confirmMessage')}{' '}
            <span className="font-medium text-foreground">
              {getItemDisplayName()}
            </span>{' '}
            (#{getItemDisplayId()}) deste funil?
          </p>

          <div className="mt-4 p-3 bg-muted/50 rounded-lg border border-border">
            <div className="text-sm">
              <div className="font-medium text-foreground mb-1">
                {t('removeItem.details')}
              </div>
              <div className="space-y-1 text-muted-foreground">
                <div>• {t('removeItem.contact')} {getItemDisplayName()}</div>
                <div>• {t('removeItem.id')} #{getItemDisplayId()}</div>
                <div>• {t('removeItem.status')} {getItemStatus()}</div>
                {item.type === 'conversation' && item.conversation?.inbox?.name && (
                  <div>• {t('removeItem.inbox')} {item.conversation.inbox.name}</div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-3 text-sm text-muted-foreground">
            {t('removeItem.note')}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {t('removeItem.cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? t('removeItem.removing') : t('removeItem.remove')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
