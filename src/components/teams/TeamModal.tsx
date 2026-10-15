import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/ds';
import { Team, TeamFormData } from '@/types/users';
import TeamForm from './TeamForm';
import { useLanguage } from '@/hooks/useLanguage';

interface TeamModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team?: Team;
  isNew?: boolean;
  loading?: boolean;
  onSubmit: (data: TeamFormData) => void;
}

export default function TeamModal({
  open,
  onOpenChange,
  team,
  isNew = false,
  loading = false,
  onSubmit,
}: TeamModalProps) {
  const { t } = useLanguage('teams');

  const handleCancel = () => {
    onOpenChange(false);
  };

  const handleSubmit = (data: TeamFormData) => {
    onSubmit(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isNew ? t('modal.create') : t('modal.edit', { name: team?.name || 'Equipe' })}
          </DialogTitle>
        </DialogHeader>

        <TeamForm
          team={team}
          isNew={isNew}
          loading={loading}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      </DialogContent>
    </Dialog>
  );
}
