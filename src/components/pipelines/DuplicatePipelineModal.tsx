import { useState } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Label,
  Textarea,
} from '@/components/ui/ds';
import { Pipeline } from '@/types/analytics';
import Aviso from '@/components/base/Aviso';

interface DuplicatePipelineModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipeline: Pipeline;
  onSubmit: (data: { name: string; description?: string }) => void;
  loading: boolean;
}

export default function DuplicatePipelineModal({
  open,
  onOpenChange,
  pipeline,
  onSubmit,
  loading,
}: DuplicatePipelineModalProps) {
  const { t } = useLanguage('pipelines');
  const [formData, setFormData] = useState({
    name: `${pipeline.name} ${t('duplicatePipeline.copySuffix')}`,
    description: pipeline.description || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    onSubmit(formData);
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      // Reset form when closing
      setFormData({
        name: `${pipeline.name} ${t('duplicatePipeline.copySuffix')}`,
        description: pipeline.description || '',
      });
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t('duplicatePipeline.title')}</DialogTitle>
            <DialogDescription>
              {t('duplicatePipeline.description', { name: pipeline.name })}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Name */}
            <div className="grid gap-2">
              <Label htmlFor="duplicate-name">{t('duplicatePipeline.name')}</Label>
              <Input
                id="duplicate-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t('duplicatePipeline.namePlaceholder')}
                required
                disabled={loading}
              />
            </div>

            {/* Description */}
            <div className="grid gap-2">
              <Label htmlFor="duplicate-description">{t('duplicatePipeline.descriptionLabel')}</Label>
              <Textarea
                id="duplicate-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t('duplicatePipeline.descriptionPlaceholder')}
                rows={3}
                disabled={loading}
              />
            </div>

            {/* Info about what will be copied */}
            <Aviso tom="info" compacto titulo={t('duplicatePipeline.whatWillBeCopied')}>
              <p>• {t('duplicatePipeline.copied.settings')}</p>
              <p>• {t('duplicatePipeline.copied.stages')}</p>
              <p>• {t('duplicatePipeline.copied.structure')}</p>
            </Aviso>

            <Aviso tom="atencao" compacto titulo={t('duplicatePipeline.noteLabel')}>
              {t('duplicatePipeline.noteMessage')}
            </Aviso>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={loading}
            >
              {t('duplicatePipeline.cancel')}
            </Button>
            <Button type="submit" disabled={loading || !formData.name.trim()}>
              {loading ? t('duplicatePipeline.duplicating') : t('duplicatePipeline.duplicate')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}