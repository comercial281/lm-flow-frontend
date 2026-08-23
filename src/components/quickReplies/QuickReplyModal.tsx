import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Label as UILabel,
  Textarea,
} from '@/components/ui/ds';
import type { QuickReply, QuickReplyFormData } from '@/types/knowledge';

interface QuickReplyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quickReply?: QuickReply;
  isNew: boolean;
  loading: boolean;
  onSubmit: (data: QuickReplyFormData) => void;
  isAdmin?: boolean;
}

const VARIABLE_CHIPS = [
  { label: '{{lead_name}}', value: '{{lead_name}}' },
  { label: '{{lead_phone}}', value: '{{lead_phone}}' },
  { label: '{{broker_name}}', value: '{{broker_name}}' },
];

export default function QuickReplyModal({
  open,
  onOpenChange,
  quickReply,
  isNew,
  loading,
  onSubmit,
  isAdmin = false,
}: QuickReplyModalProps) {
  const [formData, setFormData] = useState<QuickReplyFormData>({
    title: '',
    content: '',
    shared: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      if (quickReply && !isNew) {
        setFormData({ title: quickReply.title, content: quickReply.content, shared: quickReply.shared });
      } else {
        setFormData({ title: '', content: '', shared: false });
      }
      setErrors({});
    }
  }, [open, quickReply, isNew]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.title.trim()) newErrors.title = 'Título é obrigatório';
    else if (formData.title.length > 80) newErrors.title = 'Máximo 80 caracteres';
    if (!formData.content.trim()) newErrors.content = 'Conteúdo é obrigatório';
    else if (formData.content.length > 4000) newErrors.content = 'Máximo 4000 caracteres';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    onSubmit(formData);
  };

  const insertVariable = (v: string) => {
    setFormData(prev => ({ ...prev, content: prev.content + v }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isNew ? 'Nova Resposta Rápida' : 'Editar Resposta Rápida'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <UILabel htmlFor="qr-title">Título</UILabel>
            <Input
              id="qr-title"
              value={formData.title}
              onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Ex: Saudação inicial"
              maxLength={80}
            />
            {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
            <p className="text-xs text-muted-foreground">{formData.title.length}/80</p>
          </div>

          <div className="space-y-1.5">
            <UILabel htmlFor="qr-content">Conteúdo</UILabel>
            <div className="flex flex-wrap gap-1 mb-1.5">
              {VARIABLE_CHIPS.map(chip => (
                <button
                  key={chip.value}
                  type="button"
                  onClick={() => insertVariable(chip.value)}
                  className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-mono"
                >
                  {chip.label}
                </button>
              ))}
            </div>
            <Textarea
              id="qr-content"
              value={formData.content}
              onChange={e => setFormData(prev => ({ ...prev, content: e.target.value }))}
              placeholder="Digite o conteúdo da resposta. Use as variáveis acima para personalizar."
              rows={6}
              maxLength={4000}
            />
            {errors.content && <p className="text-xs text-destructive">{errors.content}</p>}
            <p className="text-xs text-muted-foreground">{formData.content.length}/4000</p>
          </div>

          {isAdmin && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="qr-shared"
                checked={!!formData.shared}
                onChange={e => setFormData(prev => ({ ...prev, shared: e.target.checked }))}
                className="h-4 w-4 rounded border-border"
              />
              <UILabel htmlFor="qr-shared" className="cursor-pointer font-normal">
                Compartilhar com toda a equipe
              </UILabel>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Salvando...' : isNew ? 'Criar' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
